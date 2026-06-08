"""crud/coefficients.py — CRUD + расчёт коэффициентов."""
from __future__ import annotations

from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.coefficients import (
    CoefficientDefinitionRead,
    CoefficientRecordCreate,
    CoefficientRecordRead,
    CoefficientScoreRead,
    OrgRatingEntry,
)


# ─────────────────────────────────────────────────────────────────────────────
# Формула расчёта
# ─────────────────────────────────────────────────────────────────────────────

def _calculate(formula_type: str, num: float, den: float) -> float:
    if formula_type == "ratio":
        return num / den if den != 0 else 0.0
    if formula_type == "percentage":
        return (num / den * 100) if den != 0 else 0.0
    if formula_type == "inverse":
        return 1.0 - (num / den) if den != 0 else 1.0
    if formula_type == "boolean":
        return 1.0 if num >= 1 else 0.0
    if formula_type == "growth":
        return (num - den) / den if den != 0 else 0.0
    return 0.0


def _status(value: float, norm_min, norm_max, norm_target, formula_type: str) -> str:
    if formula_type == "inverse":
        if value >= 0.98:  return "excellent"
        if value >= 0.90:  return "normal"
        if value >= 0.80:  return "warning"
        return "critical"

    if formula_type == "boolean":
        return "excellent" if value == 1.0 else "critical"

    if norm_target is not None:
        t = float(norm_target)
        if t == 0:
            return "excellent" if value == 0 else ("warning" if value <= 0.1 else "critical")
        diff = abs(value - t) / t
        if diff <= 0.05:  return "excellent"
        if diff <= 0.15:  return "normal"
        if diff <= 0.30:  return "warning"
        return "critical"

    if norm_min is not None and norm_max is not None:
        mn, mx = float(norm_min), float(norm_max)
        if mn <= value <= mx:  return "normal"
        if value < mn * 0.85 or value > mx * 1.15:  return "critical"
        return "warning"

    if norm_min is not None:
        mn = float(norm_min)
        if value >= mn * 1.10:  return "excellent"
        if value >= mn:         return "normal"
        if value >= mn * 0.80:  return "warning"
        return "critical"

    if norm_max is not None:
        mx = float(norm_max)
        if value <= mx * 0.80:  return "excellent"
        if value <= mx:         return "normal"
        if value <= mx * 1.20:  return "warning"
        return "critical"

    return "normal"


_STATUS_SCORE = {"excellent": 100, "normal": 75, "warning": 40, "critical": 0}

_PRINCIPLE_WEIGHTS = {
    "transparency":          0.25,
    "self_development":      0.25,
    "financial_stability":   0.25,
    "safety":                0.15,
    "investment_appeal":     0.10,
}


# ─────────────────────────────────────────────────────────────────────────────
# Definitions
# ─────────────────────────────────────────────────────────────────────────────

async def get_definitions(
    db: AsyncSession,
    education_level: Optional[str] = None,
    principle: Optional[str] = None,
) -> list[CoefficientDefinitionRead]:
    q = "SELECT * FROM coefficient_definitions WHERE is_active = TRUE"
    params: dict = {}
    if education_level:
        q += " AND education_level = :lvl"
        params["lvl"] = education_level
    if principle:
        q += " AND principle = :pr"
        params["pr"] = principle
    q += " ORDER BY education_level, principle, number"
    rows = (await db.execute(text(q), params)).mappings().all()
    return [CoefficientDefinitionRead.model_validate(dict(r)) for r in rows]


# ─────────────────────────────────────────────────────────────────────────────
# Records — upsert + calculate
# ─────────────────────────────────────────────────────────────────────────────

async def upsert_record(
    db: AsyncSession,
    data: CoefficientRecordCreate,
    user_id: UUID,
) -> CoefficientRecordRead:
    defn_row = (await db.execute(
        text("SELECT * FROM coefficient_definitions WHERE id = :id"),
        {"id": data.coeff_def_id},
    )).mappings().first()
    if not defn_row:
        raise ValueError(f"Coefficient definition {data.coeff_def_id} not found")

    num = float(data.numerator_value or 0)
    den = float(data.denominator_value or 0)
    coeff_val = _calculate(defn_row["formula_type"], num, den)
    st = _status(
        coeff_val,
        defn_row["norm_min"],
        defn_row["norm_max"],
        defn_row["norm_target"],
        defn_row["formula_type"],
    )

    row = (await db.execute(text("""
        INSERT INTO coefficient_records
            (org_id, coeff_def_id, period_year, period_quarter,
             numerator_value, denominator_value, coefficient_value,
             status, comment, submission_status,
             created_by, updated_by, created_at, updated_at)
        VALUES
            (:org_id, :coeff_def_id, :period_year, :period_quarter,
             :num, :den, :cv,
             :status, :comment, 'approved',
             :uid, :uid, NOW(), NOW())
        ON CONFLICT (org_id, coeff_def_id, period_year, period_quarter)
        DO UPDATE SET
            numerator_value   = EXCLUDED.numerator_value,
            denominator_value = EXCLUDED.denominator_value,
            coefficient_value = EXCLUDED.coefficient_value,
            status            = EXCLUDED.status,
            comment           = EXCLUDED.comment,
            updated_by        = EXCLUDED.updated_by,
            updated_at        = NOW(),
            version           = coefficient_records.version + 1
        RETURNING *
    """), {
        "org_id":       str(data.org_id),
        "coeff_def_id": data.coeff_def_id,
        "period_year":  data.period_year,
        "period_quarter": data.period_quarter,
        "num":          data.numerator_value,
        "den":          data.denominator_value,
        "cv":           round(coeff_val, 6),
        "status":       st,
        "comment":      data.comment,
        "uid":          str(user_id),
    })).mappings().first()

    await db.commit()

    defn = CoefficientDefinitionRead.model_validate(dict(defn_row))
    result = dict(row)
    result["definition"] = defn
    return CoefficientRecordRead.model_validate(result)


# ─────────────────────────────────────────────────────────────────────────────
# Get org records for a year
# ─────────────────────────────────────────────────────────────────────────────

async def get_org_records(
    db: AsyncSession,
    org_id: UUID,
    year: int,
    education_level: Optional[str] = None,
) -> list[CoefficientRecordRead]:
    q = """
        SELECT r.*, d.code, d.education_level, d.principle, d.number,
               d.name_ru, d.formula_text, d.formula_type,
               d.numerator_desc, d.denominator_desc,
               d.norm_min, d.norm_max, d.norm_target, d.is_active
        FROM coefficient_records r
        JOIN coefficient_definitions d ON d.id = r.coeff_def_id
        WHERE r.org_id = :org_id AND r.period_year = :year
    """
    params: dict = {"org_id": str(org_id), "year": year}
    if education_level:
        q += " AND d.education_level = :lvl"
        params["lvl"] = education_level
    q += " ORDER BY d.education_level, d.principle, d.number"
    rows = (await db.execute(text(q), params)).mappings().all()

    result = []
    for r in rows:
        d = dict(r)
        defn = CoefficientDefinitionRead.model_validate({
            "id": d["coeff_def_id"], "code": d["code"],
            "education_level": d["education_level"], "principle": d["principle"],
            "number": d["number"], "name_ru": d["name_ru"],
            "formula_text": d["formula_text"], "formula_type": d["formula_type"],
            "numerator_desc": d["numerator_desc"], "denominator_desc": d["denominator_desc"],
            "norm_min": d["norm_min"], "norm_max": d["norm_max"],
            "norm_target": d["norm_target"], "is_active": d["is_active"],
            "numerator_catalog_id": d.get("numerator_catalog_id"),
            "denominator_catalog_id": d.get("denominator_catalog_id"),
        })
        rec = CoefficientRecordRead.model_validate({**d, "definition": defn})
        result.append(rec)
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Calculate & save scores
# ─────────────────────────────────────────────────────────────────────────────

async def auto_calculate_records(
    db: AsyncSession,
    org_id: UUID,
    year: int,
    quarter: Optional[int] = None,
    user_id: Optional[UUID] = None,
) -> int:
    """
    Автоматически рассчитывает записи коэффициентов на основе данных из education_data.
    Ищет определения, где привязаны numerator_catalog_id / denominator_catalog_id.
    """
    # 1. Получаем все определения с маппингом
    q_defs = select(text("*")).select_from(text("coefficient_definitions")).where(
        text("(numerator_catalog_id IS NOT NULL OR denominator_catalog_id IS NOT NULL) AND is_active = TRUE")
    )
    defs = (await db.execute(q_defs)).mappings().all()
    if not defs:
        return 0

    # 2. Получаем актуальные данные из education_data для этой организации
    q_data = text("""
        SELECT catalog_field_id, value_numeric
        FROM education_data
        WHERE org_id = :org_id AND period_year = :year
    """)
    params = {"org_id": str(org_id), "year": year}
    if quarter:
        # Если данные помесячные, агрегируем за квартал? Или берем последний месяц квартала?
        # Для простоты пока считаем, что данные в education_data годовые (period_month IS NULL)
        q_data += " AND period_month IS NULL"
    
    data_rows = (await db.execute(q_data, params)).all()
    val_map = {r.catalog_field_id: float(r.value_numeric or 0) for r in data_rows}

    count = 0
    for d in defs:
        num_id = d["numerator_catalog_id"]
        den_id = d["denominator_catalog_id"]
        
        # Если маппинг есть, но данных нет — используем 0 или пропускаем?
        # В ФЦ принято использовать 0 если данных нет.
        num_val = val_map.get(num_id, 0.0) if num_id else 0.0
        den_val = val_map.get(den_id, 0.0) if den_id else 0.0
        
        # Если это boolean или просто наличие данных, num_val может быть 1
        
        await upsert_record(
            db,
            CoefficientRecordCreate(
                org_id=org_id,
                coeff_def_id=d["id"],
                period_year=year,
                period_quarter=quarter,
                numerator_value=Decimal(str(num_val)),
                denominator_value=Decimal(str(den_val)),
                comment="Автоматический расчёт из каталога данных"
            ),
            user_id or UUID("00000000-0000-0000-0000-000000000000") # System user
        )
        count += 1
    
    return count


async def calculate_scores(
    db: AsyncSession,
    org_id: UUID,
    year: int,
    education_level: str,
) -> CoefficientScoreRead:
    rows = (await db.execute(text("""
        SELECT d.principle, r.status
        FROM coefficient_records r
        JOIN coefficient_definitions d ON d.id = r.coeff_def_id
        WHERE r.org_id = :org_id AND r.period_year = :year
          AND d.education_level = :lvl AND d.is_active = TRUE
    """), {"org_id": str(org_id), "year": year, "lvl": education_level})).all()

    # Group scores by principle
    buckets: dict[str, list[int]] = {p: [] for p in _PRINCIPLE_WEIGHTS}
    for principle, status in rows:
        if principle in buckets:
            buckets[principle].append(_STATUS_SCORE.get(status, 0))

    def avg(lst):
        return round(sum(lst) / len(lst), 2) if lst else None

    scores = {p: avg(v) for p, v in buckets.items()}

    # Weighted total
    filled = [(p, v) for p, v in scores.items() if v is not None]
    if filled:
        weight_sum = sum(_PRINCIPLE_WEIGHTS[p] for p, _ in filled)
        total = round(sum(_PRINCIPLE_WEIGHTS[p] * v for p, v in filled) / weight_sum, 2)
    else:
        total = None

    # Rating category
    if total is None:
        category = None
    elif total >= 85:
        category = "A"
    elif total >= 70:
        category = "B"
    elif total >= 50:
        category = "C"
    else:
        category = "D"

    row = (await db.execute(text("""
        INSERT INTO coefficient_scores
            (org_id, education_level, period_year,
             score_transparency, score_self_development,
             score_financial_stability, score_safety,
             score_investment_appeal, total_score, rating_category,
             calculated_at)
        VALUES
            (:org_id, :lvl, :year,
             :tr, :sd, :fs, :sa, :ia, :total, :cat, NOW())
        ON CONFLICT (org_id, education_level, period_year)
        DO UPDATE SET
            score_transparency        = EXCLUDED.score_transparency,
            score_self_development    = EXCLUDED.score_self_development,
            score_financial_stability = EXCLUDED.score_financial_stability,
            score_safety              = EXCLUDED.score_safety,
            score_investment_appeal   = EXCLUDED.score_investment_appeal,
            total_score               = EXCLUDED.total_score,
            rating_category           = EXCLUDED.rating_category,
            calculated_at             = NOW()
        RETURNING *
    """), {
        "org_id": str(org_id), "lvl": education_level, "year": year,
        "tr":  scores.get("transparency"),
        "sd":  scores.get("self_development"),
        "fs":  scores.get("financial_stability"),
        "sa":  scores.get("safety"),
        "ia":  scores.get("investment_appeal"),
        "total": total, "cat": category,
    })).mappings().first()

    await db.commit()
    return CoefficientScoreRead.model_validate(dict(row))


# ─────────────────────────────────────────────────────────────────────────────
# Get scores
# ─────────────────────────────────────────────────────────────────────────────

async def get_org_scores(
    db: AsyncSession,
    org_id: UUID,
    year: int,
) -> list[CoefficientScoreRead]:
    rows = (await db.execute(text("""
        SELECT * FROM coefficient_scores
        WHERE org_id = :org_id AND period_year = :year
        ORDER BY education_level
    """), {"org_id": str(org_id), "year": year})).mappings().all()
    return [CoefficientScoreRead.model_validate(dict(r)) for r in rows]


# ─────────────────────────────────────────────────────────────────────────────
# Ratings for a year (all orgs)
# ─────────────────────────────────────────────────────────────────────────────

async def get_ratings(
    db: AsyncSession,
    year: int,
    education_level: Optional[str] = None,
    region_id: Optional[int] = None,
) -> list[OrgRatingEntry]:
    q = """
        SELECT cs.org_id, o.name_ru AS org_name,
               o.region_id, r.name_ru AS region_name_ru,
               cs.education_level, cs.period_year,
               cs.total_score, cs.rating_category,
               cs.score_transparency, cs.score_self_development,
               cs.score_financial_stability, cs.score_safety,
               cs.score_investment_appeal,
               prev.total_score AS prev_total_score
        FROM coefficient_scores cs
        JOIN organizations o ON o.id = cs.org_id
        LEFT JOIN regions r ON r.id = o.region_id
        LEFT JOIN coefficient_scores prev
               ON prev.org_id = cs.org_id
              AND prev.education_level = cs.education_level
              AND prev.period_year = cs.period_year - 1
        WHERE cs.period_year = :year
    """
    params: dict = {"year": year}
    if education_level:
        q += " AND cs.education_level = :lvl"
        params["lvl"] = education_level
    if region_id:
        q += " AND o.region_id = :region_id"
        params["region_id"] = region_id
    q += " ORDER BY cs.total_score DESC NULLS LAST"
    rows = (await db.execute(text(q), params)).mappings().all()
    return [OrgRatingEntry.model_validate(dict(r)) for r in rows]
