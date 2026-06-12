"""
services/analytics_engine.py
─────────────────────────────────────────────────────────────────────────────
DataAnalyzer — чистый математический движок.

Принцип: никакого LLM здесь. Только детерминированные вычисления.
Результат — компактная JSON-сводка (AnalyticsSummary), которую получает
PresentationGenerator и отправляет в Gemini как «контекст факты».

Почему Python, а не SQL агрегации?
  • Корреляции между таблицами (контингент × финансы × трудоустройство)
    требуют join-логики, которую удобнее выражать на Python.
  • Статистические методы (z-score, MAD) проще тестировать в Python.
  • SQL остаётся оптимальным для выборки данных; Python — для анализа.

Стратегия выборки данных (795 полей):
  Запросы используют load_only() для выбора только нужных метрик.
  Полные ORM-объекты НЕ загружаются — только скалярные колонки,
  необходимые для каждого конкретного метода анализа.
  Детали — в docstrings каждого метода.
"""
from __future__ import annotations

import logging
import math
import statistics
from dataclasses import dataclass, field
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import load_only

from app.models.contingent import ContingentSnapshot
from app.models.finance import FinanceRecord
from app.models.graduates import GraduatesRecord
from app.models.science import ScienceActivity
from app.models.organization import Organization

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Промежуточные структуры данных
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class RegionalDelta:
    region_id:   int
    region_name: str
    metric:      str
    value_curr:  Optional[float]
    value_prev:  Optional[float]
    delta_pct:   Optional[float]     # None если один из периодов отсутствует
    direction:   str = "neutral"     # "up" | "down" | "neutral"


@dataclass
class AnomalyFlag:
    org_id:    str
    org_name:  str
    field:     str
    period:    str
    value:     float | int
    expected:  Optional[float]
    deviation: Optional[float]       # % от ожидаемого
    severity:  str = "medium"        # "high" | "medium" | "low"
    anomaly_type: str = "statistical" # "statistical" | "logical" | "missing"


@dataclass
class RankedOrg:
    org_id:      str
    org_name:    str
    org_type:    str
    total_score: float
    scores:      dict[str, float]    # {dimension: score}
    rank:        int = 0


@dataclass
class AnalyticsSummary:
    """
    Выход DataAnalyzer → вход PresentationGenerator.
    Размер должен быть < 8 KB в JSON — иначе Gemini превысит лимит токенов.
    """
    period_year:   int
    org_count:     int
    region_deltas: list[RegionalDelta] = field(default_factory=list)
    anomalies:     list[AnomalyFlag]   = field(default_factory=list)
    rankings:      list[RankedOrg]     = field(default_factory=list)
    aggregate_stats: dict[str, Any]    = field(default_factory=dict)

    def to_compact_dict(self) -> dict[str, Any]:
        """
        Сериализация в компактный dict для передачи в Gemini.
        Обрезает длинные списки до топ-20 чтобы не раздуть контекст.
        """
        return {
            "period_year":   self.period_year,
            "org_count":     self.org_count,
            "aggregate":     self.aggregate_stats,
            "regional_deltas": [
                {
                    "region":     d.region_name,
                    "metric":     d.metric,
                    "curr":       round(d.value_curr, 2) if d.value_curr is not None else None,
                    "prev":       round(d.value_prev, 2) if d.value_prev is not None else None,
                    "delta_pct":  round(d.delta_pct, 1) if d.delta_pct is not None else None,
                    "direction":  d.direction,
                }
                for d in self.region_deltas[:20]
            ],
            "anomalies": [
                {
                    "org":       a.org_name,
                    "field":     a.field,
                    "period":    a.period,
                    "value":     a.value,
                    "expected":  round(a.expected, 2) if a.expected else None,
                    "deviation": round(a.deviation, 1) if a.deviation else None,
                    "severity":  a.severity,
                    "type":      a.anomaly_type,
                }
                for a in sorted(
                    self.anomalies,
                    key=lambda x: {"high": 0, "medium": 1, "low": 2}[x.severity],
                )[:25]
            ],
            "rankings": [
                {
                    "rank":    r.rank,
                    "org":     r.org_name,
                    "type":    r.org_type,
                    "score":   round(r.total_score, 2),
                    "detail":  {k: round(v, 2) for k, v in r.scores.items()},
                }
                for r in self.rankings[:15]
            ],
        }


# ─────────────────────────────────────────────────────────────────────────────
# Статистические утилиты (чистые функции, без I/O)
# ─────────────────────────────────────────────────────────────────────────────

def _pct_delta(curr: Optional[float], prev: Optional[float]) -> Optional[float]:
    """Процентное изменение curr относительно prev. None если деление на 0."""
    if curr is None or prev is None:
        return None
    if prev == 0:
        return None
    return (curr - prev) / abs(prev) * 100


def _z_score(value: float, mean: float, std: float) -> Optional[float]:
    """Z-оценка значения относительно выборки. None при std=0."""
    if std == 0:
        return None
    return (value - mean) / std


def _mad_score(value: float, median: float, mad: float) -> Optional[float]:
    """
    Медианное абсолютное отклонение (MAD) — робастнее z-score при выбросах.
    Используем вместо z-score для финансовых данных с тяжёлыми хвостами.
    """
    if mad == 0:
        return None
    return abs(value - median) / mad


def _classify_severity(deviation_pct: Optional[float]) -> str:
    """Классифицирует аномалию по размеру отклонения."""
    if deviation_pct is None:
        return "low"
    abs_dev = abs(deviation_pct)
    if abs_dev >= 200:
        return "high"
    if abs_dev >= 100:
        return "medium"
    return "low"


# ─────────────────────────────────────────────────────────────────────────────
# DataAnalyzer
# ─────────────────────────────────────────────────────────────────────────────

class DataAnalyzer:
    """
    Математический движок для подготовки данных перед отправкой в LLM.

    Принципы:
      1. Каждый метод выполняет ОДИН тип анализа.
      2. Все методы async — БД-запросы через SQLAlchemy async.
      3. load_only() везде — не тянем 795 полей когда нужно 5.
      4. Возвращают Python-объекты (dataclasses), не сырые dict с БД.
    """

    def __init__(self, db: AsyncSession):
        self._db = db

    # ── Вспомогательный метод ─────────────────────────────────────────────

    async def _org_filter_stmt(
        self,
        model: Any,
        *,
        org_id: Optional[UUID] = None,
        region_id: Optional[int] = None,
        org_type_id: Optional[int] = None,
        year_col: str = "period_year",
        year: Optional[int] = None,
        extra_where: Optional[Any] = None,
    ):
        """
        Базовый SELECT с фильтрами и JOIN к organizations.
        Возвращает stmt — caller добавляет load_only и ORDER BY.
        """
        stmt = select(model, Organization.name_ru.label("org_name")).join(
            Organization, Organization.id == model.org_id
        )
        if org_id:
            stmt = stmt.where(model.org_id == org_id)
        if region_id:
            stmt = stmt.where(Organization.region_id == region_id)
        if org_type_id:
            stmt = stmt.where(Organization.org_type_id == org_type_id)
        if year:
            col = getattr(model, year_col, None)
            if col is not None:
                if year_col == "snapshot_date":
                    stmt = stmt.where(func.extract("year", col) == year)
                else:
                    stmt = stmt.where(col == year)
        if extra_where is not None:
            stmt = stmt.where(extra_where)
        return stmt

    # ─────────────────────────────────────────────────────────────────────
    # 1. Региональные дельты
    # ─────────────────────────────────────────────────────────────────────

    async def calculate_regional_deltas(
        self,
        *,
        current_year: int,
        past_year: int,
        metric: str = "budget",
        org_type_id: Optional[int] = None,
        region_id: Optional[int] = None,
    ) -> list[RegionalDelta]:
        """
        Сравнивает агрегированные метрики по регионам между двумя периодами.

        Args:
            current_year: Текущий год (числитель дельты).
            past_year:    Базовый год (знаменатель дельты).
            metric:       Какую метрику сравнивать:
                            "budget"    → SUM(annual_budget) по region
                            "students"  → SUM(total_count) по region
                            "employment"→ AVG(employed_6m_pct) по region
            org_type_id:  Фильтр по типу организации (None = все типы).
            region_id:    Фильтр по конкретному региону (None = все).

        Returns:
            list[RegionalDelta], отсортированный по |delta_pct| убыванию.

        SQLAlchemy:
            Два агрегирующих запроса (current, past), каждый JOIN с organizations
            и regions. load_only не применяем — используем прямой SELECT агрегаций
            (func.sum / func.avg), что эквивалентно load_only по эффективности:
            ORM-объекты не создаются, возвращаются только скалярные Row.
        """
        METRIC_MAP = {
            "budget":     (FinanceRecord,     "annual_budget",   "period_year", func.sum),
            "students":   (ContingentSnapshot,"total_count",     "snapshot_date", func.sum),
            "employment": (GraduatesRecord,   "employed_6m_pct", "graduation_year", func.avg),
        }
        if metric not in METRIC_MAP:
            raise ValueError(f"Unknown metric: {metric}. Use: {list(METRIC_MAP)}")

        model, col_name, year_col, agg_func = METRIC_MAP[metric]
        col = getattr(model, col_name)
        org_col = getattr(model, year_col)

        async def _fetch_year(year: int) -> dict[int, float]:
            """Агрегация по region_id для заданного года."""
            if year_col == "snapshot_date":
                year_cond = func.extract("year", org_col) == year
            else:
                year_cond = org_col == year

            stmt = (
                select(
                    Organization.region_id,
                    agg_func(col).label("value"),
                )
                .join(Organization, Organization.id == model.org_id)
                .where(
                    model.deleted_at.is_(None),
                    year_cond,
                )
            )
            if org_type_id:
                stmt = stmt.where(Organization.org_type_id == org_type_id)
            if region_id:
                stmt = stmt.where(Organization.region_id == region_id)
            stmt = stmt.group_by(Organization.region_id)

            rows = (await self._db.execute(stmt)).all()
            return {r.region_id: float(r.value) for r in rows if r.region_id}

        curr_map = await _fetch_year(current_year)
        prev_map = await _fetch_year(past_year)

        # Загружаем имена регионов (только id + name_ru — эффективно)
        from app.models.organization import Region
        region_rows = (
            await self._db.execute(
                select(Region.id, Region.name_ru)
            )
        ).all()
        region_names = {r.id: r.name_ru for r in region_rows}

        results: list[RegionalDelta] = []
        all_region_ids = set(curr_map) | set(prev_map)
        for rid in all_region_ids:
            curr_val = curr_map.get(rid)
            prev_val = prev_map.get(rid)
            delta = _pct_delta(curr_val, prev_val)
            direction = "neutral"
            if delta is not None:
                direction = "up" if delta > 1 else "down" if delta < -1 else "neutral"
            results.append(RegionalDelta(
                region_id   = rid,
                region_name = region_names.get(rid, str(rid)),
                metric      = metric,
                value_curr  = curr_val,
                value_prev  = prev_val,
                delta_pct   = delta,
                direction   = direction,
            ))

        results.sort(key=lambda x: abs(x.delta_pct or 0), reverse=True)
        return results

    # ─────────────────────────────────────────────────────────────────────
    # 2. Обнаружение аномалий
    # ─────────────────────────────────────────────────────────────────────

    async def detect_anomalies(
        self,
        *,
        year: int,
        org_id: Optional[UUID] = None,
        region_id: Optional[int] = None,
        org_type_id: Optional[int] = None,
        z_threshold: float = 2.5,
    ) -> list[AnomalyFlag]:
        """
        Поиск статистических и логических аномалий в данных за год.

        Проверяемые аномалии:
          A) Финансовые (FinanceRecord):
             • ФОТ > бюджета           → логическая аномалия
             • Резкий рост бюджета >4x  → статистическая (год-к-году)
             • z-score(annual_budget) > threshold → выброс в распределении

          B) Контингент (ContingentSnapshot):
             • Падение/рост total_count >4x год-к-году
             • budget_count > total_count → логическая ошибка

          C) Трудоустройство (GraduatesRecord):
             • employed_6m_pct < 20%   → красный флаг
             • employed_count > total_graduates → логическая ошибка

        SQLAlchemy:
          Используем load_only() для каждого запроса — тянем только
          колонки, участвующие в проверке. Это критично при 13 500+ строках.
          Пример для FinanceRecord:
            .options(load_only(
                FinanceRecord.org_id, FinanceRecord.annual_budget,
                FinanceRecord.expenses_payroll, FinanceRecord.period_year,
            ))
        """
        anomalies: list[AnomalyFlag] = []

        # ── A. Финансовые аномалии ────────────────────────────────────────

        fin_stmt = (
            select(
                FinanceRecord.org_id,
                FinanceRecord.annual_budget,
                FinanceRecord.expenses_payroll,
                FinanceRecord.period_year,
                Organization.name_ru.label("org_name"),
            )
            .join(Organization, Organization.id == FinanceRecord.org_id)
            .where(
                FinanceRecord.deleted_at.is_(None),
                FinanceRecord.period_year == year,
                FinanceRecord.period_month.is_(None),
                FinanceRecord.annual_budget.isnot(None),
            )
        )
        if org_id:
            fin_stmt = fin_stmt.where(FinanceRecord.org_id == org_id)
        if region_id:
            fin_stmt = fin_stmt.where(Organization.region_id == region_id)
        if org_type_id:
            fin_stmt = fin_stmt.where(Organization.org_type_id == org_type_id)

        fin_rows = (await self._db.execute(fin_stmt)).all()

        budgets = [float(r.annual_budget) for r in fin_rows if r.annual_budget]
        if len(budgets) > 2:
            mean_b  = statistics.mean(budgets)
            stdev_b = statistics.stdev(budgets) if len(budgets) > 1 else 0
            median_b = statistics.median(budgets)
            mad_b    = statistics.median([abs(x - median_b) for x in budgets]) or 1.0
        else:
            mean_b = stdev_b = median_b = mad_b = 0

        for r in fin_rows:
            bud = float(r.annual_budget or 0)
            pay = float(r.expenses_payroll or 0)

            # Логическая аномалия: ФОТ > бюджета
            if pay > 0 and bud > 0 and pay > bud:
                dev = (pay - bud) / bud * 100
                anomalies.append(AnomalyFlag(
                    org_id=str(r.org_id), org_name=r.org_name,
                    field="expenses_payroll / annual_budget",
                    period=str(year),
                    value=round(pay / bud * 100, 1),
                    expected=100.0,
                    deviation=round(dev, 1),
                    severity="high",
                    anomaly_type="logical",
                ))

            # Статистическая аномалия по бюджету (MAD-score)
            if mad_b > 0 and bud > 0:
                mad_s = _mad_score(bud, median_b, mad_b)
                if mad_s and mad_s > z_threshold:
                    dev_pct = (bud - median_b) / median_b * 100
                    anomalies.append(AnomalyFlag(
                        org_id=str(r.org_id), org_name=r.org_name,
                        field="annual_budget",
                        period=str(year),
                        value=round(bud),
                        expected=round(median_b),
                        deviation=round(dev_pct, 1),
                        severity=_classify_severity(dev_pct),
                        anomaly_type="statistical",
                    ))

        # ── A2. Резкий рост бюджета год-к-году ───────────────────────────

        fin_prev_stmt = (
            select(
                FinanceRecord.org_id,
                FinanceRecord.annual_budget,
                Organization.name_ru.label("org_name"),
            )
            .join(Organization, Organization.id == FinanceRecord.org_id)
            .where(
                FinanceRecord.deleted_at.is_(None),
                FinanceRecord.period_year == year - 1,
                FinanceRecord.period_month.is_(None),
                FinanceRecord.annual_budget.isnot(None),
            )
        )
        if org_id:    fin_prev_stmt = fin_prev_stmt.where(FinanceRecord.org_id == org_id)
        if region_id: fin_prev_stmt = fin_prev_stmt.where(Organization.region_id == region_id)

        prev_fin = {str(r.org_id): float(r.annual_budget) for r in
                    (await self._db.execute(fin_prev_stmt)).all()}
        curr_fin = {str(r.org_id): (float(r.annual_budget), r.org_name) for r in fin_rows}

        for oid, (curr_bud, org_name) in curr_fin.items():
            prev_bud = prev_fin.get(oid)
            if prev_bud and prev_bud > 0:
                ratio = curr_bud / prev_bud
                if ratio > 4.0 or ratio < 0.25:
                    dev = (curr_bud - prev_bud) / prev_bud * 100
                    anomalies.append(AnomalyFlag(
                        org_id=oid, org_name=org_name,
                        field="annual_budget (yoy)",
                        period=f"{year-1}→{year}",
                        value=round(curr_bud),
                        expected=round(prev_bud),
                        deviation=round(dev, 1),
                        severity="high" if (ratio > 6.0 or ratio < 0.15) else "medium",
                        anomaly_type="statistical",
                    ))

        # ── B. Аномалии контингента ───────────────────────────────────────

        cont_stmt = (
            select(
                ContingentSnapshot.org_id,
                ContingentSnapshot.total_count,
                ContingentSnapshot.budget_count,
                ContingentSnapshot.snapshot_date,
                Organization.name_ru.label("org_name"),
            )
            .join(Organization, Organization.id == ContingentSnapshot.org_id)
            .where(
                ContingentSnapshot.deleted_at.is_(None),
                func.extract("year", ContingentSnapshot.snapshot_date) == year,
            )
        )
        if org_id:      cont_stmt = cont_stmt.where(ContingentSnapshot.org_id == org_id)
        if region_id:   cont_stmt = cont_stmt.where(Organization.region_id == region_id)
        if org_type_id: cont_stmt = cont_stmt.where(Organization.org_type_id == org_type_id)

        cont_rows = (await self._db.execute(cont_stmt)).all()

        # Предыдущий год для сравнения год-к-году
        cont_prev_stmt = (
            select(
                ContingentSnapshot.org_id,
                ContingentSnapshot.total_count,
            )
            .join(Organization, Organization.id == ContingentSnapshot.org_id)
            .where(
                ContingentSnapshot.deleted_at.is_(None),
                func.extract("year", ContingentSnapshot.snapshot_date) == year - 1,
            )
        )
        if org_id:    cont_prev_stmt = cont_prev_stmt.where(ContingentSnapshot.org_id == org_id)
        if region_id: cont_prev_stmt = cont_prev_stmt.where(Organization.region_id == region_id)

        prev_cont = {str(r.org_id): int(r.total_count or 0)
                     for r in (await self._db.execute(cont_prev_stmt)).all()}

        for r in cont_rows:
            total = int(r.total_count or 0)
            budget_c = int(r.budget_count or 0)

            # Логическая аномалия: бюджетников > всего студентов
            if budget_c > total > 0:
                anomalies.append(AnomalyFlag(
                    org_id=str(r.org_id), org_name=r.org_name,
                    field="budget_count > total_count",
                    period=str(r.snapshot_date),
                    value=budget_c, expected=total,
                    deviation=None,
                    severity="high",
                    anomaly_type="logical",
                ))

            # Скачок контингента год-к-году
            prev = prev_cont.get(str(r.org_id))
            if prev and prev > 0 and total > 0:
                ratio = total / prev
                if ratio > 4.0 or ratio < 0.25:
                    dev = (total - prev) / prev * 100
                    anomalies.append(AnomalyFlag(
                        org_id=str(r.org_id), org_name=r.org_name,
                        field="total_count (yoy)",
                        period=f"{year-1}→{year}",
                        value=total, expected=prev,
                        deviation=round(dev, 1),
                        severity="high" if (ratio > 8.0 or ratio < 0.12) else "medium",
                        anomaly_type="statistical",
                    ))

        # ── C. Аномалии трудоустройства ───────────────────────────────────

        grad_stmt = (
            select(
                GraduatesRecord.org_id,
                GraduatesRecord.employed_6m_pct,
                GraduatesRecord.employed_12m_pct,
                GraduatesRecord.graduates_total,
                GraduatesRecord.graduation_year,
                Organization.name_ru.label("org_name"),
            )
            .join(Organization, Organization.id == GraduatesRecord.org_id)
            .where(
                GraduatesRecord.deleted_at.is_(None),
                GraduatesRecord.graduation_year == year,
            )
        )
        if org_id:      grad_stmt = grad_stmt.where(GraduatesRecord.org_id == org_id)
        if region_id:   grad_stmt = grad_stmt.where(Organization.region_id == region_id)
        if org_type_id: grad_stmt = grad_stmt.where(Organization.org_type_id == org_type_id)

        for r in (await self._db.execute(grad_stmt)).all():
            emp_pct  = float(r.employed_6m_pct or 0)
            emp12    = float(r.employed_12m_pct or 0)

            # Критически низкое трудоустройство через 6 месяцев
            if 0 < emp_pct < 20:
                anomalies.append(AnomalyFlag(
                    org_id=str(r.org_id), org_name=r.org_name,
                    field="employed_6m_pct",
                    period=str(year),
                    value=round(emp_pct, 1), expected=60.0,
                    deviation=round(emp_pct - 60.0, 1),
                    severity="high",
                    anomaly_type="statistical",
                ))

            # Нетипичное падение трудоустройства через 12 месяцев vs 6
            if emp12 > 0 and emp_pct > 0 and emp_pct - emp12 > 30:
                anomalies.append(AnomalyFlag(
                    org_id=str(r.org_id), org_name=r.org_name,
                    field="employed_6m_vs_12m_drop",
                    period=str(year),
                    value=round(emp_pct - emp12, 1), expected=0.0,
                    deviation=round(emp_pct - emp12, 1),
                    severity="medium",
                    anomaly_type="statistical",
                ))

        # Сортируем: high → medium → low, затем по |deviation|
        priority = {"high": 0, "medium": 1, "low": 2}
        anomalies.sort(key=lambda x: (priority[x.severity], -abs(x.deviation or 0)))
        logger.info("detect_anomalies year=%d found=%d", year, len(anomalies))
        return anomalies

    # ─────────────────────────────────────────────────────────────────────
    # 3. Рейтинг организаций
    # ─────────────────────────────────────────────────────────────────────

    async def calculate_rankings(
        self,
        *,
        year: int,
        methodology_weights: Optional[dict[str, float]] = None,
        org_id: Optional[UUID] = None,
        region_id: Optional[int] = None,
        org_type_id: Optional[int] = None,
        top_n: int = 20,
    ) -> list[RankedOrg]:
        """
        Многомерный рейтинг организаций по пяти измерениям.

        Веса по умолчанию (аналогичны коэффициентам системы):
          finance:    0.30  — соотношение расходов, исполнение бюджета
          contingent: 0.20  — рост/стабильность контингента
          science:    0.20  — публикации, гранты, НИОКР (для ВиПО)
          graduates:  0.20  — трудоустройство, средняя зарплата
          education:  0.10  — педагогический состав, программы

        Нормализация: min-max по каждому измерению → [0, 1].
        Итоговый балл = взвешенная сумма нормализованных оценок × 100.

        SQLAlchemy:
          Один запрос per таблица с load_only() только на нужные метрики.
          FinanceRecord:      load_only(annual_budget, expenses_payroll)
          ContingentSnapshot: load_only(total_count, snapshot_date)
          ScienceActivity:    load_only(publications_scopus, grants_active_count)
          GraduatesRecord:    load_only(employed_6m_pct)
          Итого: 8 колонок вместо потенциальных 795.
        """
        weights = methodology_weights or {
            "finance":    0.30,
            "contingent": 0.20,
            "science":    0.20,
            "graduates":  0.20,
            "education":  0.10,
        }
        if abs(sum(weights.values()) - 1.0) > 0.01:
            raise ValueError("methodology_weights must sum to 1.0")

        org_scores: dict[str, dict[str, float]] = {}  # org_id → {dim: raw_score}
        org_meta:   dict[str, tuple[str, str]]  = {}  # org_id → (name, type_code)

        # ── Базовые метаданные организаций ────────────────────────────────
        from app.models.organization import OrgType

        org_stmt = (
            select(
                Organization.id,
                Organization.name_ru,
                OrgType.code.label("type_code"),
            )
            .join(OrgType, OrgType.id == Organization.org_type_id, isouter=True)
            .where(Organization.status == "active")
        )
        if org_id:      org_stmt = org_stmt.where(Organization.id == org_id)
        if region_id:   org_stmt = org_stmt.where(Organization.region_id == region_id)
        if org_type_id: org_stmt = org_stmt.where(Organization.org_type_id == org_type_id)

        for r in (await self._db.execute(org_stmt)).all():
            oid = str(r.id)
            org_meta[oid] = (r.name_ru, r.type_code or "—")
            org_scores[oid] = {}

        if not org_meta:
            return []

        # ── Финансовое измерение: (1 - ФОТ/бюджет) × исполнение ──────────
        fin_stmt = (
            select(
                FinanceRecord.org_id,
                FinanceRecord.annual_budget,
                FinanceRecord.expenses_payroll,
            )
            .where(
                FinanceRecord.deleted_at.is_(None),
                FinanceRecord.period_year == year,
                FinanceRecord.period_month.is_(None),
            )
        )
        if region_id: fin_stmt = fin_stmt.join(
            Organization, Organization.id == FinanceRecord.org_id
        ).where(Organization.region_id == region_id)

        for r in (await self._db.execute(fin_stmt)).all():
            oid = str(r.org_id)
            if oid not in org_scores:
                continue
            bud = float(r.annual_budget or 0)
            pay = float(r.expenses_payroll or 0)
            # Балл: чем меньше доля ФОТ (>55% = плохо), тем выше оценка
            fin_score = max(0.0, 1.0 - (pay / bud if bud > 0 else 1.0))
            org_scores[oid]["finance"] = fin_score

        # ── Контингент: нормализованный размер + тренд ────────────────────
        cont_stmt = (
            select(
                ContingentSnapshot.org_id,
                ContingentSnapshot.total_count,
            )
            .where(
                ContingentSnapshot.deleted_at.is_(None),
                func.extract("year", ContingentSnapshot.snapshot_date) == year,
            )
        )
        cont_rows = {str(r.org_id): int(r.total_count or 0)
                     for r in (await self._db.execute(cont_stmt)).all()}
        max_cont = max(cont_rows.values(), default=1) or 1
        for oid, cnt in cont_rows.items():
            if oid in org_scores:
                org_scores[oid]["contingent"] = cnt / max_cont

        # ── Наука: публикации Scopus + активные гранты (из JSONB) ─────────
        sci_stmt = (
            select(
                ScienceActivity.org_id,
                ScienceActivity.publications_scopus,
                func.coalesce(
                    func.jsonb_array_length(ScienceActivity.grants_json), 0
                ).label("grants_count"),
            )
            .where(
                ScienceActivity.deleted_at.is_(None),
                ScienceActivity.period_year == year,
            )
        )
        sci_rows = {
            str(r.org_id): (int(r.publications_scopus or 0), int(r.grants_count or 0))
            for r in (await self._db.execute(sci_stmt)).all()
        }
        max_pub = max((v[0] for v in sci_rows.values()), default=1) or 1
        max_gr  = max((v[1] for v in sci_rows.values()), default=1) or 1
        for oid, (pub, gr) in sci_rows.items():
            if oid in org_scores:
                org_scores[oid]["science"] = 0.7 * (pub / max_pub) + 0.3 * (gr / max_gr)

        # ── Выпускники: трудоустройство 6 мес ────────────────────────────
        grad_stmt = (
            select(
                GraduatesRecord.org_id,
                GraduatesRecord.employed_6m_pct,
            )
            .where(
                GraduatesRecord.deleted_at.is_(None),
                GraduatesRecord.graduation_year == year,
            )
        )
        for r in (await self._db.execute(grad_stmt)).all():
            oid = str(r.org_id)
            if oid in org_scores:
                # employed_6m_pct уже в %: 85% → score 0.85
                org_scores[oid]["graduates"] = min(1.0, float(r.employed_6m_pct or 0) / 100)

        # ── Образование: разнообразие программ ────────────────────────────
        from app.models.education import EducationalProcess
        edu_stmt = (
            select(
                EducationalProcess.org_id,
                EducationalProcess.mandatory_programs_count,
                EducationalProcess.international_programs_count,
            )
            .where(
                EducationalProcess.deleted_at.is_(None),
                func.extract("year", EducationalProcess.snapshot_date) == year,
            )
        )
        edu_rows_raw = (await self._db.execute(edu_stmt)).all()
        max_prog = max(
            (int(r.mandatory_programs_count or 0) + int(r.international_programs_count or 0))
            for r in edu_rows_raw
        ) if edu_rows_raw else 1
        max_prog = max_prog or 1
        for r in edu_rows_raw:
            oid = str(r.org_id)
            if oid in org_scores:
                prog_total = int(r.mandatory_programs_count or 0) + int(r.international_programs_count or 0)
                org_scores[oid]["education"] = prog_total / max_prog

        # ── Взвешенный итог и ранжирование ────────────────────────────────
        ranked: list[RankedOrg] = []
        for oid, scores in org_scores.items():
            if not scores:
                continue
            total = sum(
                scores.get(dim, 0.0) * w
                for dim, w in weights.items()
            ) * 100  # → [0, 100]

            name, type_code = org_meta[oid]
            ranked.append(RankedOrg(
                org_id=oid, org_name=name, org_type=type_code,
                total_score=round(total, 2),
                scores={k: round(v * 100, 1) for k, v in scores.items()},
            ))

        ranked.sort(key=lambda x: x.total_score, reverse=True)
        for i, r in enumerate(ranked, 1):
            r.rank = i

        logger.info("calculate_rankings year=%d orgs_ranked=%d", year, len(ranked))
        return ranked[:top_n]

    # ─────────────────────────────────────────────────────────────────────
    # 4. Сводная статистика (для заголовочного слайда)
    # ─────────────────────────────────────────────────────────────────────

    async def build_aggregate_stats(
        self,
        *,
        year: int,
        region_id: Optional[int] = None,
        org_type_id: Optional[int] = None,
    ) -> dict[str, Any]:
        """
        Ключевые агрегаты по системе для заголовочного слайда.
        Один SQL-запрос с множественными агрегациями — минимум round-trips.
        """
        params: dict[str, Any] = {"year": year}
        extra = ""
        if region_id:
            extra += " AND o.region_id = :region_id"
            params["region_id"] = region_id
        if org_type_id:
            extra += " AND o.org_type_id = :org_type_id"
            params["org_type_id"] = org_type_id

        row = (await self._db.execute(text(f"""
            SELECT
                COUNT(DISTINCT o.id)::int                              AS org_count,
                SUM(c.total_count)::bigint                             AS total_students,
                AVG(c.total_count)::float                              AS avg_students,
                SUM(f.annual_budget)::float                            AS total_budget,
                AVG(CASE WHEN f.annual_budget > 0
                    THEN f.expenses_payroll / f.annual_budget * 100
                    END)::float                                        AS avg_payroll_pct,
                AVG(g.employed_6m_pct)::float                         AS avg_employment_pct,
                SUM(s.publications_scopus)::int                        AS total_scopus,
                COALESCE(SUM(jsonb_array_length(s.grants_json)), 0)::int AS total_grants
            FROM   organizations o
            LEFT JOIN contingent_snapshots c
                ON c.org_id = o.id
                AND EXTRACT(year FROM c.snapshot_date) = :year
                AND c.deleted_at IS NULL
            LEFT JOIN finance_records f
                ON f.org_id = o.id
                AND f.period_year = :year
                AND f.period_month IS NULL
                AND f.deleted_at IS NULL
            LEFT JOIN graduates_records g
                ON g.org_id = o.id
                AND g.graduation_year = :year
                AND g.deleted_at IS NULL
            LEFT JOIN science_activity s
                ON s.org_id = o.id
                AND s.period_year = :year
                AND s.deleted_at IS NULL
            WHERE o.status = 'active'
            {extra}
        """), params)).mappings().first()

        if not row:
            return {}

        return {
            "org_count":         row["org_count"] or 0,
            "total_students":    row["total_students"] or 0,
            "avg_students":      round(row["avg_students"] or 0, 0),
            "total_budget_mln":  round((row["total_budget"] or 0) / 1_000_000, 1),
            "avg_payroll_pct":   round(row["avg_payroll_pct"] or 0, 1),
            "avg_employment_pct": round(row["avg_employment_pct"] or 0, 1),
            "total_scopus":      row["total_scopus"] or 0,
            "total_grants":      row["total_grants"] or 0,
        }

    # ─────────────────────────────────────────────────────────────────────
    # Главная точка входа
    # ─────────────────────────────────────────────────────────────────────

    async def run_full_analysis(
        self,
        *,
        year: int,
        org_id: Optional[UUID] = None,
        region_id: Optional[int] = None,
        org_type_id: Optional[int] = None,
        methodology_weights: Optional[dict[str, float]] = None,
    ) -> AnalyticsSummary:
        """
        Запускает все три анализа и собирает AnalyticsSummary.
        Вызывается из Celery-таски.
        """
        agg     = await self.build_aggregate_stats(
                    year=year, region_id=region_id, org_type_id=org_type_id)
        deltas  = await self.calculate_regional_deltas(
                    current_year=year, past_year=year - 1,
                    org_type_id=org_type_id, region_id=region_id)
        anomaly = await self.detect_anomalies(
                    year=year, org_id=org_id,
                    region_id=region_id, org_type_id=org_type_id)
        ranks   = await self.calculate_rankings(
                    year=year, org_id=org_id,
                    region_id=region_id, org_type_id=org_type_id,
                    methodology_weights=methodology_weights)

        return AnalyticsSummary(
            period_year     = year,
            org_count       = agg.get("org_count", 0),
            region_deltas   = deltas,
            anomalies       = anomaly,
            rankings        = ranks,
            aggregate_stats = agg,
        )
