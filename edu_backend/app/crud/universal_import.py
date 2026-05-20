"""Универсальный импортёр Excel с маппингом на data_catalog."""
from __future__ import annotations
import io
import json
from typing import Optional
import pandas as pd
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

try:
    from rapidfuzz import fuzz as _fuzz
    def _fuzzy_score(a: str, b: str) -> int:
        return _fuzz.token_set_ratio(a, b)
except ImportError:
    # Если rapidfuzz не установлен — авто-маппинг недоступен, ручной работает
    def _fuzzy_score(a: str, b: str) -> int:  # type: ignore[misc]
        return 0


async def preview_excel(
    file_bytes: bytes,
    filename: str,
    db: AsyncSession,
    education_level: Optional[str] = None,
) -> dict:
    """Читает Excel, возвращает превью + предлагаемые маппинги."""
    df = pd.read_excel(io.BytesIO(file_bytes), header=0, dtype=str, nrows=200)
    columns = [str(c).strip() for c in df.columns]
    sample = df.head(5).fillna("").to_dict(orient="records")

    params: dict = {}
    if education_level:
        where = "WHERE education_level = :lvl AND is_active = TRUE"
        params["lvl"] = education_level
    else:
        where = "WHERE is_active = TRUE"

    rows = await db.execute(text(f"""
        SELECT id, education_level, section_slug, field_name, field_slug
        FROM data_catalog {where}
    """), params)
    catalog_fields = [dict(r._mapping) for r in rows.fetchall()]

    suggested = []
    for col in columns:
        if not col or col.lower().startswith("unnamed"):
            continue
        best = None
        best_score = 0
        for cf in catalog_fields:
            score = _fuzzy_score(col.lower(), cf["field_name"].lower())
            if score > best_score and score >= 70:
                best_score = score
                best = cf
        if best:
            suggested.append({
                "excel_column":       col,
                "catalog_field_id":   best["id"],
                "catalog_field_name": best["field_name"],
                "match_score":        best_score,
                "value_type":         "numeric",
            })

    return {
        "filename":          filename,
        "total_rows":        len(df),
        "columns":           columns,
        "sample_rows":       sample,
        "suggested_mappings": suggested,
    }


async def import_with_mapping(
    db: AsyncSession,
    file_bytes: bytes,
    filename: str,
    mappings: list[dict],
    period_year: int,
    period_month: Optional[int],
    org_column: Optional[str],
    user_id: Optional[str] = None,
) -> dict:
    """Импортирует Excel по заданному маппингу."""
    df = pd.read_excel(io.BytesIO(file_bytes), dtype=str)

    bin_to_org: dict[str, str] = {}
    if org_column:
        bin_rows = await db.execute(text(
            "SELECT id, bin_iin, name_ru FROM organizations"
        ))
        for r in bin_rows.fetchall():
            if r.bin_iin:
                bin_to_org[str(r.bin_iin).strip()] = str(r.id)
            if r.name_ru:
                bin_to_org[r.name_ru.lower().strip()] = str(r.id)

    inserted = 0
    skipped = 0
    matched_orgs = 0
    errors: list[str] = []

    for idx, row in df.iterrows():
        org_id: Optional[str] = None

        if org_column and org_column in df.columns:
            raw_val = str(row[org_column]).strip()
            # BIN может прийти как «123456789012.0»
            clean_val = raw_val.replace(".0", "") if raw_val.endswith(".0") else raw_val
            org_id = bin_to_org.get(clean_val) or bin_to_org.get(clean_val.lower())
            if org_id:
                matched_orgs += 1
            else:
                errors.append(f"Строка {int(idx)+2}: организация '{raw_val}' не найдена")
                skipped += 1
                continue

        if not org_id:
            skipped += 1
            continue

        for m in mappings:
            col = m["excel_column"]
            field_id = m["catalog_field_id"]
            vtype = m.get("value_type", "numeric")

            if col not in df.columns:
                continue
            raw = row[col]
            if pd.isna(raw) or str(raw).strip() == "":
                continue

            v_num = None
            v_text = None
            v_jsonb = None

            try:
                if vtype == "numeric":
                    v_num = float(str(raw).replace(",", ".").replace(" ", "").replace(" ", ""))
                elif vtype == "text":
                    v_text = str(raw)
                elif vtype == "jsonb":
                    v_jsonb = json.dumps(raw) if not isinstance(raw, str) else raw
            except (ValueError, TypeError):
                v_text = str(raw)

            try:
                await db.execute(text("""
                    INSERT INTO education_data (
                        org_id, catalog_field_id, period_year, period_month,
                        value_numeric, value_text, value_jsonb,
                        source_file, imported_from, created_by, updated_by
                    ) VALUES (
                        :org_id, :field_id, :year, :month,
                        :v_num, :v_text, CAST(:v_jsonb AS jsonb),
                        :src, 'excel', :user_id, :user_id
                    )
                    ON CONFLICT (org_id, catalog_field_id, period_year, period_month)
                    DO UPDATE SET
                        value_numeric = EXCLUDED.value_numeric,
                        value_text    = EXCLUDED.value_text,
                        value_jsonb   = EXCLUDED.value_jsonb,
                        source_file   = EXCLUDED.source_file,
                        updated_at    = NOW(),
                        updated_by    = EXCLUDED.updated_by,
                        version       = education_data.version + 1
                """), {
                    "org_id":   org_id,
                    "field_id": field_id,
                    "year":     period_year,
                    "month":    period_month,
                    "v_num":    v_num,
                    "v_text":   v_text,
                    "v_jsonb":  v_jsonb,
                    "src":      filename,
                    "user_id":  user_id,
                })
                inserted += 1
            except Exception as e:
                errors.append(f"Строка {int(idx)+2}, поле {col}: {e}")
                skipped += 1

    await db.commit()

    return {
        "filename":        filename,
        "total_rows":      len(df),
        "inserted_values": inserted,
        "skipped":         skipped,
        "matched_orgs":    matched_orgs,
        "errors":          errors[:30],
    }
