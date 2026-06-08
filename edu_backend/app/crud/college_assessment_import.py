"""Parser and importer for college effectiveness assessment Excel files (ТиППО)."""
import io
import logging
import re
from typing import Any, Optional

import pandas as pd
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


def _extract_year(filename: str) -> Optional[int]:
    m = re.search(r"(20\d{2})", filename)
    return int(m[1]) if m else None


def _to_float(v: Any) -> Optional[float]:
    if v is None:
        return None
    s = str(v).strip().replace(",", ".").replace(" ", "").replace("–", "").replace("—", "")
    if s in ("", "nan", "None", "нет", "Нет", "#ДЕЛ/0!", "#DIV/0!"):
        return None
    try:
        return float(s)
    except (ValueError, TypeError):
        return None


def _to_int(v: Any) -> Optional[int]:
    f = _to_float(v)
    return int(round(f)) if f is not None else None


def _to_bool(v: Any) -> Optional[bool]:
    if v is None or (isinstance(v, float) and str(v) == "nan"):
        return None
    s = str(v).strip().lower()
    if s in ("да", "yes", "1", "true"):
        return True
    if s in ("нет", "no", "0", "false"):
        return False
    return None


def _extract_specialty_code(raw: str) -> tuple[str, str]:
    if not raw:
        return "", raw
    m = re.match(r"^(\d{8})\s*[–—-]\s*[«»]?(.+?)[«»]?\s*$", raw.strip())
    if m:
        return m[1].strip(), m[2].strip("«»«» '\"").strip()
    return "", raw.strip()


def _get(row: list, col_idx: int, as_type: str = "float") -> Any:
    if col_idx >= len(row):
        return None
    v = row[col_idx]
    if as_type == "float":
        return _to_float(v)
    if as_type == "int":
        return _to_int(v)
    if as_type == "bool":
        return _to_bool(v)
    if as_type == "str":
        s = str(v).strip() if v is not None and str(v).strip() not in ("nan", "None", "") else None
        return s
    return v


async def parse_and_import_college_assessment(
    db: AsyncSession,
    file_bytes: bytes,
    filename: str,
    period_year: Optional[int] = None,
    user_id: Optional[str] = None,
) -> dict:
    """
    Main import function. Reads an Excel file with two-level structure:
    - College rows: col[46] (Specialty) is empty
    - Specialty rows: col[46] is filled

    Returns stats: colleges/specialties inserted/updated/skipped/errors.
    """
    if period_year is None:
        period_year = _extract_year(filename) or 2024

    df = pd.read_excel(io.BytesIO(file_bytes), header=0, dtype=str)

    res = await db.execute(text(
        "SELECT id, name_ru FROM organizations WHERE name_ru IS NOT NULL"
    ))
    name_to_org_id = {r.name_ru.strip().lower(): str(r.id) for r in res.fetchall()}

    # Fetch mapping for unified data catalog
    res_mapping = await db.execute(text("SELECT ca_column, catalog_field_id FROM college_assessment_field_mapping"))
    ca_mapping = {r.ca_column: r.catalog_field_id for r in res_mapping.fetchall()}

    stats = dict(
        colleges_inserted=0, colleges_updated=0,
        specialties_inserted=0, specialties_updated=0,
        skipped=0, errors=[],
    )

    current_college_id: Optional[int] = None

    for idx in range(len(df)):
        row = df.iloc[idx].tolist()

        college_name = _get(row, 3, "str")
        if not college_name:
            continue

        specialty_raw = _get(row, 46, "str")
        is_college_row = not specialty_raw

        # ── COLLEGE ROW ──────────────────────────────────────────────────────
        if is_college_row:
            total_score = _get(row, 113, "float")
            if total_score is None:
                stats["skipped"] += 1
                continue

            org_id = name_to_org_id.get(college_name.strip().lower())

            college_data = dict(
                org_id               = org_id,
                college_id_source    = _get(row, 0, "int"),
                region               = _get(row, 1, "str"),
                district             = _get(row, 2, "str"),
                college_name         = college_name,
                ownership_form       = _get(row, 4, "str"),
                location_type        = _get(row, 5, "str"),
                period_year          = period_year,
                source_file          = filename,
                imported_by          = user_id,
                repair_current_done  = _to_bool(_get(row, 6, "str")),
                repair_not_required  = _to_bool(_get(row, 7, "str")),
                repair_capital_done  = _to_bool(_get(row, 8, "str")),
                repair_capital_needed= _to_bool(_get(row, 9, "str")),
                repair_current_needed= _to_bool(_get(row, 10, "str")),
                score_repair         = _get(row, 11, "float"),
                capacity_design      = _get(row, 12, "int"),
                contingent_actual    = _get(row, 13, "int"),
                capacity_pct         = _get(row, 14, "float"),
                score_capacity       = _get(row, 15, "float"),
                attestation_result   = _get(row, 16, "str"),
                score_attestation    = _get(row, 17, "float"),
                has_sports_facility  = _to_bool(_get(row, 18, "str")),
                score_sports         = _get(row, 19, "float"),
                has_dormitory        = _to_bool(_get(row, 20, "str")),
                score_dormitory      = _get(row, 21, "float"),
                library_readers_count= _get(row, 22, "int"),
                library_readers_pct  = _get(row, 23, "float"),
                score_library        = _get(row, 24, "float"),
                mini_enterprise_count        = _get(row, 25, "int"),
                score_mini_enterprise        = _get(row, 26, "float"),
                mini_enterprise_income       = _get(row, 27, "float"),
                score_mini_enterprise_income = _get(row, 28, "float"),
                sponsor_funds          = _get(row, 29, "float"),
                score_sponsors         = _get(row, 30, "float"),
                has_methodical_union   = _to_bool(_get(row, 31, "str")),
                score_methodical_union = _get(row, 32, "float"),
                teachers_master_count  = _get(row, 33, "int"),
                teachers_master_pct    = _get(row, 34, "float"),
                score_teachers_master  = _get(row, 35, "float"),
                teachers_science_count = _get(row, 36, "int"),
                teachers_science_pct   = _get(row, 37, "float"),
                score_teachers_science = _get(row, 38, "float"),
                teachers_total         = _get(row, 39, "int"),
                talap_trainers_count   = _get(row, 40, "int"),
                score_talap_trainers   = _get(row, 41, "float"),
                best_teacher_winners   = _get(row, 42, "int"),
                score_best_teacher     = _get(row, 43, "float"),
                enterprise_patronage_count = _get(row, 44, "int"),
                score_patronage            = _get(row, 45, "float"),
                total_score = total_score,
            )

            sp = f"sp_ca_{idx}"
            await db.execute(text(f"SAVEPOINT {sp}"))
            try:
                result = await db.execute(text("""
                    INSERT INTO college_assessment (
                        org_id, college_id_source, region, district, college_name,
                        ownership_form, location_type, period_year, source_file, imported_by,
                        repair_current_done, repair_not_required, repair_capital_done,
                        repair_capital_needed, repair_current_needed, score_repair,
                        capacity_design, contingent_actual, capacity_pct, score_capacity,
                        attestation_result, score_attestation,
                        has_sports_facility, score_sports, has_dormitory, score_dormitory,
                        library_readers_count, library_readers_pct, score_library,
                        mini_enterprise_count, score_mini_enterprise,
                        mini_enterprise_income, score_mini_enterprise_income,
                        sponsor_funds, score_sponsors,
                        has_methodical_union, score_methodical_union,
                        teachers_master_count, teachers_master_pct, score_teachers_master,
                        teachers_science_count, teachers_science_pct, score_teachers_science,
                        teachers_total, talap_trainers_count, score_talap_trainers,
                        best_teacher_winners, score_best_teacher,
                        enterprise_patronage_count, score_patronage, total_score
                    ) VALUES (
                        :org_id, :college_id_source, :region, :district, :college_name,
                        :ownership_form, :location_type, :period_year, :source_file, :imported_by,
                        :repair_current_done, :repair_not_required, :repair_capital_done,
                        :repair_capital_needed, :repair_current_needed, :score_repair,
                        :capacity_design, :contingent_actual, :capacity_pct, :score_capacity,
                        :attestation_result, :score_attestation,
                        :has_sports_facility, :score_sports, :has_dormitory, :score_dormitory,
                        :library_readers_count, :library_readers_pct, :score_library,
                        :mini_enterprise_count, :score_mini_enterprise,
                        :mini_enterprise_income, :score_mini_enterprise_income,
                        :sponsor_funds, :score_sponsors,
                        :has_methodical_union, :score_methodical_union,
                        :teachers_master_count, :teachers_master_pct, :score_teachers_master,
                        :teachers_science_count, :teachers_science_pct, :score_teachers_science,
                        :teachers_total, :talap_trainers_count, :score_talap_trainers,
                        :best_teacher_winners, :score_best_teacher,
                        :enterprise_patronage_count, :score_patronage, :total_score
                    )
                    ON CONFLICT (college_name, region, period_year)
                    DO UPDATE SET
                        total_score       = EXCLUDED.total_score,
                        score_repair      = EXCLUDED.score_repair,
                        score_capacity    = EXCLUDED.score_capacity,
                        contingent_actual = EXCLUDED.contingent_actual,
                        teachers_total    = EXCLUDED.teachers_total,
                        source_file       = EXCLUDED.source_file,
                        imported_at       = NOW()
                    RETURNING id
                """), college_data)
                current_college_id = result.scalar_one()

                # ── SYNC WITH UNIFIED DATA CATALOG ───────────────────────────
                if org_id and ca_mapping:
                    for col, field_id in ca_mapping.items():
                        val = college_data.get(col)
                        if val is None:
                            continue
                        
                        # Convert bool to 1/0 for numeric storage if needed
                        if isinstance(val, bool):
                            val = 1.0 if val else 0.0

                        await db.execute(text("""
                            INSERT INTO education_data (
                                org_id, catalog_field_id, period_year, value_numeric, 
                                imported_from, source_file, created_by, updated_by
                            ) VALUES (
                                :org_id, :field_id, :year, :val, 
                                'college_assessment_sync', :src, :uid, :uid
                            )
                            ON CONFLICT (org_id, catalog_field_id, period_year, period_month)
                            DO UPDATE SET
                                value_numeric = EXCLUDED.value_numeric,
                                updated_at = NOW(),
                                version = education_data.version + 1
                        """), {
                            "org_id": org_id, "field_id": field_id, 
                            "year": period_year, "val": val, 
                            "src": filename, "uid": user_id
                        })

                await db.execute(text(f"RELEASE SAVEPOINT {sp}"))
                stats["colleges_inserted"] += 1
            except Exception as e:
                await db.execute(text(f"ROLLBACK TO SAVEPOINT {sp}"))
                stats["errors"].append(f"Колледж '{college_name}': {e}")
                current_college_id = None
                logger.warning("College insert error: %s", e)

        # ── SPECIALTY ROW ────────────────────────────────────────────────────
        elif specialty_raw and current_college_id:
            specialty_code, specialty_name = _extract_specialty_code(specialty_raw)

            spec_data = dict(
                assessment_id             = current_college_id,
                specialty_raw             = specialty_raw,
                specialty_code            = specialty_code or None,
                specialty_name            = specialty_name or specialty_raw,
                labs_total                = _get(row, 47, "int"),
                labs_equipped             = _get(row, 48, "int"),
                labs_equipped_pct         = _get(row, 49, "float"),
                score_labs                = _get(row, 50, "float"),
                zhas_maman_participation  = _get(row, 51, "str"),
                score_zhas_maman          = _get(row, 52, "float"),
                spec_teachers_total       = _get(row, 53, "int"),
                spec_teachers_master      = _get(row, 54, "int"),
                spec_teachers_master_pct  = _get(row, 55, "float"),
                score_spec_master         = _get(row, 56, "float"),
                spec_teachers_science     = _get(row, 57, "int"),
                spec_teachers_science_pct = _get(row, 58, "float"),
                score_spec_science        = _get(row, 59, "float"),
                expertise_teachers        = _get(row, 60, "int"),
                score_expertise           = _get(row, 61, "float"),
                ws_expert_republic        = _get(row, 62, "int"),
                score_ws_expert_republic  = _get(row, 63, "float"),
                ws_expert_intl            = _get(row, 64, "int"),
                score_ws_expert_intl      = _get(row, 65, "float"),
                abroad_internship_count   = _get(row, 66, "int"),
                abroad_internship_pct     = _get(row, 67, "float"),
                score_abroad_internship   = _get(row, 68, "float"),
                prof_contest_winners      = _get(row, 69, "int"),
                score_prof_contest        = _get(row, 70, "float"),
                industry_teachers_count   = _get(row, 71, "int"),
                industry_teachers_pct     = _get(row, 72, "float"),
                score_industry_teachers   = _get(row, 73, "float"),
                academic_performance_pct  = _get(row, 74, "float"),
                score_academic            = _get(row, 75, "float"),
                knowledge_quality_pct     = _get(row, 76, "float"),
                score_knowledge           = _get(row, 77, "float"),
                admission_count           = _get(row, 78, "int"),
                graduates_count           = _get(row, 79, "int"),
                graduates_pct             = _get(row, 80, "float"),
                score_graduates           = _get(row, 81, "float"),
                zm_students_count         = _get(row, 82, "int"),
                zm_academic_pct           = _get(row, 83, "float"),
                score_zm_academic         = _get(row, 84, "float"),
                zm_quality_pct            = _get(row, 85, "float"),
                score_zm_quality          = _get(row, 86, "float"),
                zm_admission_count        = _get(row, 87, "int"),
                zm_graduates_count        = _get(row, 88, "int"),
                zm_graduates_pct          = _get(row, 89, "float"),
                score_zm_graduates        = _get(row, 90, "float"),
                ws_student_place_republic = _get(row, 91, "str"),
                score_ws_student_republic = _get(row, 92, "float"),
                ws_student_place_intl     = _get(row, 93, "str"),
                score_ws_student_intl     = _get(row, 94, "float"),
                startup_count             = _get(row, 95, "int"),
                score_startups            = _get(row, 96, "float"),
                demo_exam_students        = _get(row, 97, "int"),
                score_demo_exam           = _get(row, 98, "float"),
                entrepreneur_graduates    = _get(row, 99, "int"),
                score_entrepreneurs       = _get(row, 100, "float"),
                employment_graduates      = _get(row, 101, "int"),
                employment_employed       = _get(row, 102, "str"),
                employment_pct            = _get(row, 103, "float"),
                score_employment          = _get(row, 104, "float"),
                zm_employment_graduates   = _get(row, 105, "int"),
                zm_employment_employed    = _get(row, 106, "str"),
                zm_employment_pct         = _get(row, 107, "float"),
                score_zm_employment       = _get(row, 108, "float"),
                dual_students_count       = _get(row, 109, "int"),
                score_dual                = _get(row, 110, "float"),
                employer_request_count    = _get(row, 111, "int"),
                score_employer_requests   = _get(row, 112, "float"),
                specialty_score           = _get(row, 114, "float"),
            )

            sp = f"sp_cas_{idx}"
            await db.execute(text(f"SAVEPOINT {sp}"))
            try:
                await db.execute(text("""
                    INSERT INTO college_assessment_specialty (
                        assessment_id, specialty_raw, specialty_code, specialty_name,
                        labs_total, labs_equipped, labs_equipped_pct, score_labs,
                        zhas_maman_participation, score_zhas_maman,
                        spec_teachers_total, spec_teachers_master, spec_teachers_master_pct,
                        score_spec_master, spec_teachers_science, spec_teachers_science_pct,
                        score_spec_science, expertise_teachers, score_expertise,
                        ws_expert_republic, score_ws_expert_republic,
                        ws_expert_intl, score_ws_expert_intl,
                        abroad_internship_count, abroad_internship_pct, score_abroad_internship,
                        prof_contest_winners, score_prof_contest,
                        industry_teachers_count, industry_teachers_pct, score_industry_teachers,
                        academic_performance_pct, score_academic,
                        knowledge_quality_pct, score_knowledge,
                        admission_count, graduates_count, graduates_pct, score_graduates,
                        zm_students_count, zm_academic_pct, score_zm_academic,
                        zm_quality_pct, score_zm_quality, zm_admission_count,
                        zm_graduates_count, zm_graduates_pct, score_zm_graduates,
                        ws_student_place_republic, score_ws_student_republic,
                        ws_student_place_intl, score_ws_student_intl,
                        startup_count, score_startups,
                        demo_exam_students, score_demo_exam,
                        entrepreneur_graduates, score_entrepreneurs,
                        employment_graduates, employment_employed, employment_pct, score_employment,
                        zm_employment_graduates, zm_employment_employed, zm_employment_pct,
                        score_zm_employment, dual_students_count, score_dual,
                        employer_request_count, score_employer_requests, specialty_score
                    ) VALUES (
                        :assessment_id, :specialty_raw, :specialty_code, :specialty_name,
                        :labs_total, :labs_equipped, :labs_equipped_pct, :score_labs,
                        :zhas_maman_participation, :score_zhas_maman,
                        :spec_teachers_total, :spec_teachers_master, :spec_teachers_master_pct,
                        :score_spec_master, :spec_teachers_science, :spec_teachers_science_pct,
                        :score_spec_science, :expertise_teachers, :score_expertise,
                        :ws_expert_republic, :score_ws_expert_republic,
                        :ws_expert_intl, :score_ws_expert_intl,
                        :abroad_internship_count, :abroad_internship_pct, :score_abroad_internship,
                        :prof_contest_winners, :score_prof_contest,
                        :industry_teachers_count, :industry_teachers_pct, :score_industry_teachers,
                        :academic_performance_pct, :score_academic,
                        :knowledge_quality_pct, :score_knowledge,
                        :admission_count, :graduates_count, :graduates_pct, :score_graduates,
                        :zm_students_count, :zm_academic_pct, :score_zm_academic,
                        :zm_quality_pct, :score_zm_quality, :zm_admission_count,
                        :zm_graduates_count, :zm_graduates_pct, :score_zm_graduates,
                        :ws_student_place_republic, :score_ws_student_republic,
                        :ws_student_place_intl, :score_ws_student_intl,
                        :startup_count, :score_startups,
                        :demo_exam_students, :score_demo_exam,
                        :entrepreneur_graduates, :score_entrepreneurs,
                        :employment_graduates, :employment_employed, :employment_pct, :score_employment,
                        :zm_employment_graduates, :zm_employment_employed, :zm_employment_pct,
                        :score_zm_employment, :dual_students_count, :score_dual,
                        :employer_request_count, :score_employer_requests, :specialty_score
                    )
                    ON CONFLICT (assessment_id, specialty_raw)
                    DO UPDATE SET
                        specialty_score          = EXCLUDED.specialty_score,
                        employment_pct           = EXCLUDED.employment_pct,
                        score_employment         = EXCLUDED.score_employment,
                        academic_performance_pct = EXCLUDED.academic_performance_pct,
                        score_dual               = EXCLUDED.score_dual
                """), spec_data)
                await db.execute(text(f"RELEASE SAVEPOINT {sp}"))
                stats["specialties_inserted"] += 1
            except Exception as e:
                await db.execute(text(f"ROLLBACK TO SAVEPOINT {sp}"))
                stats["errors"].append(f"Специальность '{specialty_raw[:40]}': {e}")
                logger.warning("Specialty insert error: %s", e)

    await db.commit()
    stats["errors"] = stats["errors"][:30]
    return stats
