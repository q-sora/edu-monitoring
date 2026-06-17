"""
workers/celery_app.py
─────────────────────────────────────────────────────────────────────────────
Celery application configuration.

Why Celery for external syncs (not BackgroundTasks)?
────────────────────────────────────────────────────
    FastAPI's BackgroundTasks runs in the same process as the web server.
    If the process restarts mid-sync (deployment, crash), the task is lost.
    Celery tasks are persisted in Redis — they survive restarts and can be
    retried with exponential backoff.

    BackgroundTasks is fine for:
        • Logging / notifications (fire-and-forget, acceptable to lose)
        • Short tasks (< 1 second)

    Celery is required for:
        • External API calls (НОБД, ЕПВО) that take 2-10 seconds
        • Bulk DB inserts (thousands of rows)
        • Tasks that must retry on failure

Worker start command:
    celery -A app.workers.celery_app worker --loglevel=info --concurrency=4

Beat (scheduled tasks):
    celery -A app.workers.celery_app beat --loglevel=info
"""
from __future__ import annotations

from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery(
    "edu_monitoring",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.workers.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Almaty",
    enable_utc=True,
    # Retry settings
    task_acks_late=True,             # only ack after task completes (not on receipt)
    task_reject_on_worker_lost=True, # re-queue on worker crash
    worker_prefetch_multiplier=1,    # process one task at a time per worker (fair distribution)
    # Result expiry
    result_expires=3600,             # 1 hour
    # Rate limiting per task
    task_annotations={
        "app.workers.tasks.sync_from_external": {"rate_limit": "10/m"},
    },
    # Scheduled tasks (beat)
    beat_schedule={
        "sync-nobd-daily": {
            "task":     "app.workers.tasks.sync_from_external",
            "schedule": crontab(hour=2, minute=0),         # 02:00 AST every day
            "args":     ("НОБД", False),                   # source, full_sync=False
        },
        "sync-epvo-daily": {
            "task":     "app.workers.tasks.sync_from_external",
            "schedule": crontab(hour=2, minute=30),
            "args":     ("ЕПВО", False),
        },
        "sync-nobd-weekly-full": {
            "task":     "app.workers.tasks.sync_from_external",
            "schedule": crontab(hour=1, minute=0, day_of_week="monday"),
            "args":     ("НОБД", True),                    # full sync every Monday
        },
    },
)
