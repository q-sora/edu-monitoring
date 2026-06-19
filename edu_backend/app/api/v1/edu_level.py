# edu_backend/app/api/v1/edu_level.py
from __future__ import annotations

import logging
import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy import text

from app.api.dependencies import (
    ReadDBSession,
    TokenPayload,
    verify_token,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/edu-level", tags=["Education Level"])


@router.get("/{level}/stats", summary="Аналитика и рейтинг по уровню образования")
async def get_edu_level_stats(
    db: ReadDBSession,
    level: str = Path(..., description="Уровень образования (do, so, dopo, tippo, vipo)"),
    period_year: Optional[int] = Query(None, description="Год оценки"),
    _token: TokenPayload = Depends(verify_token),
) -> dict:
    if level not in ("do", "so", "dopo", "tippo", "vipo"):
        raise HTTPException(
            status_code=422,
            detail=f"Invalid level '{level}'. Must be one of: do, so, dopo, tippo, vipo"
        )

    # 1. Определяем год по умолчанию, если не передан
    if period_year is None:
        year_query = text("""
            SELECT MAX(period_year) 
            FROM org_indicator_assessments 
            WHERE edu_level = :level
        """)
        res = await db.execute(year_query, {"level": level})
        period_year = res.scalar()

        if period_year is None:
            # Если данных нет вообще, возвращаем пустую структуру
            return {
                "period_year": None,
                "edu_level": level,
                "summary": {
                    "org_count": 0,
                    "avg_score": 0.0,
                    "zones": {"green": 0, "yellow": 0, "red": 0}
                },
                "blocks": [],
                "orgs": []
            }

    # 2. Выполняем основной запрос с джоином к организациям
    query = text("""
        SELECT
            o.id,
            o.name_ru,
            o.region_id,
            oia.total_score,
            oia.zone,
            oia.scores_json,
            oia.period_year
        FROM org_indicator_assessments oia
        JOIN organizations o ON o.id = oia.org_id
        WHERE oia.edu_level = :level
          AND oia.period_year = :year
          AND o.status = 'active'
        ORDER BY oia.total_score DESC
    """)
    res = await db.execute(query, {"level": level, "year": period_year})
    rows = res.mappings().all()

    org_count = len(rows)
    if org_count == 0:
        return {
            "period_year": period_year,
            "edu_level": level,
            "summary": {
                "org_count": 0,
                "avg_score": 0.0,
                "zones": {"green": 0, "yellow": 0, "red": 0}
            },
            "blocks": [],
            "orgs": []
        }

    # 3. Расчет summary
    total_scores_sum = sum(float(r["total_score"]) for r in rows)
    avg_score = round(total_scores_sum / org_count, 1)

    zones_count = {"green": 0, "yellow": 0, "red": 0}
    for r in rows:
        z = r["zone"]
        if z in zones_count:
            zones_count[z] += 1

    # 4. Расчет блоков по scores_json
    first_scores_json = rows[0]["scores_json"]
    if isinstance(first_scores_json, str):
        try:
            first_scores_json = json.loads(first_scores_json)
        except Exception:
            first_scores_json = {}

    # Получаем отсортированные ключи блоков: block_1, block_2, ...
    block_keys = sorted([k for k in first_scores_json.keys() if k.startswith("block_")])
    blocks_data = []

    for b_key in block_keys:
        b_info = first_scores_json[b_key]
        title = b_info.get("title", "")
        weight = b_info.get("weight") or b_info.get("max_score") or 1

        # Считаем среднее для конкретного блока
        block_scores = []
        for r in rows:
            s_json = r["scores_json"]
            if isinstance(s_json, str):
                try:
                    s_json = json.loads(s_json)
                except Exception:
                    s_json = {}
            b_score = float(s_json.get(b_key, {}).get("score", 0.0))
            block_scores.append(b_score)

        b_avg = round(sum(block_scores) / org_count, 1)
        b_pct = round((b_avg / weight) * 100, 1) if weight > 0 else 0.0

        blocks_data.append({
            "id": b_key,
            "title": title,
            "weight": weight,
            "avg_score": b_avg,
            "avg_pct": b_pct
        })

    # 5. Формирование списка организаций
    orgs_list = []
    for r in rows:
        s_json = r["scores_json"]
        if isinstance(s_json, str):
            try:
                s_json = json.loads(s_json)
            except Exception:
                s_json = {}

        block_scores = {}
        for b_key in block_keys:
            block_scores[b_key] = float(s_json.get(b_key, {}).get("score", 0.0))

        orgs_list.append({
            "id": str(r["id"]),
            "name": r["name_ru"],
            "total_score": float(r["total_score"]),
            "zone": r["zone"],
            "block_scores": block_scores
        })

    return {
        "period_year": period_year,
        "edu_level": level,
        "summary": {
            "org_count": org_count,
            "avg_score": avg_score,
            "zones": zones_count
        },
        "blocks": blocks_data,
        "orgs": orgs_list
    }
