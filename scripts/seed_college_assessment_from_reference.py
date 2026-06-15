from __future__ import annotations

import asyncio
import json
import re
import sys
from pathlib import Path
from typing import Any

from sqlalchemy import text

ROOT = Path(__file__).resolve().parents[1]
REFERENCE_FILE = ROOT / "_reference" / "dirty_layout.html"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import api  # noqa: E402


def extract_astana_data() -> list[dict[str, Any]]:
    source = REFERENCE_FILE.read_text(encoding="utf-8")
    marker = "const ASTANA_DATA="
    start = source.index(marker) + len(marker)
    end = source.index(";\n", start)
    return json.loads(source[start:end])


def split_specialty(raw: str) -> tuple[str | None, str]:
    cleaned = re.sub(r"^\s*\d+\.\s*", "", raw).strip()
    match = re.match(r"^(\d{6,10})\s*[–—-]\s*[«\"]?(.+)$", cleaned)
    if not match:
        return None, cleaned
    return match.group(1), match.group(2).strip(" ;.«»\"")


async def seed(period_year: int = 2024) -> dict[str, int]:
    await api.ensure_local_schema()
    records = extract_astana_data()
    colleges = 0
    specialties = 0

    async with api.engine.begin() as conn:
        for item in records:
            result = await conn.execute(
                text("""
                    INSERT INTO college_assessment (
                        college_id_source,
                        region,
                        district,
                        college_name,
                        ownership_form,
                        location_type,
                        period_year,
                        source_file,
                        total_score
                    ) VALUES (
                        :college_id_source,
                        :region,
                        :district,
                        :college_name,
                        :ownership_form,
                        :location_type,
                        :period_year,
                        :source_file,
                        :total_score
                    )
                    ON CONFLICT (college_name, region, period_year)
                    DO UPDATE SET
                        college_id_source = EXCLUDED.college_id_source,
                        district = EXCLUDED.district,
                        ownership_form = EXCLUDED.ownership_form,
                        location_type = EXCLUDED.location_type,
                        source_file = EXCLUDED.source_file,
                        total_score = EXCLUDED.total_score,
                        imported_at = NOW()
                    RETURNING id
                """),
                {
                    "college_id_source": int(item["id"]) if str(item.get("id", "")).isdigit() else None,
                    "region": "Астана",
                    "district": item.get("district"),
                    "college_name": item["name"],
                    "ownership_form": item.get("ownership"),
                    "location_type": item.get("territory"),
                    "period_year": period_year,
                    "source_file": str(REFERENCE_FILE.relative_to(ROOT)),
                    "total_score": item.get("score"),
                },
            )
            assessment_id = result.scalar_one()
            colleges += 1

            await conn.execute(
                text("DELETE FROM college_assessment_specialty WHERE assessment_id = :id"),
                {"id": assessment_id},
            )
            for spec in item.get("specs", []):
                raw = spec.get("name")
                if not raw:
                    continue
                code, name = split_specialty(raw)
                await conn.execute(
                    text("""
                        INSERT INTO college_assessment_specialty (
                            assessment_id,
                            specialty_raw,
                            specialty_code,
                            specialty_name,
                            specialty_score
                        ) VALUES (
                            :assessment_id,
                            :specialty_raw,
                            :specialty_code,
                            :specialty_name,
                            :specialty_score
                        )
                    """),
                    {
                        "assessment_id": assessment_id,
                        "specialty_raw": raw,
                        "specialty_code": code,
                        "specialty_name": name,
                        "specialty_score": spec.get("score"),
                    },
                )
                specialties += 1

    await api.engine.dispose()
    return {"colleges": colleges, "specialties": specialties}


if __name__ == "__main__":
    year = int(sys.argv[1]) if len(sys.argv) > 1 else 2024
    print(asyncio.run(seed(year)))
