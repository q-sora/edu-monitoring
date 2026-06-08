"""
Запускается ВНУТРИ контейнера edu_superset:
  docker exec edu_superset python3 /app/superset_init_internal.py

Создаёт:
  1. Подключение к БД edu_monitoring
  2. Виртуальный датасет (finance_records + organizations + regions)
  3. 8 чартов (KPI × 3, тренды, структура, топ)
  4. Дашборд "Финансирование и бюджет" с embedded UUID
"""
from __future__ import annotations
import json, os, sys

# Bootstrap Superset app FIRST before importing any models
from superset.app import create_app
_app = create_app()
_app.app_context().push()

# ── Now safe to import Superset models ───────────────────────────────────────
from superset import db
from superset.models.core import Database
from superset.connectors.sqla.models import SqlaTable
from superset.models.slice import Slice
from superset.models.dashboard import Dashboard
from superset.models.embedded_dashboard import EmbeddedDashboard
from flask_appbuilder.security.sqla.models import User

app = _app

FINANCE_DASHBOARD_UUID  = "a1b2c3d4-0002-4aaa-b002-100000000002"
PG_HOST   = "postgres"
PG_PORT   = 5432
PG_DB     = "edu_monitoring"
PG_USER   = "edu_user"
PG_PASS   = os.environ.get("POSTGRES_PASSWORD", "changeme")

FINANCE_SQL = """
SELECT
    fr.id,
    fr.org_id::text             AS org_id,
    fr.period_year,
    fr.period_month,
    fr.period_quarter,
    COALESCE(fr.annual_budget, 0)          AS annual_budget,
    COALESCE(fr.budget_total, 0)           AS budget_total,
    COALESCE(fr.budget_state_grant, 0)     AS budget_state_grant,
    COALESCE(fr.budget_target_funding, 0)  AS budget_target_funding,
    COALESCE(fr.budget_capital_investment, 0) AS budget_capital_investment,
    COALESCE(fr.budget_research_subsidy, 0)   AS budget_research_subsidy,
    COALESCE(fr.paid_tuition_total, 0)     AS paid_tuition_total,
    COALESCE(fr.state_order_volume, 0)     AS state_order_volume,
    COALESCE(fr.total_income, 0)           AS total_income,
    COALESCE(fr.total_expenses, 0)         AS total_expenses,
    COALESCE(fr.expenses_payroll, 0)       AS expenses_payroll,
    COALESCE(fr.salary_fund_total, 0)      AS salary_fund_total,
    COALESCE(fr.salary_teaching_staff, 0)  AS salary_teaching_staff,
    COALESCE(fr.salary_administrative, 0)  AS salary_administrative,
    COALESCE(fr.salary_research_staff, 0)  AS salary_research_staff,
    COALESCE(fr.salary_support_staff, 0)   AS salary_support_staff,
    COALESCE(fr.capex_total, 0)            AS capex_total,
    COALESCE(fr.scholarship_total, 0)      AS scholarship_total,
    COALESCE(fr.research_grants_total, 0)  AS research_grants_total,
    COALESCE(fr.international_grants, 0)   AS international_grants,
    COALESCE(fr.opex_utilities, 0)         AS opex_utilities,
    COALESCE(fr.opex_maintenance, 0)       AS opex_maintenance,
    COALESCE(fr.cost_per_student, 0)       AS cost_per_student,
    COALESCE(fr.fot_to_budget_ratio, 0)    AS fot_to_budget_ratio,
    COALESCE(fr.state_funding_ratio, 0)    AS state_funding_ratio,
    COALESCE(fr.budget_execution_pct, 0)   AS budget_execution_pct,
    fr.submission_status,
    fr.report_date,
    COALESCE(o.name_ru, 'Неизвестно')  AS org_name,
    o.org_type_id,
    COALESCE(ot.name_ru, 'Неизвестно') AS org_type_name,
    COALESCE(r.name_ru, 'Неизвестно')  AS region_name,
    r.id                               AS region_id
FROM finance_records fr
LEFT JOIN organizations o  ON fr.org_id      = o.id
LEFT JOIN org_types     ot ON o.org_type_id  = ot.id
LEFT JOIN regions       r  ON o.region_id    = r.id
WHERE fr.deleted_at IS NULL
"""


def simple_metric(label: str, col: str, agg: str = "SUM") -> dict:
    return {
        "expressionType": "SIMPLE",
        "column":    {"column_name": col, "type": "NUMERIC"},
        "aggregate": agg,
        "label":     label,
        "optionName": f"metric_{col}",
    }


def make_charts(ds: SqlaTable) -> list[dict]:
    """Returns list of chart spec dicts."""
    ds_ref = f"{ds.id}__table"

    kpi_common = {
        "datasource":    ds_ref,
        "viz_type":      "big_number_total",
        "y_axis_format": "SMART_NUMBER",
        "header_font_size": 0.3,
        "subheader_font_size": 0.125,
    }

    bar_common = {
        "datasource": ds_ref,
        "viz_type":   "echarts_bar",
        "y_axis_format": "SMART_NUMBER",
        "color_scheme": "financial_center",
        "rich_tooltip": True,
        "orientation":  "vertical",
    }

    return [
        # ── KPI 1 ─────────────────────────────────────────────────────────
        {
            "slice_name": "Годовой бюджет (всего)",
            "viz_type":   "big_number_total",
            "params": {**kpi_common,
                "metric":    simple_metric("Годовой бюджет", "annual_budget"),
                "subheader": "Суммарный годовой бюджет, ₸",
            },
        },
        # ── KPI 2 ─────────────────────────────────────────────────────────
        {
            "slice_name": "Объём госзаказа",
            "viz_type":   "big_number_total",
            "params": {**kpi_common,
                "metric":    simple_metric("Госзаказ", "budget_state_grant"),
                "subheader": "Финансирование по госзаказу, ₸",
            },
        },
        # ── KPI 3 ─────────────────────────────────────────────────────────
        {
            "slice_name": "Фонд оплаты труда",
            "viz_type":   "big_number_total",
            "params": {**kpi_common,
                "metric":    simple_metric("ФОТ", "salary_fund_total"),
                "subheader": "Суммарный ФОТ, ₸",
            },
        },
        # ── Тренд бюджета ──────────────────────────────────────────────────
        {
            "slice_name": "Динамика бюджета по годам",
            "viz_type":   "echarts_bar",
            "params": {
                **bar_common,
                "metrics": [simple_metric("Годовой бюджет", "annual_budget")],
                "groupby": ["period_year"],
                "x_axis":  "period_year",
                "row_limit": 10,
            },
        },
        # ── Структура расходов ─────────────────────────────────────────────
        {
            "slice_name": "Структура расходов",
            "viz_type":   "echarts_pie",
            "params": {
                "datasource": ds_ref,
                "viz_type":   "echarts_pie",
                "groupby":    [],
                "metric":     simple_metric("Расходы", "total_expenses"),
                "metrics": [
                    simple_metric("ФОТ",          "expenses_payroll"),
                    simple_metric("Капвложения",   "capex_total"),
                    simple_metric("Стипендии",     "scholarship_total"),
                    simple_metric("Коммунальные",  "opex_utilities"),
                    simple_metric("Гранты",        "research_grants_total"),
                    simple_metric("Обслуживание",  "opex_maintenance"),
                ],
                "innerRadius": 30,
                "outerRadius": 70,
                "color_scheme": "financial_center",
                "show_legend": True,
            },
        },
        # ── Топ организаций ────────────────────────────────────────────────
        {
            "slice_name": "Топ организаций по бюджету",
            "viz_type":   "echarts_bar",
            "params": {
                **bar_common,
                "metrics": [simple_metric("Бюджет", "annual_budget")],
                "groupby": ["org_name"],
                "row_limit": 15,
                "order_desc": True,
                "x_ticks_layout": "staggered",
            },
        },
        # ── Бюджет по регионам ─────────────────────────────────────────────
        {
            "slice_name": "Бюджет по регионам",
            "viz_type":   "echarts_bar",
            "params": {
                **bar_common,
                "metrics": [simple_metric("Бюджет", "annual_budget")],
                "groupby": ["region_name"],
                "row_limit": 20,
                "order_desc": True,
            },
        },
        # ── Структура ФОТ ──────────────────────────────────────────────────
        {
            "slice_name": "Структура ФОТ",
            "viz_type":   "echarts_bar",
            "params": {
                **bar_common,
                "metrics": [
                    simple_metric("ППС",     "salary_teaching_staff"),
                    simple_metric("АУП",     "salary_administrative"),
                    simple_metric("НС",      "salary_research_staff"),
                    simple_metric("Обслуж.", "salary_support_staff"),
                ],
                "groupby": ["period_year"],
                "stack":   True,
                "row_limit": 10,
            },
        },
    ]


def main():
    with app.app_context():
        session = db.session

        # ── Admin user ────────────────────────────────────────────────────
        admin = session.query(User).filter_by(username="admin").first()
        if not admin:
            raise RuntimeError("Admin user not found in Superset DB")
        print(f"[✔] Admin user: {admin.username} (id={admin.id})")

        # ── 1. Database ───────────────────────────────────────────────────
        existing_db = session.query(Database).filter_by(
            database_name="EDU Monitoring (PostgreSQL)"
        ).first()

        if existing_db:
            edu_db = existing_db
            print(f"[✔] DB connection already exists: id={edu_db.id}")
        else:
            uri = f"postgresql+psycopg2://{PG_USER}:{PG_PASS}@{PG_HOST}:{PG_PORT}/{PG_DB}"
            edu_db = Database(
                database_name="EDU Monitoring (PostgreSQL)",
                sqlalchemy_uri=uri,
                expose_in_sqllab=True,
                allow_run_async=True,
                allow_dml=False,
                created_by=admin,
                changed_by=admin,
            )
            session.add(edu_db)
            session.flush()
            print(f"[✔] Created DB connection: id={edu_db.id}")

        # ── 2. Dataset ────────────────────────────────────────────────────
        existing_ds = session.query(SqlaTable).filter_by(
            table_name="Финансирование и бюджет",
            database_id=edu_db.id,
        ).first()

        if existing_ds:
            ds = existing_ds
            print(f"[✔] Dataset already exists: id={ds.id}")
        else:
            ds = SqlaTable(
                table_name="Финансирование и бюджет",
                schema="public",
                sql=FINANCE_SQL,
                database=edu_db,
                database_id=edu_db.id,
                created_by=admin,
                changed_by=admin,
                is_managed_externally=False,
                fetch_values_predicate=None,
                extra=json.dumps({}),
            )
            session.add(ds)
            session.flush()
            print(f"[✔] Created dataset: id={ds.id}")

            # Fetch columns
            try:
                ds.fetch_metadata(commit=False)
                print(f"    Fetched {len(ds.columns)} columns")
            except Exception as e:
                print(f"    Column fetch warning: {e}")

        # ── 3. Charts ─────────────────────────────────────────────────────
        chart_specs = make_charts(ds)
        chart_objects: list[Slice] = []

        for spec in chart_specs:
            existing_chart = session.query(Slice).filter_by(
                slice_name=spec["slice_name"]
            ).first()

            if existing_chart:
                chart_objects.append(existing_chart)
                print(f"[✔] Chart exists: {spec['slice_name']}")
                continue

            slc = Slice(
                slice_name=spec["slice_name"],
                viz_type=spec["viz_type"],
                datasource_id=ds.id,
                datasource_type="table",
                params=json.dumps(spec["params"]),
                created_by=admin,
                changed_by=admin,
            )
            session.add(slc)
            session.flush()
            chart_objects.append(slc)
            print(f"[+] Created chart: {spec['slice_name']} (id={slc.id})")

        # ── 4. Dashboard ──────────────────────────────────────────────────
        title = "Финансирование и бюджет"
        existing_dash = session.query(Dashboard).filter_by(
            dashboard_title=title
        ).first()

        if existing_dash:
            dash = existing_dash
            print(f"[✔] Dashboard exists: id={dash.id}")
        else:
            dash = Dashboard(
                dashboard_title=title,
                published=True,
                created_by=admin,
                changed_by=admin,
                slices=chart_objects,
            )
            # Build position JSON
            dash.position_json = _make_position_json([c.id for c in chart_objects])
            session.add(dash)
            session.flush()
            print(f"[+] Created dashboard: id={dash.id}")

        # Ensure all charts are attached
        for slc in chart_objects:
            if slc not in dash.slices:
                dash.slices.append(slc)

        # ── 5. Set dashboard UUID ─────────────────────────────────────────
        if str(dash.uuid) != FINANCE_DASHBOARD_UUID:
            import uuid as _uuid
            dash.uuid = _uuid.UUID(FINANCE_DASHBOARD_UUID)
            print(f"[✔] Set dashboard uuid → {FINANCE_DASHBOARD_UUID}")
        else:
            print(f"[✔] Dashboard uuid already correct")

        # ── 6. Enable embedding ───────────────────────────────────────────
        existing_emb = session.query(EmbeddedDashboard).filter_by(
            dashboard_id=dash.id
        ).first()

        if existing_emb:
            actual_uuid = str(existing_emb.uuid)
            print(f"[✔] Embedding already enabled, uuid={actual_uuid}")
            if actual_uuid != FINANCE_DASHBOARD_UUID:
                print(f"    *** Embedded UUID mismatch: got {actual_uuid}")
                print(f"    *** Update admin.py SUPERSET_DASHBOARDS[1].embedded_uuid to: {actual_uuid}")
        else:
            import uuid as _uuid
            emb = EmbeddedDashboard(
                dashboard_id=dash.id,
                uuid=_uuid.UUID(FINANCE_DASHBOARD_UUID),
                allowed_domains=[],
                changed_by=admin,
                created_by=admin,
            )
            session.add(emb)
            print(f"[+] Enabled embedding, uuid={FINANCE_DASHBOARD_UUID}")

        session.commit()
        print("\n[✔] All done — finance dashboard is ready")

        # Print final embedded UUID for verification
        emb_row = session.query(EmbeddedDashboard).filter_by(dashboard_id=dash.id).first()
        if emb_row:
            print(f"    Embedded UUID: {emb_row.uuid}")


def _make_position_json(chart_ids: list[int]) -> str:
    positions: dict = {
        "ROOT_ID": {"type": "ROOT",  "id": "ROOT_ID",  "children": ["GRID_ID"]},
        "GRID_ID": {"type": "GRID",  "id": "GRID_ID",  "children": [], "parents": ["ROOT_ID"]},
    }
    kpi_ids  = chart_ids[:3]
    rest_ids = chart_ids[3:]

    # Row 0 — KPIs (3 × 8 cols = 24)
    row0 = "ROW-kpi"
    positions["GRID_ID"]["children"].append(row0)
    positions[row0] = {"type": "ROW", "id": row0, "children": [],
                       "meta": {"background": "BACKGROUND_TRANSPARENT"}, "parents": ["ROOT_ID", "GRID_ID"]}
    for i, cid in enumerate(kpi_ids):
        col_id  = f"COL-kpi-{i}"
        ch_id   = f"CHART-{cid}"
        positions[row0]["children"].append(col_id)
        positions[col_id] = {"type": "COLUMN", "id": col_id, "children": [ch_id],
                              "meta": {"width": 8}, "parents": [row0]}
        positions[ch_id]  = {"type": "CHART",  "id": ch_id,
                              "meta": {"chartId": cid, "width": 8, "height": 10},
                              "parents": [col_id]}

    # Remaining rows — 2 per row
    for pi in range(0, len(rest_ids), 2):
        pair    = rest_ids[pi: pi + 2]
        row_id  = f"ROW-{pi}"
        positions["GRID_ID"]["children"].append(row_id)
        positions[row_id] = {"type": "ROW", "id": row_id, "children": [],
                              "meta": {"background": "BACKGROUND_TRANSPARENT"}, "parents": ["ROOT_ID", "GRID_ID"]}
        w = 12 if len(pair) == 2 else 24
        for j, cid in enumerate(pair):
            col_id = f"COL-{pi}-{j}"
            ch_id  = f"CHART-{cid}"
            positions[row_id]["children"].append(col_id)
            positions[col_id] = {"type": "COLUMN", "id": col_id, "children": [ch_id],
                                  "meta": {"width": w}, "parents": [row_id]}
            positions[ch_id]  = {"type": "CHART",  "id": ch_id,
                                  "meta": {"chartId": cid, "width": w, "height": 20},
                                  "parents": [col_id]}

    return json.dumps(positions)


if __name__ == "__main__":
    main()
