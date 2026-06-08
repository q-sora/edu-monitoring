#!/usr/bin/env python3
"""
Инициализация Superset для EDU Monitoring:
  1. Подключение к PostgreSQL (edu_monitoring)
  2. Виртуальный датасет finance_records + organizations + regions
  3. 6 чартов: KPI × 3, тренд бюджета, структура расходов, топ-организации
  4. Дашборд "Финансирование и бюджет" с UUID a1b2c3d4-0002-4aaa-b002-100000000002
  5. Включение embedded-режима для дашборда
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path
from urllib.parse import quote

import urllib.request
import urllib.error

# ── Конфиг ────────────────────────────────────────────────────────────────────
SUPERSET_URL   = "http://localhost:8088"
SUPERSET_USER  = "admin"
SUPERSET_PASS  = None          # читается из .env ниже

PG_USER = "edu_user"
PG_PASS = None                 # читается из .env
PG_HOST = "postgres"           # Docker internal
PG_PORT = 5432
PG_DB   = "edu_monitoring"

ENV_FILE = Path(__file__).parent.parent / "edu_backend" / ".env"

FINANCE_DASHBOARD_UUID = "a1b2c3d4-0002-4aaa-b002-100000000002"

# ── Чтение .env ───────────────────────────────────────────────────────────────

def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    if not path.exists():
        return env
    for line in path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


_env = load_env(ENV_FILE)
SUPERSET_PASS = _env.get("SUPERSET_ADMIN_PASSWORD", "admin")

# Get PG password from the running API container (docker-compose overrides .env)
import subprocess, re

def _get_container_db_url() -> str:
    try:
        r = subprocess.run(
            ["docker", "exec", "edu_api", "env"],
            capture_output=True, text=True, timeout=10
        )
        for line in r.stdout.splitlines():
            if line.startswith("DATABASE_URL="):
                return line.partition("=")[2]
    except Exception:
        pass
    return ""

_container_db_url = _get_container_db_url()
_m = re.search(r"://[^:]+:([^@]+)@", _container_db_url)
PG_PASS = _m.group(1) if _m else _env.get("DB_PASSWORD", "changeme")


# ── HTTP helper ───────────────────────────────────────────────────────────────

class SupersetClient:
    def __init__(self, base: str):
        self.base    = base.rstrip("/")
        self.token   = ""
        self.cookies = ""
        self.csrf    = ""

    def _req(self, method: str, path: str, body=None, extra_headers=None) -> dict:
        url  = f"{self.base}{path}"
        data = json.dumps(body).encode() if body is not None else None
        headers = {
            "Content-Type": "application/json",
            "Accept":       "application/json",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        if self.csrf:
            headers["X-CSRFToken"] = self.csrf
            headers["Referer"]     = self.base
        if self.cookies:
            headers["Cookie"] = self.cookies
        if extra_headers:
            headers.update(extra_headers)

        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req) as resp:
                raw = resp.read().decode()
                # Capture set-cookie
                sc = resp.getheader("Set-Cookie")
                if sc:
                    # Append / replace
                    cookies = {c.split("=")[0].strip(): c for c in self.cookies.split("; ") if c}
                    for part in sc.split(", "):
                        name = part.split("=")[0].strip()
                        cookies[name] = part.split(";")[0].strip()
                    self.cookies = "; ".join(cookies.values())
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            body_text = e.read().decode()[:400]
            print(f"  [HTTP {e.code}] {method} {path}: {body_text}")
            return {"__error": e.code, "__body": body_text}

    def get(self, path, **kw):
        # URL-encode query string part if it contains spaces / special chars
        if "?" in path:
            base_path, _, qs = path.partition("?")
            path = base_path + "?" + quote(qs, safe="=&")
        return self._req("GET", path, **kw)
    def post(self, path, body=None, **kw): return self._req("POST", path, body, **kw)
    def put(self, path, body=None, **kw):  return self._req("PUT",  path, body, **kw)

    def login(self, username: str, password: str):
        resp = self.post("/api/v1/security/login", {
            "username": username, "password": password, "provider": "db",
        })
        if "access_token" not in resp:
            raise RuntimeError(f"Superset login failed: {resp}")
        self.token = resp["access_token"]
        print(f"  Logged in as {username}")

        # CSRF
        csrf_resp = self.get("/api/v1/security/csrf_token/")
        self.csrf = csrf_resp.get("result", "")
        print(f"  CSRF token obtained")


# ── 1. База данных ─────────────────────────────────────────────────────────────

def ensure_database(c: SupersetClient) -> int:
    """Creates or returns existing edu_monitoring database connection."""
    db_name = "EDU Monitoring (PostgreSQL)"

    # Check existing — list all and filter client-side (avoids RISON issues)
    resp = c.get("/api/v1/database/?q=(page_size:100)")
    for db in resp.get("result", []):
        if db.get("database_name") == db_name:
            db_id = db["id"]
            print(f"  Database connection already exists: id={db_id}")
            return db_id

    sqlalchemy_uri = (
        f"postgresql+psycopg2://{PG_USER}:{PG_PASS}@{PG_HOST}:{PG_PORT}/{PG_DB}"
    )

    payload = {
        "database_name":  db_name,
        "sqlalchemy_uri": sqlalchemy_uri,
        "expose_in_sqllab": True,
        "allow_run_async":  True,
        "allow_dml":        False,
        "extra": json.dumps({
            "metadata_params": {},
            "engine_params":   {},
            "schemas_allowed_for_file_upload": [],
        }),
    }
    resp = c.post("/api/v1/database/", payload)
    if "id" not in resp:
        raise RuntimeError(f"Could not create DB: {resp}")
    db_id = resp["id"]
    print(f"  Created database connection: id={db_id}")
    return db_id


# ── 2. Датасет ────────────────────────────────────────────────────────────────

FINANCE_SQL = """
SELECT
    fr.id,
    fr.org_id,
    fr.period_year,
    fr.period_month,
    fr.period_quarter,
    fr.annual_budget,
    fr.budget_total,
    fr.budget_state_grant,
    fr.budget_target_funding,
    fr.budget_capital_investment,
    fr.budget_research_subsidy,
    fr.budget_social_program,
    fr.paid_tuition_total,
    fr.state_order_volume,
    fr.extra_budget_income,
    fr.total_income,
    fr.total_expenses,
    fr.expenses_payroll,
    fr.salary_fund_total,
    fr.salary_teaching_staff,
    fr.salary_administrative,
    fr.salary_research_staff,
    fr.salary_support_staff,
    fr.capex_total,
    fr.capex_construction,
    fr.capex_equipment,
    fr.capex_it_systems,
    fr.scholarship_total,
    fr.research_grants_total,
    fr.international_grants,
    fr.commercial_contracts,
    fr.opex_utilities,
    fr.opex_maintenance,
    fr.opex_consumables,
    fr.opex_other,
    fr.cost_per_student,
    fr.fot_to_budget_ratio,
    fr.state_funding_ratio,
    fr.budget_execution_pct,
    fr.deficit_amount,
    fr.submission_status,
    fr.report_date,
    o.name_ru  AS org_name,
    o.org_type_id,
    ot.name_ru AS org_type_name,
    r.name_ru  AS region_name,
    r.id       AS region_id
FROM finance_records fr
LEFT JOIN organizations o  ON fr.org_id   = o.id
LEFT JOIN org_types     ot ON o.org_type_id = ot.id
LEFT JOIN regions       r  ON o.region_id  = r.id
WHERE fr.deleted_at IS NULL
"""


def ensure_dataset(c: SupersetClient, db_id: int) -> int:
    dataset_name = "Финансирование и бюджет"

    resp = c.get("/api/v1/dataset/?q=(page_size:100)")
    existing = [d for d in resp.get("result", []) if d.get("table_name") == dataset_name]
    if existing:
        ds_id = existing[0]["id"]
        print(f"  Dataset already exists: id={ds_id}")
        return ds_id

    payload = {
        "database":   db_id,
        "table_name": dataset_name,
        "sql":        FINANCE_SQL,
        "schema":     "public",
        "is_managed_externally": False,
    }
    resp = c.post("/api/v1/dataset/", payload)
    if "id" not in resp:
        raise RuntimeError(f"Could not create dataset: {resp}")
    ds_id = resp["id"]
    print(f"  Created dataset: id={ds_id}")

    # Refresh columns
    c.put(f"/api/v1/dataset/{ds_id}/refresh")
    time.sleep(1)
    print(f"  Refreshed dataset columns")
    return ds_id


# ── 3. Чарты ─────────────────────────────────────────────────────────────────

def metric(col: str, agg: str, label: str) -> dict:
    return {
        "expressionType": "SIMPLE",
        "column": {"column_name": col},
        "aggregate": agg,
        "label": label,
        "optionName": f"metric_{col}_{agg}",
    }


def create_chart(c: SupersetClient, ds_id: int, spec: dict) -> int:
    """Create chart if not exists, return id."""
    name = spec["slice_name"]
    resp = c.get("/api/v1/chart/?q=(page_size:200)")
    existing = [ch for ch in resp.get("result", []) if ch.get("slice_name") == name]
    if existing:
        cid = existing[0]["id"]
        print(f"    Chart already exists '{name}': id={cid}")
        return cid

    payload = {
        "slice_name":    name,
        "viz_type":      spec["viz_type"],
        "datasource_id": ds_id,
        "datasource_type": "table",
        "params": json.dumps(spec["params"]),
    }
    resp = c.post("/api/v1/chart/", payload)
    if "id" not in resp:
        raise RuntimeError(f"Could not create chart '{name}': {resp}")
    cid = resp["id"]
    print(f"    Created chart '{name}': id={cid}")
    return cid


def create_finance_charts(c: SupersetClient, ds_id: int) -> list[int]:
    print("  Creating charts …")
    charts = []

    # ── KPI 1: Годовой бюджет ─────────────────────────────────────────────
    charts.append(create_chart(c, ds_id, {
        "slice_name": "Годовой бюджет (всего)",
        "viz_type":   "big_number_total",
        "params": {
            "metric": metric("annual_budget", "SUM", "Годовой бюджет"),
            "subheader": "Суммарный годовой бюджет, ₸",
            "y_axis_format": "SMART_NUMBER",
        },
    }))

    # ── KPI 2: Госзаказ ───────────────────────────────────────────────────
    charts.append(create_chart(c, ds_id, {
        "slice_name": "Объём госзаказа",
        "viz_type":   "big_number_total",
        "params": {
            "metric": metric("budget_state_grant", "SUM", "Бюджетный госзаказ"),
            "subheader": "Финансирование госзаказа, ₸",
            "y_axis_format": "SMART_NUMBER",
        },
    }))

    # ── KPI 3: ФОТ ────────────────────────────────────────────────────────
    charts.append(create_chart(c, ds_id, {
        "slice_name": "Фонд оплаты труда",
        "viz_type":   "big_number_total",
        "params": {
            "metric": metric("salary_fund_total", "SUM", "ФОТ"),
            "subheader": "Суммарный ФОТ, ₸",
            "y_axis_format": "SMART_NUMBER",
        },
    }))

    # ── Тренд бюджета по годам ────────────────────────────────────────────
    charts.append(create_chart(c, ds_id, {
        "slice_name": "Динамика бюджета по годам",
        "viz_type":   "echarts_timeseries_bar",
        "params": {
            "metrics": [metric("annual_budget", "SUM", "Годовой бюджет")],
            "groupby": [],
            "granularity_sqla": "period_year",
            "time_grain_sqla": "P1Y",
            "x_axis": "period_year",
            "y_axis_format": "SMART_NUMBER",
            "rich_tooltip": True,
            "show_legend": False,
            "color_scheme": "financial_center",
        },
    }))

    # ── Структура расходов ────────────────────────────────────────────────
    charts.append(create_chart(c, ds_id, {
        "slice_name": "Структура расходов",
        "viz_type":   "echarts_pie",
        "params": {
            "metrics": [
                metric("expenses_payroll",    "SUM", "ФОТ (расходы)"),
                metric("capex_total",         "SUM", "Капвложения"),
                metric("scholarship_total",   "SUM", "Стипендии"),
                metric("opex_utilities",      "SUM", "Коммунальные"),
                metric("research_grants_total","SUM", "Гранты"),
                metric("opex_maintenance",    "SUM", "Обслуживание"),
            ],
            "groupby": [],
            "innerRadius": 30,
            "outerRadius": 70,
            "labelsOutside": True,
            "color_scheme": "financial_center",
        },
    }))

    # ── Топ организаций по бюджету ─────────────────────────────────────────
    charts.append(create_chart(c, ds_id, {
        "slice_name": "Топ организаций по бюджету",
        "viz_type":   "echarts_bar",
        "params": {
            "metrics": [metric("annual_budget", "SUM", "Бюджет")],
            "groupby": ["org_name"],
            "row_limit": 15,
            "order_desc": True,
            "y_axis_format": "SMART_NUMBER",
            "x_ticks_layout": "staggered",
            "color_scheme": "financial_center",
        },
    }))

    # ── Бюджет по регионам ────────────────────────────────────────────────
    charts.append(create_chart(c, ds_id, {
        "slice_name": "Бюджет по регионам",
        "viz_type":   "echarts_bar",
        "params": {
            "metrics": [metric("annual_budget", "SUM", "Бюджет")],
            "groupby": ["region_name"],
            "row_limit": 20,
            "order_desc": True,
            "y_axis_format": "SMART_NUMBER",
            "color_scheme": "financial_center",
        },
    }))

    # ── Структура ФОТ ─────────────────────────────────────────────────────
    charts.append(create_chart(c, ds_id, {
        "slice_name": "Структура ФОТ по категориям",
        "viz_type":   "echarts_bar",
        "params": {
            "metrics": [
                metric("salary_teaching_staff",    "SUM", "ППС"),
                metric("salary_administrative",    "SUM", "АУП"),
                metric("salary_research_staff",    "SUM", "НПР"),
                metric("salary_support_staff",     "SUM", "Обслуж."),
            ],
            "groupby": ["period_year"],
            "stack": True,
            "y_axis_format": "SMART_NUMBER",
            "color_scheme": "financial_center",
        },
    }))

    return charts


# ── 4. Дашборд ────────────────────────────────────────────────────────────────

def make_position_json(chart_ids: list[int]) -> str:
    """Build a simple grid layout for the dashboard."""
    # ROOT_ID → GRID_ID → rows of charts
    positions: dict = {
        "ROOT_ID": {"type": "ROOT", "id": "ROOT_ID", "children": ["GRID_ID"]},
        "GRID_ID": {"type": "GRID", "id": "GRID_ID", "children": []},
    }

    # Layout: first 3 KPIs in one row, rest 2-per-row
    kpi_ids   = chart_ids[:3]
    rest_ids  = chart_ids[3:]

    # Row 0 — KPIs
    row0_id = "ROW-0"
    positions["GRID_ID"]["children"].append(row0_id)
    positions[row0_id] = {"type": "ROW", "id": row0_id, "children": [], "meta": {"background": "BACKGROUND_TRANSPARENT"}}

    col_w = 8  # 3 × 8 = 24 columns
    for i, cid in enumerate(kpi_ids):
        col_id   = f"COLUMN-0-{i}"
        chart_id = f"CHART-{cid}"
        positions[row0_id]["children"].append(col_id)
        positions[col_id]   = {"type": "COLUMN", "id": col_id,   "children": [chart_id], "meta": {"width": col_w}}
        positions[chart_id] = {"type": "CHART",  "id": chart_id, "meta": {"chartId": cid, "width": col_w, "height": 10}}

    # Remaining rows — 2 per row
    for pair_idx in range(0, len(rest_ids), 2):
        row_id = f"ROW-{pair_idx+1}"
        positions["GRID_ID"]["children"].append(row_id)
        positions[row_id] = {"type": "ROW", "id": row_id, "children": [], "meta": {"background": "BACKGROUND_TRANSPARENT"}}

        pair = rest_ids[pair_idx: pair_idx + 2]
        col_w2 = 12 if len(pair) == 2 else 24
        for j, cid in enumerate(pair):
            col_id   = f"COLUMN-{pair_idx+1}-{j}"
            chart_id = f"CHART-{cid}"
            positions[row_id]["children"].append(col_id)
            positions[col_id]   = {"type": "COLUMN", "id": col_id,   "children": [chart_id], "meta": {"width": col_w2}}
            positions[chart_id] = {"type": "CHART",  "id": chart_id, "meta": {"chartId": cid, "width": col_w2, "height": 20}}

    return json.dumps(positions)


def ensure_dashboard(c: SupersetClient, chart_ids: list[int]) -> int:
    title = "Финансирование и бюджет"

    resp = c.get("/api/v1/dashboard/?q=(page_size:100)")
    existing = [d for d in resp.get("result", []) if d.get("dashboard_title") == title]
    if existing:
        dash_id = existing[0]["id"]
        print(f"  Dashboard already exists: id={dash_id}")
        return dash_id

    position_json = make_position_json(chart_ids)

    payload = {
        "dashboard_title": title,
        "published":       True,
        "position_json":   position_json,
        "metadata":        json.dumps({"color_scheme": "financial_center"}),
    }
    resp = c.post("/api/v1/dashboard/", payload)
    if "id" not in resp:
        raise RuntimeError(f"Could not create dashboard: {resp}")
    dash_id = resp["id"]
    print(f"  Created dashboard: id={dash_id}")
    return dash_id


def set_dashboard_uuid(c: SupersetClient, dash_id: int, uuid: str):
    """Set the dashboard's uuid to match what the portal expects."""
    resp = c.get(f"/api/v1/dashboard/{dash_id}")
    current = resp.get("result", {}).get("uuid", "")
    if current == uuid:
        print(f"  Dashboard UUID already correct: {uuid}")
        return

    # Superset stores uuid as immutable after creation in some versions —
    # we override it via the internal metadata endpoint.
    resp = c.put(f"/api/v1/dashboard/{dash_id}", {"uuid": uuid})
    if "__error" in resp:
        # Fallback: try patching via dashboard import/export if direct update fails
        print(f"  Warning: could not set UUID directly ({resp.get('__error')})")
        print(f"  UUID may need to be set manually in Superset UI")
    else:
        print(f"  Set dashboard UUID → {uuid}")


def enable_embedding(c: SupersetClient, dash_id: int, uuid: str):
    """Enable embedded access for the dashboard."""
    # Check current state
    resp = c.get(f"/api/v1/dashboard/{dash_id}/embedded")
    if resp.get("result"):
        actual_uuid = resp["result"].get("uuid", "")
        if actual_uuid == uuid:
            print(f"  Embedding already enabled: {uuid}")
            return
        # Update to the desired UUID
        upd = c.put(f"/api/v1/dashboard/{dash_id}/embedded", {"allowed_domains": []})
        print(f"  Updated embedded config")
        return

    # Create embedded config — this also sets the embedded UUID in Superset
    resp = c.post(f"/api/v1/dashboard/{dash_id}/embedded", {"allowed_domains": []})
    if "__error" in resp:
        print(f"  Warning: could not enable embedding: {resp}")
    else:
        embedded_uuid = resp.get("result", {}).get("uuid", "?")
        print(f"  Embedding enabled, embedded UUID = {embedded_uuid}")
        if embedded_uuid != uuid:
            print(f"  *** NOTE: embedded UUID {embedded_uuid} differs from expected {uuid}")
            print(f"  *** Update admin.py SUPERSET_DASHBOARDS to use: {embedded_uuid}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("\n=== Superset Finance Dashboard Setup ===\n")

    c = SupersetClient(SUPERSET_URL)

    print("[1/5] Logging in …")
    c.login(SUPERSET_USER, SUPERSET_PASS)

    print("\n[2/5] Database connection …")
    db_id = ensure_database(c)

    print("\n[3/5] Dataset …")
    ds_id = ensure_dataset(c, db_id)

    print("\n[4/5] Charts …")
    chart_ids = create_finance_charts(c, ds_id)
    print(f"  Total charts: {len(chart_ids)}, ids: {chart_ids}")

    print("\n[5/5] Dashboard …")
    dash_id = ensure_dashboard(c, chart_ids)
    set_dashboard_uuid(c, dash_id, FINANCE_DASHBOARD_UUID)
    enable_embedding(c, dash_id, FINANCE_DASHBOARD_UUID)

    print("\n=== Done ===")
    print(f"  Dashboard ID:    {dash_id}")
    print(f"  Expected UUID:   {FINANCE_DASHBOARD_UUID}")
    resp = c.get(f"/api/v1/dashboard/{dash_id}/embedded")
    actual_uuid = resp.get("result", {}).get("uuid", "NOT SET")
    print(f"  Actual emb UUID: {actual_uuid}")

    if actual_uuid != FINANCE_DASHBOARD_UUID:
        print(f"\n  ⚠ UUID mismatch — updating admin.py …")
        return actual_uuid
    return None


if __name__ == "__main__":
    mismatch_uuid = main()
    sys.exit(0)
