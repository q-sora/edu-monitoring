"""
services/ai_synthesizer.py
─────────────────────────────────────────────────────────────────────────────
AgenticOrchestrator — трёхфазный синтез аналитической презентации.

Архитектура (по аналогии с паттерном Claude Code):
  Phase 1 — PLAN   : Orchestrator (Pro)  получает сводку → составляет план 8-12 слайдов.
  Phase 2 — ENRICH : Python              извлекает точные числа из AnalyticsSummary
                                          в структурированные поля SlideContent.
  Phase 3 — WRITE  : Writer (Flash)      получает план + данные → пишет текстовые поля.

Разделение ответственности:
  • LLM НИКОГДА не вычисляет числа — только формулирует выводы на основе готовых данных.
  • Python НИКОГДА не формулирует текст — только извлекает и форматирует числа.
  • Orchestrator (Pro) — планирование и структура.
  • Writer (Flash) — скорость, JSON mode, текст.

Модели выбираются динамически через discover_model_roles().
При сбое discovery — hardcoded fallback из gemini_models.py.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Optional

from app.core.config import settings
from app.core.gemini_client import GeminiAPIError, gemini_post
from app.core.gemini_models import (
    GeminiModel,
    GeminiTask,
    GEMINI_BASE_URL,
    get_generation_config,
    discover_model_roles,
)
from app.schemas.presentation import (
    AnomalyRecord,
    ChartData,
    ChartDataset,
    ComparisonRow,
    KeyMetricItem,
    NationalAvg,
    SlideContent,
    SlideType,
    YoYComparison,
)
from app.services.analytics_engine import AnalyticsSummary

logger = logging.getLogger(__name__)

FC_COLORS = ["#19286d", "#0068b4", "#00a6ca", "#296695", "#801e82"]


# ─────────────────────────────────────────────────────────────────────────────
# System prompts
# ─────────────────────────────────────────────────────────────────────────────

_SYSTEM_ORCHESTRATOR = """\
Ты — Orchestrator Agent системы генерации аналитических презентаций АО «Финансовый центр» (Казахстан).

Твоя задача: изучить статистические данные системы мониторинга образования и составить ПЛАН презентации.

ПРАВИЛА:
1. Количество слайдов: от 8 до 12.
2. Обязательный первый слайд: image_background (обложка).
3. Обязательный последний слайд: ai_recommendations.
4. Чередуй типы для визуального ритма: key_metrics → split_text_chart → dashboard_3_charts → comparison_table → anomalies_warning → rating_board.
5. Используй данные для выбора приоритетов: если много аномалий — посвяти им 2 слайда.
6. ЗАПРЕЩЕНО упоминать «МОН РК» или «Министерство» — только «АО "Финансовый центр"», «система мониторинга».
7. Язык eyebrow-меток: РУССКИЙ UPPERCASE.

ДОПУСТИМЫЕ ТИПЫ СЛАЙДОВ:
  image_background   — полноэкранная обложка
  key_metrics        — сетка KPI-карточек
  split_text_chart   — левая половина текст, правая половина график
  dashboard_3_charts — панель из 3 графиков
  comparison_table   — таблица сравнения регионов
  anomalies_warning  — таблица выявленных аномалий
  rating_board       — рейтинг организаций (горизонтальный bar-chart)
  ai_recommendations — стратегические рекомендации

ФОРМАТ ОТВЕТА — строгий JSON-массив объектов:
[
  {
    "slide_index": 1,
    "slide_type": "<тип из списка выше>",
    "eyebrow": "МЕТКА В UPPERCASE ИЛИ null",
    "title_hint": "Краткий концепт заголовка",
    "data_focus": ["aggregate", "regional_deltas", "anomalies", "rankings", "budget", "students", "employment"],
    "bg_style": "navy|gradient|white|purple"
  }
]

Верни ТОЛЬКО JSON-массив. Без markdown, без пояснений.
"""

_SYSTEM_WRITER = """\
Ты — Writer Agent системы аналитических презентаций АО «Финансовый центр» (Казахстан).

Тебе передан план презентации с уже вычисленными числовыми данными.
Твоя задача: написать ТОЛЬКО текстовые поля — title, subtitle, bullets.

СТРОГИЕ ПРАВИЛА:
1. Используй ТОЛЬКО числа из полей key_metrics, yoy_comparisons, chart_data, anomalies, comparison_rows.
2. НЕ изменяй и НЕ переписывай поля: slide_type, eyebrow, key_metrics, chart_data*, yoy_comparisons, national_avgs, comparison_rows, anomalies. Копируй их дословно.
3. Заголовок (title): точный, фактологический, до 90 символов.
4. Подзаголовок (subtitle): один ключевой инсайт в одном предложении, до 150 символов. Или null.
5. Bullets: 3-5 полных предложений с конкретными числами из данных. Без вводных слов «Таким образом,».
6. ЗАПРЕЩЕНО: «МОН РК», «Министерство», эмодзи, лозунги.
7. Язык: русский. Тон: деловой, аналитический.

ФОРМАТ ОТВЕТА — JSON-массив, где каждый объект:
{
  "slide_index": <число>,
  "title": "...",
  "subtitle": "...",
  "bullets": ["...", "...", "..."]
}

Верни ТОЛЬКО JSON-массив. Без markdown, без пояснений.
"""


# ─────────────────────────────────────────────────────────────────────────────
# Data enrichment  (Python — no LLM, deterministic)
# ─────────────────────────────────────────────────────────────────────────────

def _fmt_num(v: float, decimals: int = 0) -> str:
    """Format number with space thousands separator (ru-KZ style)."""
    if decimals == 0:
        return f"{int(round(v)):,}".replace(",", " ")   # non-breaking space
    return f"{v:,.{decimals}f}".replace(",", " ").replace(".", ",")


def _direction(delta: float) -> str:
    if delta > 1:   return "up"
    if delta < -1:  return "down"
    return "neutral"


def _enrich_slide(spec: dict, summary: AnalyticsSummary) -> dict:
    """
    Given an Orchestrator plan spec, attach pre-computed numerical data.
    Returns enriched spec dict; SlideContent is built after Writer adds text.
    """
    slide = dict(spec)
    slide_type = spec.get("slide_type", "")
    data_focus = spec.get("data_focus", [])
    agg = summary.aggregate_stats

    # ── image_background / title_slide ──────────────────────────────────────
    if slide_type in ("image_background", "title_slide"):
        slide["key_metrics"] = [
            {"label": "Организаций охвачено", "value": _fmt_num(agg.get("org_count", 0)),
             "unit": "орг.", "color": "cyan"},
            {"label": "Студентов", "value": _fmt_num(agg.get("total_students", 0)),
             "unit": "чел.", "color": "navy"},
        ]

    # ── key_metrics ──────────────────────────────────────────────────────────
    elif slide_type == "key_metrics":
        emp = agg.get("avg_employment_pct", 0) or 0
        slide["key_metrics"] = [
            {"label": "Организаций", "value": _fmt_num(agg.get("org_count", 0)),
             "unit": "орг.", "color": "navy"},
            {"label": "Студентов (итого)", "value": _fmt_num(agg.get("total_students", 0)),
             "unit": "чел.", "color": "cyan"},
            {"label": "Бюджет системы", "value": _fmt_num(agg.get("total_budget_mln", 0), 1),
             "unit": "млн ₸", "color": "navy"},
            {"label": "Трудоустройство 6м", "value": _fmt_num(emp, 1),
             "unit": "%", "direction": _direction(emp - 60), "color": "cyan"},
            {"label": "Публикации Scopus", "value": _fmt_num(agg.get("total_scopus", 0)),
             "unit": "ст.", "color": "purple"},
            {"label": "Доля ФОТ", "value": _fmt_num(agg.get("avg_payroll_pct", 0), 1),
             "unit": "%", "color": "navy"},
        ]

    # ── split_text_chart ─────────────────────────────────────────────────────
    elif slide_type == "split_text_chart":
        metric = "budget" if "budget" in data_focus else (
            "students" if "students" in data_focus else
            "employment" if "employment" in data_focus else "budget"
        )
        deltas = [d for d in summary.region_deltas if d.metric == metric
                  and d.value_curr is not None and d.value_prev is not None][:8]

        if deltas:
            divisor = 1_000_000 if metric == "budget" else 1
            unit = "млн ₸" if metric == "budget" else (
                "%" if metric == "employment" else "чел.")
            slide["chart_data"] = {
                "type": "bar",
                "labels": [d.region_name for d in deltas],
                "datasets": [
                    {"label": str(summary.period_year - 1),
                     "data": [round(d.value_prev / divisor, 1) for d in deltas],
                     "color": "#296695"},
                    {"label": str(summary.period_year),
                     "data": [round(d.value_curr / divisor, 1) for d in deltas],
                     "color": "#0068b4"},
                ],
                "unit": unit,
            }
            slide["yoy_comparisons"] = [
                {
                    "metric": metric, "label": d.region_name,
                    "current_year": summary.period_year,
                    "prev_year":    summary.period_year - 1,
                    "current_val":  round(d.value_curr / divisor, 1),
                    "prev_val":     round(d.value_prev / divisor, 1),
                    "delta_pct":    round(d.delta_pct or 0, 1),
                    "direction":    d.direction,
                    "unit":         unit,
                }
                for d in deltas[:5]
            ]

    # ── dashboard_3_charts ───────────────────────────────────────────────────
    elif slide_type == "dashboard_3_charts":
        bud = [d for d in summary.region_deltas if d.metric == "budget" and d.value_curr][:7]
        stu = [d for d in summary.region_deltas if d.metric == "students" and d.value_curr][:7]
        top = summary.rankings[:8]

        if bud:
            slide["chart_data"] = {
                "type": "bar",
                "labels": [d.region_name for d in bud],
                "datasets": [{"label": "Бюджет, млн ₸",
                              "data": [round(d.value_curr / 1_000_000, 1) for d in bud],
                              "color": "#19286d"}],
                "unit": "млн ₸",
            }
        if stu:
            slide["chart_data_2"] = {
                "type": "bar",
                "labels": [d.region_name for d in stu],
                "datasets": [{"label": "Студентов",
                              "data": [round(d.value_curr, 0) for d in stu],
                              "color": "#00a6ca"}],
                "unit": "чел.",
            }
        if top:
            slide["chart_data_3"] = {
                "type": "bar",
                "labels": [r.org_name[:20] for r in top],
                "datasets": [{"label": "Рейтинг, балл",
                              "data": [round(r.total_score, 1) for r in top],
                              "color": "#801e82"}],
                "unit": "балл",
            }

    # ── comparison_table ─────────────────────────────────────────────────────
    elif slide_type == "comparison_table":
        bud_map = {d.region_name: round(d.value_curr / 1_000_000, 1)
                   for d in summary.region_deltas if d.metric == "budget" and d.value_curr}
        stu_map = {d.region_name: round(d.value_curr, 0)
                   for d in summary.region_deltas if d.metric == "students" and d.value_curr}
        emp_map = {d.region_name: round(d.value_curr, 1)
                   for d in summary.region_deltas if d.metric == "employment" and d.value_curr}
        regions = sorted(set(list(bud_map) + list(stu_map)))[:12]

        avg_bud = (sum(bud_map.values()) / len(bud_map)) if bud_map else None
        avg_stu = (sum(stu_map.values()) / len(stu_map)) if stu_map else None
        avg_emp = (sum(emp_map.values()) / len(emp_map)) if emp_map else None

        rows = []
        for reg in regions:
            bv = bud_map.get(reg)
            sv = stu_map.get(reg)
            ev = emp_map.get(reg)
            rows.append({
                "name": reg,
                "values": [bv, sv, ev],
                "is_highlighted": False,
            })

        # Add national average as last highlighted row
        if avg_bud or avg_stu or avg_emp:
            rows.append({
                "name": "Среднее по системе",
                "values": [
                    round(avg_bud, 1) if avg_bud else None,
                    round(avg_stu, 0) if avg_stu else None,
                    round(avg_emp, 1) if avg_emp else None,
                ],
                "is_highlighted": True,
            })

        slide["comparison_cols"] = ["Регион", "Бюджет, млн ₸", "Студентов", "Трудоустройство, %"]
        slide["comparison_rows"] = rows

        # Also build national_avgs for the text
        avgs = []
        if avg_bud:
            avgs.append({"metric": "budget", "label": "Бюджет",
                         "scope_val": avg_bud, "national_avg": avg_bud,
                         "deviation_pct": 0.0, "unit": "млн ₸"})
        if avg_emp:
            avgs.append({"metric": "employment", "label": "Трудоустройство",
                         "scope_val": avg_emp, "national_avg": avg_emp,
                         "deviation_pct": 0.0, "unit": "%"})
        slide["national_avgs"] = avgs

    # ── anomalies_warning ────────────────────────────────────────────────────
    elif slide_type == "anomalies_warning":
        sorted_anoms = sorted(
            summary.anomalies,
            key=lambda x: {"high": 0, "medium": 1, "low": 2}[x.severity],
        )
        slide["anomalies"] = [
            {
                "org_name":    a.org_name,
                "field":       a.field,
                "period":      a.period,
                "value":       a.value,
                "expected":    round(a.expected, 2) if a.expected is not None else None,
                "deviation":   round(a.deviation, 1) if a.deviation is not None else None,
                "severity":    a.severity,
                "description": (
                    f"Отклонение {abs(a.deviation or 0):.1f}% от нормы"
                    if a.deviation is not None
                    else a.anomaly_type
                ),
            }
            for a in sorted_anoms[:15]
        ]

    # ── rating_board ──────────────────────────────────────────────────────────
    elif slide_type == "rating_board":
        top = summary.rankings[:10]
        if top:
            slide["chart_data"] = {
                "type": "bar",
                "labels": [r.org_name[:28] for r in top],
                "datasets": [{"label": "Итоговый балл",
                              "data": [round(r.total_score, 1) for r in top],
                              "color": "#19286d"}],
                "unit": "балл",
            }

    # ── ai_recommendations — only text, no numeric enrichment ────────────────
    # (Writer handles recommendations based on full context)

    return slide


# ─────────────────────────────────────────────────────────────────────────────
# HTTP helper
# ─────────────────────────────────────────────────────────────────────────────

async def _call_gemini(
    model: str,
    payload: dict,
    *,
    task_label: str,
    timeout: float = 180.0,
) -> str:
    """POST to Gemini generateContent, return raw text."""
    if not settings.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY не задан")

    url = GEMINI_BASE_URL.format(model=model)
    logger.info("Gemini call: task=%s model=%s", task_label, model)

    try:
        return await gemini_post(url, settings.GEMINI_API_KEY, payload, timeout=timeout)
    except GeminiAPIError as exc:
        raise RuntimeError(
            "Gemini API error [%s]: %s" % (task_label, exc)
        ) from exc


# ─────────────────────────────────────────────────────────────────────────────
# JSON parsing helpers
# ─────────────────────────────────────────────────────────────────────────────

def _safe_json(raw: str) -> Any:
    for text in [raw, raw.strip()]:
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
    # strip markdown fences
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        inner = lines[1:] if len(lines) > 1 else []
        if inner and inner[-1].strip() == "```":
            inner = inner[:-1]
        cleaned = "\n".join(inner)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    # extract first [...] or {...}
    for s, e in [("[", "]"), ("{", "}")]:
        start = cleaned.find(s)
        if start == -1:
            continue
        depth, in_str, esc = 0, False, False
        for i, ch in enumerate(cleaned[start:], start):
            if esc: esc = False; continue
            if ch == "\\" and in_str: esc = True; continue
            if ch == '"': in_str = not in_str; continue
            if in_str: continue
            if ch == s: depth += 1
            elif ch == e:
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(cleaned[start:i + 1])
                    except json.JSONDecodeError:
                        break
    raise RuntimeError("Невалидный JSON от Gemini (первые 300): %s" % raw[:300])


# ─────────────────────────────────────────────────────────────────────────────
# AgenticOrchestrator
# ─────────────────────────────────────────────────────────────────────────────

class AgenticOrchestrator:
    """
    Трёхфазный агент-оркестратор для генерации аналитических презентаций.

    Phase 1  PLAN  : Pro model   → 8-12 typed slide plan objects
    Phase 2  ENRICH: Python      → pre-computed numeric data per slide
    Phase 3  WRITE : Flash model → textual content (title/subtitle/bullets)
    Compile        : merge enriched data + text → list[SlideContent]
    """

    def __init__(self, timeout: float = 200.0):
        self._timeout = timeout

    # ── Public API ────────────────────────────────────────────────────────────

    async def generate_slides(
        self,
        summary: AnalyticsSummary,
        *,
        user_focus:    Optional[str] = None,
        org_name:      Optional[str] = None,
        region_name:   Optional[str] = None,
        org_type_name: Optional[str] = None,
    ) -> tuple[list[SlideContent], str]:
        """
        Returns (slides, models_used_str).
        models_used_str recorded in evaluation_reports.slides_json.
        """
        # Discover model roles (cached 1h)
        try:
            roles = await discover_model_roles(settings.GEMINI_API_KEY)
            orchestrator_model = roles.orchestrator
            writer_model       = roles.writer
            logger.info(
                "Roles assigned: orchestrator=%s writer=%s",
                orchestrator_model, writer_model,
            )
        except Exception as exc:
            logger.warning("Role discovery failed, using defaults: %s", exc)
            orchestrator_model = GeminiModel.PRO.value
            writer_model       = GeminiModel.FLASH.value

        compact = summary.to_compact_dict()
        context_str = self._build_context(
            compact, user_focus=user_focus,
            org_name=org_name, region_name=region_name, org_type_name=org_type_name,
        )

        # Phase 1: Plan
        plan = await self._phase_plan(context_str, orchestrator_model)
        logger.info("Plan: %d slides", len(plan))

        # Phase 2: Enrich with pre-computed data
        enriched = [_enrich_slide(spec, summary) for spec in plan]

        # Phase 3: Write text (title, subtitle, bullets)
        text_items = await self._phase_write(context_str, enriched, writer_model)

        # Compile
        slides = self._compile(enriched, text_items)

        models_used = f"{orchestrator_model} (plan) + {writer_model} (write)"
        return slides, models_used

    # ── Phase 1: Plan ─────────────────────────────────────────────────────────

    async def _phase_plan(self, context_str: str, model: str) -> list[dict]:
        gen_cfg = {
            "temperature":     0.4,
            "maxOutputTokens": 4096,
            "responseMimeType": "application/json",
        }
        payload = {
            "system_instruction": {"parts": [{"text": _SYSTEM_ORCHESTRATOR}]},
            "contents": [{"role": "user", "parts": [{"text": context_str}]}],
            "generationConfig": gen_cfg,
        }
        raw = await _call_gemini(model, payload, task_label="orchestrator-plan",
                                 timeout=self._timeout)
        plan = _safe_json(raw)
        if not isinstance(plan, list):
            raise RuntimeError("Orchestrator вернул не массив: %s" % type(plan).__name__)

        # Validate required keys and clamp to 8-12 slides
        valid = []
        for item in plan:
            if isinstance(item, dict) and "slide_type" in item and "slide_index" in item:
                valid.append(item)
        if not valid:
            raise RuntimeError("Orchestrator plan пуст после валидации")
        return valid[:12]

    # ── Phase 3: Write ────────────────────────────────────────────────────────

    async def _phase_write(
        self,
        context_str: str,
        enriched: list[dict],
        model: str,
    ) -> list[dict]:
        # Pass enriched specs as input (Writer copies numeric fields, writes text)
        specs_str = json.dumps(enriched, ensure_ascii=False, indent=2)
        writer_input = (
            f"АНАЛИТИЧЕСКИЙ КОНТЕКСТ:\n{context_str}\n\n"
            f"ПЛАН СЛАЙДОВ С ДАННЫМИ (заполни title, subtitle, bullets):\n{specs_str}"
        )

        gen_cfg = {
            "temperature":     0.3,
            "maxOutputTokens": 16384,
            "responseMimeType": "application/json",
            "thinkingConfig":  {"thinkingBudget": 0},   # Flash: thinking off for JSON
        }
        payload = {
            "system_instruction": {"parts": [{"text": _SYSTEM_WRITER}]},
            "contents": [{"role": "user", "parts": [{"text": writer_input}]}],
            "generationConfig": gen_cfg,
        }
        raw = await _call_gemini(model, payload, task_label="writer-text",
                                 timeout=self._timeout)
        result = _safe_json(raw)
        if not isinstance(result, list):
            logger.warning("Writer вернул не массив; пробуем обернуть")
            result = [result] if isinstance(result, dict) else []
        return result

    # ── Compile ────────────────────────────────────────────────────────────────

    def _compile(
        self,
        enriched: list[dict],
        text_items: list[dict],
    ) -> list[SlideContent]:
        """
        Merge enriched numeric data with Writer text.
        If Writer omits a slide, we use title_hint as fallback title.
        """
        text_by_idx: dict[int, dict] = {
            t.get("slide_index", i + 1): t
            for i, t in enumerate(text_items)
        }

        slides: list[SlideContent] = []
        for spec in enriched:
            idx = spec.get("slide_index", len(slides) + 1)
            text = text_by_idx.get(idx, {})

            merged: dict = {**spec}   # all enriched numeric data
            # Override with Writer text (only if non-empty)
            if text.get("title"):
                merged["title"] = text["title"]
            elif "title" not in merged or not merged.get("title"):
                merged["title"] = spec.get("title_hint", f"Слайд {idx}")

            if text.get("subtitle") is not None:
                merged["subtitle"] = text["subtitle"]

            if text.get("bullets"):
                merged["bullets"] = text["bullets"]
            elif "bullets" not in merged:
                merged["bullets"] = []

            # Remove planning-only keys not in SlideContent
            for k in ("slide_index", "data_focus", "title_hint"):
                merged.pop(k, None)

            try:
                slides.append(SlideContent.model_validate(merged))
            except Exception as exc:
                logger.warning("Slide %d validation error: %s", idx, exc)
                slides.append(_fallback_slide(idx, spec.get("slide_type", "metrics_comparison")))

        return slides

    # ── Context builder ────────────────────────────────────────────────────────

    def _build_context(
        self,
        compact: dict,
        *,
        user_focus:    Optional[str],
        org_name:      Optional[str],
        region_name:   Optional[str],
        org_type_name: Optional[str],
    ) -> str:
        scope_parts = []
        if org_name:      scope_parts.append("организация: " + org_name)
        if region_name:   scope_parts.append("регион: " + region_name)
        if org_type_name: scope_parts.append("тип: " + org_type_name)
        scope = "; ".join(scope_parts) if scope_parts else "вся система"
        focus = ("\nФОКУС АНАЛИЗА: " + user_focus) if user_focus else ""

        return (
            f"ГОД АНАЛИЗА: {compact['period_year']}\n"
            f"ОХВАТ: {scope}{focus}\n\n"
            "СТАТИСТИЧЕСКИЙ КОНТЕКСТ (предварительно вычислен DataAnalyzer):\n"
            + json.dumps(compact, ensure_ascii=False, indent=2)
        )


# ─────────────────────────────────────────────────────────────────────────────
# Fallback slide factory
# ─────────────────────────────────────────────────────────────────────────────

def _fallback_slide(index: int, slide_type_str: str = "metrics_comparison") -> SlideContent:
    try:
        stype = SlideType(slide_type_str)
    except ValueError:
        stype = SlideType.METRICS_COMPARISON
    return SlideContent(
        slide_type=stype,
        title=f"Слайд {index}",
        subtitle="Данные загружены",
        bullets=["Интерпретация временно недоступна. Проверьте логи сервиса."],
    )


# ─────────────────────────────────────────────────────────────────────────────
# Legacy alias for backward compatibility (imported in tasks.py)
# ─────────────────────────────────────────────────────────────────────────────

PresentationGenerator = AgenticOrchestrator
