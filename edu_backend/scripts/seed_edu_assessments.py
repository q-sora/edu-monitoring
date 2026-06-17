"""
scripts/seed_edu_assessments.py
──────────────────────────────────────────────────────────────────────────────
Генерация симулированных оценок организаций по индикаторной модели.

Для каждой организации в БД (по уровням ДО/ДопО/СО/ТиПО/ВиПО) создаётся
запись в org_indicator_assessments с:
  - total_score (0–100)
  - zone        (вычисляется БД автоматически: green/yellow/red)
  - scores_json (баллы по 4 блокам + детализация по индикаторам)

Распределение по зонам (реалистичное):
  ~35% зелёных (70–100), ~40% жёлтых (40–69), ~25% красных (0–39)

Запуск:
    docker compose exec api python -m scripts.seed_edu_assessments
    docker compose exec api python -m scripts.seed_edu_assessments --year 2026
    docker compose exec api python -m scripts.seed_edu_assessments --clear
"""
from __future__ import annotations

import argparse
import asyncio
import os
import random
import sys
from decimal import Decimal

from sqlalchemy import text

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import engine_write, init_db

# ─────────────────────────────────────────────────────────────────────────────
# Конфигурация блоков по уровням (id, max_weight, кол-во индикаторов)
# Соответствует BLOCKS_DATA во фронтенде
# ─────────────────────────────────────────────────────────────────────────────

LEVEL_BLOCKS: dict[str, list[dict]] = {
    "do": [  # ДДО — PreschoolPage
        {"id": "block_1", "title": "Условия развития и безопасность",          "weight": 25, "indicators": 8},
        {"id": "block_2", "title": "Кадровый потенциал",                        "weight": 22, "indicators": 7},
        {"id": "block_3", "title": "Образовательные результаты и готовность",   "weight": 30, "indicators": 4},
        {"id": "block_4", "title": "Управление и прозрачность",                 "weight": 15, "indicators": 4},
    ],
    "dopo": [  # Доп. образование — DopoPage
        {"id": "block_1", "title": "Условия и доступность",                     "weight": 20, "indicators": 7},
        {"id": "block_2", "title": "Педагогический состав",                     "weight": 22, "indicators": 6},
        {"id": "block_3", "title": "Результаты и качество",                     "weight": 28, "indicators": 6},
        {"id": "block_4", "title": "Управление и финансовая прозрачность",      "weight": 22, "indicators": 7},
    ],
    "so": [  # Школы — SchoolPage
        {"id": "block_1", "title": "Инфраструктура и безопасность",             "weight": 22, "indicators": 8},
        {"id": "block_2", "title": "Кадровое обеспечение",                      "weight": 22, "indicators": 7},
        {"id": "block_3", "title": "Образовательные результаты (Value-Added)",  "weight": 40, "indicators": 7},
        {"id": "block_4", "title": "Управление и партнёрство",                  "weight": 18, "indicators": 6},
    ],
    "tippo": [  # ТиПО — TippoPage
        {"id": "block_1", "title": "Инфраструктура и ресурсы",                  "weight": 14, "indicators": 10},
        {"id": "block_2", "title": "Кадровое обеспечение",                      "weight": 25, "indicators": 13},
        {"id": "block_3", "title": "Результаты по специальности",               "weight": 30, "indicators": 13},
        {"id": "block_4", "title": "Партнёрство и трудоустройство",             "weight": 12, "indicators": 4},
    ],
    "vipo": [  # ОВПО — VipoPage
        {"id": "block_1", "title": "Инфраструктура и цифровизация",             "weight": 18, "indicators": 7},
        {"id": "block_2", "title": "Кадровый потенциал и наука",                "weight": 25, "indicators": 7},
        {"id": "block_3", "title": "Образовательные результаты",                "weight": 32, "indicators": 7},
        {"id": "block_4", "title": "Трудоустройство и взаимодействие с экономикой", "weight": 25, "indicators": 4},
    ],
}

# org_type_id → edu_level
ORG_TYPE_TO_LEVEL = {1: "do", 2: "dopo", 3: "so", 4: "tippo", 5: "vipo"}

# Реалистичное распределение зон: (вес, диапазон баллов)
ZONE_DIST = [
    (0.35, (70, 100)),   # зелёная — сильные
    (0.40, (40, 69)),    # жёлтая  — средние
    (0.25, (0,  39)),    # красная — слабые
]


def _pick_total_score() -> float:
    r = random.random()
    cumulative = 0.0
    for weight, (lo, hi) in ZONE_DIST:
        cumulative += weight
        if r <= cumulative:
            return round(random.uniform(lo, hi), 2)
    return round(random.uniform(40, 69), 2)


def _generate_scores_json(level: str, total_score: float) -> dict:
    """
    Генерирует scores_json: разбивает total_score по блокам пропорционально весам,
    добавляет небольшой шум, и детализирует по индикаторам внутри каждого блока.
    """
    blocks = LEVEL_BLOCKS[level]
    total_weight = sum(b["weight"] for b in blocks)

    result = {}
    remaining_score = total_score

    for i, block in enumerate(blocks):
        is_last = (i == len(blocks) - 1)
        weight_pct = block["weight"] / total_weight

        if is_last:
            block_score = round(remaining_score, 2)
        else:
            # Добавляем шум ±10% от ожидаемого значения блока
            expected = total_score * weight_pct
            noise = random.uniform(-0.10, 0.10) * expected
            block_score = round(max(0, min(100, expected + noise)), 2)
            remaining_score -= block_score

        # Детализация по индикаторам
        indicators = {}
        n = block["indicators"]
        ind_remaining = block_score
        for j in range(n):
            is_last_ind = (j == n - 1)
            if is_last_ind:
                ind_score = round(max(0, ind_remaining), 2)
            else:
                expected_ind = block_score / n
                noise_ind = random.uniform(-0.15, 0.15) * expected_ind
                ind_score = round(max(0, min(100, expected_ind + noise_ind)), 2)
                ind_remaining -= ind_score
            indicators[f"ind_{j+1}"] = ind_score

        result[block["id"]] = {
            "title":      block["title"],
            "score":      block_score,
            "max_score":  block["weight"],
            "weight":     block["weight"],
            "indicators": indicators,
        }

    return result


async def main() -> None:
    args = _parse_args()
    await init_db()

    async with engine_write.begin() as conn:
        if args.clear:
            await conn.execute(text("DELETE FROM org_indicator_assessments"))
            print("[INFO] Таблица очищена.")

        # Получаем все организации с типом 1-5
        rows = (await conn.execute(
            text("""
                SELECT id, name_ru, org_type_id
                FROM organizations
                WHERE org_type_id BETWEEN 1 AND 5
                  AND status = 'active'
                ORDER BY org_type_id, name_ru
            """)
        )).mappings().all()

        if not rows:
            print("[WARN] Нет активных организаций с типом 1–5 в БД.")
            return

        created = 0
        skipped = 0

        for row in rows:
            level = ORG_TYPE_TO_LEVEL.get(row["org_type_id"])
            if not level:
                continue

            total_score = _pick_total_score()
            scores_json = _generate_scores_json(level, total_score)

            sp = f"sp_{created + skipped}"
            try:
                await conn.execute(text(f"SAVEPOINT {sp}"))
                await conn.execute(
                    text("""
                        INSERT INTO org_indicator_assessments
                            (org_id, edu_level, period_year, total_score, scores_json)
                        VALUES
                            (CAST(:org_id AS uuid), :level, :year,
                             :score, CAST(:scores AS jsonb))
                        ON CONFLICT (org_id, period_year)
                        DO UPDATE SET
                            total_score  = EXCLUDED.total_score,
                            scores_json  = EXCLUDED.scores_json,
                            updated_at   = now()
                    """),
                    {
                        "org_id": str(row["id"]),
                        "level":  level,
                        "year":   args.year,
                        "score":  str(total_score),
                        "scores": __import__("json").dumps(scores_json, ensure_ascii=False),
                    },
                )
                await conn.execute(text(f"RELEASE SAVEPOINT {sp}"))
                created += 1
            except Exception as exc:
                await conn.execute(text(f"ROLLBACK TO SAVEPOINT {sp}"))
                skipped += 1
                print(f"[WARN] {row['name_ru']}: {exc}", file=sys.stderr)

        # Итоговая статистика по зонам
        stats = (await conn.execute(
            text("""
                SELECT edu_level, zone, COUNT(*) AS cnt
                FROM org_indicator_assessments
                WHERE period_year = :year
                GROUP BY edu_level, zone
                ORDER BY edu_level, zone
            """),
            {"year": args.year},
        )).mappings().all()

    print(f"\n[DONE] Создано/обновлено: {created} | Ошибок: {skipped}")
    print(f"\nРаспределение по зонам (год {args.year}):")
    print(f"  {'Уровень':<8} {'Зона':<8} {'Кол-во':>8}")
    print(f"  {'-'*26}")
    for s in stats:
        print(f"  {s['edu_level']:<8} {s['zone']:<8} {s['cnt']:>8}")


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Seed edu-level indicator assessment data")
    p.add_argument("--year",  type=int, default=2026, help="Год оценки (default: 2026)")
    p.add_argument("--clear", action="store_true",   help="Очистить таблицу перед вставкой")
    return p.parse_args()


if __name__ == "__main__":
    asyncio.run(main())
