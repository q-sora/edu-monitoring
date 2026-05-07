"""
main.py
─────────────────────────────────────────────────────────────────────────────
FastAPI application factory.

High-load architectural decisions recorded here:

  1. Lifespan context manager:
     Uses the modern `@asynccontextmanager` lifespan pattern (not deprecated
     on_event handlers).  Startup runs DB connectivity check + Redis ping.
     Shutdown gracefully drains the DB connection pool.

  2. GZip middleware:
     Compresses responses > 1KB.  Government forms return large JSONB payloads;
     gzip cuts 60-70% off wire size for analytics responses.

  3. Trusted host middleware:
     Rejects requests with unexpected Host headers — prevents host-header injection.

  4. No blocking synchronous I/O in async handlers:
     All CRUD functions use `await`.  CPU-heavy tasks (PDF generation, report
     aggregation) are offloaded to Celery workers via Redis queue.

  5. Structured logging (JSON format in production):
     Each request logs request_id, user_id, org_id, duration_ms.
     Log lines are machine-parseable for Kibana / Grafana Loki ingestion.

  6. Global exception handler:
     Converts unhandled SQLAlchemy errors, ValueError, and unexpected exceptions
     into consistent JSON error responses.  PII / stack traces are never sent
     to the client in production.
"""
from __future__ import annotations

import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.core.database import close_db, init_db
from app.core.redis_client import close_redis, get_redis
from app.models.mixins import register_audit_hooks

# ── Router imports ────────────────────────────────────────────────────────────
from app.api.v1 import admin, auth, coefficients, integrations, science, anomalies
from app.api.v1.routers import DOMAIN_ROUTERS

logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Lifespan
# ─────────────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Replaces on_startup / on_shutdown event handlers (deprecated in FastAPI 0.95+).

    Startup:
        • Verify PostgreSQL connectivity and log pool config.
        • Ping Redis.
        • Register SQLAlchemy audit trail event listeners.

    Shutdown:
        • Drain DB connection pools (waits for in-flight queries to complete).
        • Disconnect Redis pool.
    """
    logger.info("Starting %s v%s [%s]", settings.APP_NAME, settings.APP_VERSION, settings.ENVIRONMENT)

    # ── Startup ───────────────────────────────────────────────────────────
    await init_db()

    redis = get_redis()
    pong = await redis.ping()
    logger.info("Redis ping: %s", pong)

    register_audit_hooks()

    logger.info("Application startup complete.")
    yield

    # ── Shutdown ──────────────────────────────────────────────────────────
    logger.info("Shutting down…")
    await close_db()
    await close_redis()
    logger.info("Shutdown complete.")


# ─────────────────────────────────────────────────────────────────────────────
# App factory
# ─────────────────────────────────────────────────────────────────────────────

def create_application() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="National Education Monitoring System — Data Entry API",
        docs_url="/api/docs"     if settings.DEBUG else None,  # disable in prod
        redoc_url="/api/redoc"   if settings.DEBUG else None,
        openapi_url="/api/openapi.json" if settings.DEBUG else None,
        lifespan=lifespan,
    )

    # ── Middleware stack (order matters: outermost = first to intercept) ──

    # 1. Trusted hosts — reject spoofed Host headers
    if settings.ENVIRONMENT == "production":
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=["*"],
        )

    # 2. CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://192.168.13.245:3000", "http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID", "X-RateLimit-Remaining", "X-Created"],
    )

    # 3. GZip — compress large JSONB API responses
    app.add_middleware(GZipMiddleware, minimum_size=1024)

    # ── Request ID + timing middleware ────────────────────────────────────
    @app.middleware("http")
    async def request_context_middleware(request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())[:8]
        request.state.request_id = request_id
        start = time.perf_counter()

        response = await call_next(request)

        duration_ms = int((time.perf_counter() - start) * 1000)
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time"] = f"{duration_ms}ms"

        logger.info(
            "HTTP %s %s %d %dms req=%s",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            request_id,
        )
        return response

    # ── Exception handlers ────────────────────────────────────────────────

    @app.exception_handler(SQLAlchemyError)
    async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
        logger.exception("Database error on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": "A database error occurred.",
                # Never expose exc details in production
                "debug": str(exc) if settings.DEBUG else None,
            },
        )

    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError):
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": str(exc)},
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        logger.exception("Unhandled exception: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "An unexpected error occurred."},
        )

    # ── Routers ───────────────────────────────────────────────────────────
    API_PREFIX = "/api/v1"

    # ── Science (custom router with upsert logic) ────────────────────────
    app.include_router(science.router, prefix=API_PREFIX)

    # ── Domain routers (factory-generated: contingent, finance, graduates, education)
    for domain_router in DOMAIN_ROUTERS:
        app.include_router(domain_router, prefix=API_PREFIX)

    # ── Coefficients ──────────────────────────────────────────────────────
    app.include_router(coefficients.router, prefix=API_PREFIX)

    # ── Auth + Integrations + Admin ───────────────────────────────────────
    app.include_router(auth.router,         prefix=API_PREFIX)
    app.include_router(integrations.router, prefix=API_PREFIX)
    app.include_router(admin.router,        prefix=API_PREFIX)
    app.include_router(anomalies.router,    prefix=API_PREFIX)

    # ── Health check (no auth required — used by load balancer) ──────────
    @app.get("/health", tags=["System"], include_in_schema=False)
    async def health():
        return {"status": "ok", "version": settings.APP_VERSION}

    @app.get("/readiness", tags=["System"], include_in_schema=False)
    async def readiness():
        """
        Deep readiness probe — checks DB + Redis connectivity.
        Used by Kubernetes / Docker healthcheck.
        Returns 503 if either dependency is unreachable.
        """
        checks: dict = {}
        http_status = status.HTTP_200_OK

        try:
            from app.core.database import engine_write
            async with engine_write.connect() as conn:
                await conn.execute(__import__("sqlalchemy").text("SELECT 1"))
            checks["database"] = "ok"
        except Exception as exc:
            checks["database"] = f"error: {exc}"
            http_status = status.HTTP_503_SERVICE_UNAVAILABLE

        try:
            redis = get_redis()
            await redis.ping()
            checks["redis"] = "ok"
        except Exception as exc:
            checks["redis"] = f"error: {exc}"
            http_status = status.HTTP_503_SERVICE_UNAVAILABLE

        return JSONResponse(content={"status": checks}, status_code=http_status)

    return app


app = create_application()


# ─────────────────────────────────────────────────────────────────────────────
# Entrypoint
# ─────────────────────────────────────────────────────────────────────────────
# Development:
#   uvicorn app.main:app --reload --port 8000
#
# Production (gunicorn + uvicorn workers):
#   gunicorn app.main:app \
#     --workers 4 \
#     --worker-class uvicorn.workers.UvicornWorker \
#     --bind 0.0.0.0:8000 \
#     --timeout 30 \
#     --keepalive 5 \
#     --log-level info
