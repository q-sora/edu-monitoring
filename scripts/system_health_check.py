#!/usr/bin/env python3
"""
EDU Monitoring — System Health Check & Auto-Repair
Запускается ежедневно для диагностики и автовосстановления сервисов.
"""

import subprocess
import shutil
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

# ── Пути ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
COMPOSE_DIR = PROJECT_ROOT / "edu_backend"
LOG_DIR = PROJECT_ROOT / "logs"
HEALTH_LOG = LOG_DIR / "health_check.log"
REPORT_FILE = LOG_DIR / "maintenance_report.log"

LOG_DIR.mkdir(parents=True, exist_ok=True)

# ── Контейнеры ────────────────────────────────────────────────────────────────
REQUIRED_CONTAINERS = [
    "edu_postgres",
    "edu_redis",
    "edu_api",
    "edu_celery_worker",
    "edu_celery_beat",
]

OPTIONAL_CONTAINERS = [
    "edu_frontend",
    "edu_superset",
]

# ── Пороги ────────────────────────────────────────────────────────────────────
DISK_WARNING_PCT  = 80
DISK_CRITICAL_PCT = 90
RAM_WARNING_PCT   = 85
RAM_CRITICAL_PCT  = 95

CONTAINER_RESTART_WAIT_SEC = 15   # ожидание после рестарта контейнера
DB_RESTART_WAIT_SEC        = 30   # ожидание после рестарта postgres
DB_READY_RETRIES           = 6    # попыток проверки готовности

# ── Паттерны критических ошибок в логах ──────────────────────────────────────
CRITICAL_LOG_PATTERNS = [
    (re.compile(r"Traceback \(most recent call last\)", re.I),
     "Python Traceback"),
    (re.compile(r'"[A-Z]+ [^ ]+ HTTP/[\d.]+"\s+5\d{2}'),
     "HTTP 5xx error"),
    (re.compile(r"could not connect to server", re.I),
     "DB connection failed"),
    (re.compile(r"connection refused", re.I),
     "Connection refused"),
    (re.compile(r"\b(FATAL|CRITICAL)\b.*?(error|fail)", re.I),
     "Fatal/Critical error"),
    (re.compile(r"OperationalError", re.I),
     "DB OperationalError"),
    (re.compile(r"could not translate host name", re.I),
     "DNS resolution error"),
    (re.compile(r"connection pool.*overflow", re.I),
     "Connection pool overflow"),
    (re.compile(r"TimeoutError|timed out", re.I),
     "Timeout error"),
    (re.compile(r"OOM|Out of memory|Killed", re.I),
     "Out-of-memory event"),
]


# ── Логирование ───────────────────────────────────────────────────────────────

class Logger:
    STATUSES = {"OK": "✔", "FIXED": "⚡", "WARN": "⚠", "FAIL": "✘", "INFO": "·"}

    def __init__(self, log_path: Path):
        self._path = log_path
        self._buffer: list[str] = []

    def _ts(self) -> str:
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    def log(self, status: str, component: str, message: str):
        icon = self.STATUSES.get(status, "?")
        line = f"[{self._ts()}] [{status:4}] {icon} {component}: {message}"
        print(line)
        self._buffer.append(line)

    def ok(self, component: str, msg: str):   self.log("OK",   component, msg)
    def fixed(self, component: str, msg: str): self.log("FIXED", component, msg)
    def warn(self, component: str, msg: str):  self.log("WARN",  component, msg)
    def fail(self, component: str, msg: str):  self.log("FAIL",  component, msg)
    def info(self, component: str, msg: str):  self.log("INFO",  component, msg)

    def section(self, title: str):
        sep = "─" * 60
        lines = [f"\n{sep}", f"  {title}  [{self._ts()}]", sep]
        for l in lines:
            print(l)
            self._buffer.append(l)

    def flush(self):
        with open(self._path, "a", encoding="utf-8") as f:
            f.write("\n".join(self._buffer) + "\n")
        self._buffer.clear()


log = Logger(HEALTH_LOG)


# ── Утилиты subprocess ────────────────────────────────────────────────────────

def run(cmd: list[str], timeout: int = 30) -> tuple[int, str, str]:
    """Запускает команду, возвращает (returncode, stdout, stderr)."""
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True,
            timeout=timeout, env={**os.environ, "DOCKER_CLI_HINTS": "false"}
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return -1, "", "timeout"
    except Exception as e:
        return -1, "", str(e)


def docker_exec(container: str, cmd: list[str], env: dict | None = None,
                timeout: int = 15) -> tuple[int, str, str]:
    full_cmd = ["docker", "exec"]
    if env:
        for k, v in env.items():
            full_cmd += ["-e", f"{k}={v}"]
    full_cmd += [container] + cmd
    return run(full_cmd, timeout=timeout)


# ── Чтение .env ───────────────────────────────────────────────────────────────

def load_env(env_path: Path) -> dict[str, str]:
    env = {}
    if not env_path.exists():
        return env
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


_env_cache: dict[str, str] | None = None


def get_env() -> dict[str, str]:
    global _env_cache
    if _env_cache is None:
        _env_cache = load_env(COMPOSE_DIR / ".env")
    return _env_cache


def db_password() -> str:
    env = get_env()
    url = env.get("DATABASE_URL", "")
    m = re.search(r"://[^:]+:([^@]+)@", url)
    if m:
        return m.group(1)
    return env.get("DB_PASSWORD", "changeme")


def redis_password() -> str:
    env = get_env()
    url = env.get("REDIS_URL", "") or env.get("CELERY_BROKER_URL", "")
    m = re.search(r"://:([^@]+)@", url)
    if m:
        return m.group(1)
    return env.get("REDIS_PASSWORD", "changeme")


# ── 1. Проверка контейнеров ───────────────────────────────────────────────────

def get_container_statuses() -> dict[str, str]:
    """Возвращает {container_name: status_string}."""
    rc, out, _ = run(["docker", "ps", "-a",
                       "--format", "{{.Names}}\t{{.Status}}"])
    statuses: dict[str, str] = {}
    if rc == 0:
        for line in out.strip().splitlines():
            parts = line.split("\t", 1)
            if len(parts) == 2:
                statuses[parts[0].strip()] = parts[1].strip()
    return statuses


def is_running(status: str) -> bool:
    return status.lower().startswith("up")


def restart_container(name: str) -> bool:
    log.info(name, "Attempting docker restart …")
    rc, _, err = run(["docker", "restart", name], timeout=60)
    if rc == 0:
        time.sleep(CONTAINER_RESTART_WAIT_SEC)
        return True
    log.fail(name, f"Restart failed: {err.strip()}")
    return False


def check_containers() -> dict[str, str]:
    """
    Returns dict: container → "ok" | "fixed" | "fail" | "skip"
    """
    log.section("CONTAINER STATUS")
    statuses = get_container_statuses()
    results: dict[str, str] = {}

    all_containers = REQUIRED_CONTAINERS + OPTIONAL_CONTAINERS
    for name in all_containers:
        is_required = name in REQUIRED_CONTAINERS
        status = statuses.get(name)

        if status is None:
            if is_required:
                log.fail(name, "Not found in docker ps (not created?)")
                results[name] = "fail"
            else:
                log.info(name, "Not running (optional, profile-based — skipped)")
                results[name] = "skip"
            continue

        if is_running(status):
            log.ok(name, status)
            results[name] = "ok"
        else:
            log.warn(name, f"Down: {status}")
            if restart_container(name):
                # Verify it came back up
                new_statuses = get_container_statuses()
                new_status = new_statuses.get(name, "")
                if is_running(new_status):
                    log.fixed(name, f"Restarted successfully → {new_status}")
                    results[name] = "fixed"
                else:
                    log.fail(name, f"Still not running after restart: {new_status}")
                    results[name] = "fail"
            else:
                results[name] = "fail"

    return results


# ── 2. Анализ логов ───────────────────────────────────────────────────────────

def fetch_container_logs(name: str, tail: int = 1000) -> str:
    rc, out, err = run(
        ["docker", "logs", "--tail", str(tail), name],
        timeout=30
    )
    # docker logs смешивает stdout/stderr — оба нужны
    return out + err


def analyze_logs(container_results: dict[str, str]) -> dict[str, list[tuple[str, str]]]:
    """
    Для каждого запущенного контейнера ищет критические паттерны.
    Returns: {container: [(pattern_label, matched_line), ...]}
    """
    log.section("LOG ANALYSIS (last 1000 lines per container)")
    findings: dict[str, list[tuple[str, str]]] = {}

    checkable = [
        n for n, r in container_results.items()
        if r in ("ok", "fixed")
    ]

    for name in checkable:
        raw = fetch_container_logs(name)
        lines = raw.splitlines()
        hits: list[tuple[str, str]] = []

        for line in lines:
            for pattern, label in CRITICAL_LOG_PATTERNS:
                if pattern.search(line):
                    # Один хит на строку (первый паттерн-победитель)
                    hits.append((label, line.strip()[:200]))
                    break

        if hits:
            # Дедуплицируем: одинаковые (label, line) не дублируем
            seen: set[tuple[str, str]] = set()
            deduped = []
            for h in hits:
                if h not in seen:
                    seen.add(h)
                    deduped.append(h)

            log.warn(name, f"{len(deduped)} critical pattern(s) found in logs")
            findings[name] = deduped
        else:
            log.ok(name, "No critical patterns in last 1000 log lines")
            findings[name] = []

    return findings


# ── 3. Целостность БД ─────────────────────────────────────────────────────────

def check_postgres(container_results: dict[str, str]) -> str:
    """Returns "ok" | "fixed" | "fail" | "skip"."""
    log.section("DATABASE INTEGRITY — PostgreSQL")
    pg_status = container_results.get("edu_postgres", "skip")

    if pg_status == "skip" or pg_status == "fail":
        log.warn("PostgreSQL", "Container not running — skipping query check")
        return "skip"

    passwd = db_password()
    rc, out, err = docker_exec(
        "edu_postgres",
        ["psql", "-U", "edu_user", "-d", "edu_monitoring",
         "-c", "SELECT 1 AS health_check;"],
        env={"PGPASSWORD": passwd},
    )

    if rc == 0 and "health_check" in out:
        log.ok("PostgreSQL", "SELECT 1 → OK")
        return "ok"

    # Попытка перезапустить
    log.warn("PostgreSQL", f"Query failed (rc={rc}): {err.strip()[:150]}")
    if restart_container("edu_postgres"):
        time.sleep(DB_RESTART_WAIT_SEC)
        # Ждём готовности
        for attempt in range(1, DB_READY_RETRIES + 1):
            rc2, out2, _ = docker_exec(
                "edu_postgres",
                ["psql", "-U", "edu_user", "-d", "edu_monitoring",
                 "-c", "SELECT 1 AS health_check;"],
                env={"PGPASSWORD": passwd},
            )
            if rc2 == 0 and "health_check" in out2:
                log.fixed("PostgreSQL", f"Recovered after restart (attempt {attempt})")
                return "fixed"
            log.info("PostgreSQL", f"Not ready yet (attempt {attempt}/{DB_READY_RETRIES}) …")
            time.sleep(10)

    log.fail("PostgreSQL", "Database unavailable after restart attempts")
    return "fail"


def check_redis(container_results: dict[str, str]) -> str:
    """Returns "ok" | "fixed" | "fail" | "skip"."""
    log.section("DATABASE INTEGRITY — Redis")
    redis_status = container_results.get("edu_redis", "skip")

    if redis_status == "skip" or redis_status == "fail":
        log.warn("Redis", "Container not running — skipping ping check")
        return "skip"

    passwd = redis_password()

    def _ping() -> bool:
        cmd = ["redis-cli"]
        if passwd:
            cmd += ["-a", passwd]
        cmd.append("ping")
        rc, out, _ = docker_exec("edu_redis", cmd)
        return rc == 0 and "PONG" in out

    if _ping():
        log.ok("Redis", "PING → PONG")
        return "ok"

    log.warn("Redis", "Ping failed, attempting restart …")
    if restart_container("edu_redis"):
        time.sleep(CONTAINER_RESTART_WAIT_SEC)
        if _ping():
            log.fixed("Redis", "Recovered after restart")
            return "fixed"

    log.fail("Redis", "Redis unavailable after restart")
    return "fail"


# ── 4. Системные ресурсы ──────────────────────────────────────────────────────

def check_disk() -> str:
    """Returns "ok" | "warn" | "critical"."""
    log.section("SYSTEM RESOURCES — Disk")
    total, used, free = shutil.disk_usage("/")
    pct = used * 100 // total
    free_gb = free / (1024 ** 3)
    total_gb = total / (1024 ** 3)

    msg = f"{pct}% used — {free_gb:.1f} GB free / {total_gb:.1f} GB total"

    if pct >= DISK_CRITICAL_PCT:
        log.fail("Disk", f"CRITICAL: {msg}")
        return "critical"
    elif pct >= DISK_WARNING_PCT:
        log.warn("Disk", f"WARNING: {msg}")
        return "warn"
    else:
        log.ok("Disk", msg)
        return "ok"


def check_memory() -> str:
    """Returns "ok" | "warn" | "critical". Reads /proc/meminfo."""
    log.section("SYSTEM RESOURCES — Memory")
    try:
        meminfo: dict[str, int] = {}
        with open("/proc/meminfo", encoding="utf-8") as f:
            for line in f:
                parts = line.split()
                if len(parts) >= 2:
                    key = parts[0].rstrip(":")
                    meminfo[key] = int(parts[1])  # kB

        total_kb  = meminfo.get("MemTotal", 0)
        avail_kb  = meminfo.get("MemAvailable", meminfo.get("MemFree", 0))
        used_kb   = total_kb - avail_kb
        pct       = used_kb * 100 // total_kb if total_kb else 0
        avail_gb  = avail_kb / (1024 ** 2)
        total_gb  = total_kb / (1024 ** 2)

        msg = (f"{pct}% used — {avail_gb:.1f} GB available / "
               f"{total_gb:.1f} GB total")

        if pct >= RAM_CRITICAL_PCT:
            log.fail("Memory", f"CRITICAL: {msg}")
            return "critical"
        elif pct >= RAM_WARNING_PCT:
            log.warn("Memory", f"WARNING: {msg}")
            return "warn"
        else:
            log.ok("Memory", msg)
            return "ok"

    except Exception as e:
        log.warn("Memory", f"Could not read /proc/meminfo: {e}")
        return "warn"


# ── 5. Отчёт о неисправимых проблемах ────────────────────────────────────────

def write_maintenance_report(
    container_results: dict[str, str],
    log_findings: dict[str, list[tuple[str, str]]],
    pg_result: str,
    redis_result: str,
    disk_result: str,
    mem_result: str,
):
    failed_containers = [n for n, r in container_results.items() if r == "fail"]
    containers_with_errors = {
        n: hits for n, hits in log_findings.items() if hits
    }
    critical_resources = [
        r for r in [(disk_result, "Disk"), (mem_result, "Memory")]
        if r[0] in ("critical", "fail")
    ]

    has_issues = (
        failed_containers
        or containers_with_errors
        or pg_result == "fail"
        or redis_result == "fail"
        or critical_resources
    )

    if not has_issues:
        return  # нечего писать в отчёт

    now = datetime.now()
    sep = "=" * 70
    lines = [
        sep,
        f"MAINTENANCE REPORT — {now.strftime('%Y-%m-%d %H:%M:%S')}",
        f"Host: {os.uname().nodename}",
        sep,
    ]

    if failed_containers:
        lines.append("\n[CONTAINERS NOT RECOVERED]")
        for name in failed_containers:
            lines.append(f"  • {name} — auto-restart FAILED")
        lines.append("  → Manual action required: docker compose up -d <service>")

    if pg_result == "fail":
        lines.append("\n[POSTGRESQL UNAVAILABLE]")
        lines.append("  → Check: docker compose logs postgres")
        lines.append("  → Try:   docker compose restart postgres")

    if redis_result == "fail":
        lines.append("\n[REDIS UNAVAILABLE]")
        lines.append("  → Check: docker compose logs redis")
        lines.append("  → Try:   docker compose restart redis")

    if critical_resources:
        lines.append("\n[CRITICAL RESOURCE USAGE]")
        for result, name in critical_resources:
            lines.append(f"  • {name}: {result.upper()}")
        lines.append("  → Investigate disk usage: du -sh /var/lib/docker/volumes/*")

    if containers_with_errors:
        lines.append("\n[LOG ANOMALIES (require review)]")
        for container, hits in containers_with_errors.items():
            lines.append(f"\n  Container: {container}")
            for label, line in hits[:20]:  # max 20 примеров на контейнер
                lines.append(f"    [{label}] {line}")
            if len(hits) > 20:
                lines.append(f"    … and {len(hits) - 20} more occurrences")

    lines.append(f"\n{sep}")
    lines.append("END OF REPORT")
    lines.append(sep)

    with open(REPORT_FILE, "a", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n\n")

    log.warn("Report", f"Maintenance report written → {REPORT_FILE}")


# ── Сводка ────────────────────────────────────────────────────────────────────

def print_summary(
    container_results: dict[str, str],
    pg_result: str,
    redis_result: str,
    disk_result: str,
    mem_result: str,
    log_findings: dict[str, list[tuple[str, str]]],
):
    log.section("SUMMARY")

    all_ok = True
    rows = []

    for name, res in container_results.items():
        rows.append((f"Container {name}", res))
        if res == "fail":
            all_ok = False

    rows.append(("PostgreSQL query", pg_result))
    rows.append(("Redis ping",       redis_result))
    rows.append(("Disk usage",       disk_result))
    rows.append(("Memory usage",     mem_result))

    for label, status in rows:
        icon = {"ok": "✔", "fixed": "⚡", "warn": "⚠",
                "fail": "✘", "skip": "–", "critical": "✘"}.get(status, "?")
        print(f"  {icon}  {label:<35} {status.upper()}")
        if status in ("fail", "critical"):
            all_ok = False

    total_log_hits = sum(len(v) for v in log_findings.values())
    if total_log_hits:
        log.warn("Logs",
                 f"{total_log_hits} critical pattern(s) in logs across "
                 f"{sum(1 for v in log_findings.values() if v)} container(s)")
        all_ok = False

    print()
    if all_ok:
        log.ok("System", "All checks passed — system healthy")
    else:
        log.warn("System", "Issues detected — see maintenance_report.log")

    return all_ok


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> int:
    log.section(f"EDU MONITORING — HEALTH CHECK START")
    log.info("System", f"Project root: {PROJECT_ROOT}")
    log.info("System", f"Compose dir:  {COMPOSE_DIR}")

    container_results = check_containers()
    pg_result         = check_postgres(container_results)
    redis_result      = check_redis(container_results)
    log_findings      = analyze_logs(container_results)
    disk_result       = check_disk()
    mem_result        = check_memory()

    write_maintenance_report(
        container_results, log_findings,
        pg_result, redis_result, disk_result, mem_result,
    )

    ok = print_summary(
        container_results, pg_result, redis_result,
        disk_result, mem_result, log_findings,
    )

    log.flush()
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
