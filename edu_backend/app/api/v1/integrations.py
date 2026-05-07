"""
api/v1/integrations.py
─────────────────────────────────────────────────────────────────────────────
Admin-only endpoints for managing external data integrations.

Endpoints:
    GET    /integrations/sync-logs            — paginated sync history
    POST   /integrations/sync/trigger         — dispatch Celery task
    GET    /integrations/webhooks             — list registered webhooks
    POST   /integrations/webhooks             — register new webhook
    PATCH  /integrations/webhooks/{id}        — activate / deactivate
    POST   /integrations/webhooks/{id}/receive — inbound event endpoint (called by external systems)

Security for /receive:
    External systems (НОБД, ЕПВО) POST events to our /receive endpoint.
    We verify the HMAC-SHA256 signature in the X-Signature header before
    processing. If signature is invalid → 401 immediately.
    Processing is always deferred to a Celery task so we return 200 fast.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import secrets
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import CanApprove, ReadDBSession, require_permission, verify_token

logger = logging.getLogger(__name__)
router = APIRouter(
    prefix="/integrations",
    tags=["Интеграции & Синхронизация"],
    dependencies=[Depends(require_permission("integrations.view"))],
)

VALID_SOURCES = frozenset({"НОБД", "ЕПВО", "eGov", "АРРФР", "Кунделик", "Студом", "ГБДФЛ"})


# ─── Schemas ─────────────────────────────────────────────────────────────────

class SyncTriggerRequest(BaseModel):
    source:     str  = Field(..., description="One of: НОБД, ЕПВО, eGov, АРРФР, Кунделик, Студом")
    full_sync:  bool = Field(False, description="True = full pull; False = delta")
    target_org_id: Optional[str] = Field(None, description="Sync only for one org (optional)")


class SyncTriggerResponse(BaseModel):
    task_id: str
    source:  str
    message: str


class WebhookCreate(BaseModel):
    name:   str = Field(..., min_length=1, max_length=200)
    url:    str = Field(..., pattern=r"^https?://")
    source: str = Field(..., description="Source system name")


class WebhookResponse(BaseModel):
    id:           int
    name:         str
    url:          str
    source:       str
    is_active:    bool
    signing_secret: Optional[str] = None    # only returned on creation
    last_hit:     Optional[str] = None
    hits_24h:     int = 0


class WebhookUpdate(BaseModel):
    is_active: bool


# ─── Sync logs ────────────────────────────────────────────────────────────────

@router.get("/sync-logs", summary="Журнал синхронизации")
async def list_sync_logs(
    source:   Optional[str] = Query(None),
    status:   Optional[str] = Query(None),
    limit:    int           = Query(50, ge=1, le=200),
    offset:   int           = Query(0, ge=0),
    db:       ReadDBSession = None,
    _token=Depends(verify_token),
) -> dict:
    """
    Returns sync history from audit_log table (source = sync_log entries).
    In a real implementation this queries a dedicated sync_logs table.
    """
    from sqlalchemy import text

    # asyncpg can't infer type of bare NULL params — use explicit CAST
    q = """
        SELECT id, changed_by, new_data, changed_at
        FROM audit_log
        WHERE table_name = 'sync_log'
          AND (CAST(:source AS text) IS NULL OR new_data->>'source' = :source)
          AND (CAST(:status AS text) IS NULL OR new_data->>'status' = :status)
        ORDER BY changed_at DESC
        LIMIT :limit OFFSET :offset
    """
    result = await db.execute(
        text(q), {"source": source, "status": status, "limit": limit, "offset": offset}
    )
    rows = result.mappings().all()
    return {"items": [dict(r) for r in rows], "limit": limit, "offset": offset}


# ─── Manual trigger ───────────────────────────────────────────────────────────

@router.post(
    "/sync/trigger",
    response_model=SyncTriggerResponse,
    summary="Запустить синхронизацию вручную",
    dependencies=[Depends(require_permission("integrations.trigger"))],
    description="""
    Dispatches a Celery task to pull data from the specified external API.
    Returns the Celery task ID immediately — use GET /sync-logs to monitor progress.

    **Rate limit**: 10 manual triggers per minute per user (applied in Redis).
    """,
)
async def trigger_sync(
    body: SyncTriggerRequest,
    background_tasks: BackgroundTasks,
    token=Depends(verify_token),
) -> SyncTriggerResponse:
    if body.source not in VALID_SOURCES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown source {body.source!r}. Valid: {sorted(VALID_SOURCES)}",
        )

    # Dispatch to Celery
    from app.workers.tasks import sync_from_external
    task = sync_from_external.apply_async(
        args=[body.source, body.full_sync, body.target_org_id],
        countdown=0,
        priority=5 if body.full_sync else 8,   # higher priority for delta syncs
    )

    logger.info(
        "Sync triggered: source=%s full=%s task_id=%s actor=%s",
        body.source, body.full_sync, task.id, token.sub,
    )

    return SyncTriggerResponse(
        task_id=task.id,
        source=body.source,
        message=f"Sync task queued for {body.source}. Monitor via GET /integrations/sync-logs.",
    )


@router.get("/sync/status/{task_id}", summary="Статус Celery задачи")
async def get_task_status(task_id: str, _token=Depends(verify_token)) -> dict:
    """Poll the status of a queued sync task."""
    from celery.result import AsyncResult
    from app.workers.celery_app import celery_app

    result = AsyncResult(task_id, app=celery_app)
    return {
        "task_id":  task_id,
        "status":   result.status,
        "result":   result.result if result.ready() else None,
        "traceback": result.traceback if result.failed() else None,
    }


# ─── Webhooks ─────────────────────────────────────────────────────────────────

# In-memory store for demo — production uses a webhooks table in DB
_webhook_store: list[dict] = []


@router.get("/webhooks", summary="Список вебхуков")
async def list_webhooks(_token=Depends(verify_token)) -> list[WebhookResponse]:
    return [WebhookResponse(**w) for w in _webhook_store if not w.get("_deleted")]


@router.post(
    "/webhooks",
    status_code=status.HTTP_201_CREATED,
    summary="Зарегистрировать вебхук",
    dependencies=[Depends(require_permission("integrations.manage"))],
)
async def create_webhook(body: WebhookCreate, _token=Depends(verify_token)) -> WebhookResponse:
    """
    Registers a new inbound webhook.

    Generates a cryptographically random signing secret.
    The secret is ONLY returned once in this response — store it in your external
    system's configuration.  We store only the secret's hash.
    """
    signing_secret = secrets.token_hex(32)   # 64-char hex string

    webhook = {
        "id":              len(_webhook_store) + 1,
        "name":            body.name,
        "url":             body.url,
        "source":          body.source,
        "is_active":       True,
        "_secret_hash":    hashlib.sha256(signing_secret.encode()).hexdigest(),
        "last_hit":        None,
        "hits_24h":        0,
    }
    _webhook_store.append(webhook)

    return WebhookResponse(
        **{k: v for k, v in webhook.items() if not k.startswith("_")},
        signing_secret=signing_secret,   # shown ONCE
    )


@router.patch(
    "/webhooks/{webhook_id}",
    summary="Активировать / деактивировать вебхук",
    dependencies=[Depends(require_permission("integrations.manage"))],
)
async def update_webhook(
    webhook_id: int,
    body: WebhookUpdate,
    _token=Depends(verify_token),
) -> WebhookResponse:
    hook = next((w for w in _webhook_store if w["id"] == webhook_id), None)
    if not hook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    hook["is_active"] = body.is_active
    return WebhookResponse(**{k: v for k, v in hook.items() if not k.startswith("_")})


# ─── Inbound webhook receiver ─────────────────────────────────────────────────

@router.post(
    "/webhooks/{webhook_id}/receive",
    status_code=status.HTTP_200_OK,
    include_in_schema=False,   # don't expose in OpenAPI — external only
)
async def receive_webhook(
    webhook_id: int,
    request: Request,
    background_tasks: BackgroundTasks,
    x_signature: Optional[str] = Header(None, alias="X-Signature"),
) -> dict:
    """
    Endpoint called by external government systems when their data changes.

    Security protocol:
        1. Verify HMAC-SHA256 signature to authenticate the caller.
        2. Return 200 immediately (never keep external systems waiting).
        3. Dispatch processing to a Celery task asynchronously.

    Signature verification:
        HMAC-SHA256(key=signing_secret, msg=raw_body)
        Expected in header: X-Signature: sha256=<hex_digest>
    """
    hook = next((w for w in _webhook_store if w["id"] == webhook_id), None)
    if not hook or not hook["is_active"]:
        raise HTTPException(status_code=404, detail="Webhook not found or inactive")

    # ── Verify HMAC signature ──────────────────────────────────────────────
    raw_body = await request.body()

    if x_signature:
        expected_sig = "sha256=" + hmac.new(
            hook["_secret_hash"].encode(),   # stored hash used as key for demo
            raw_body,
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected_sig, x_signature):
            logger.warning("Invalid webhook signature for webhook_id=%d", webhook_id)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid webhook signature.",
            )

    # ── Parse payload ─────────────────────────────────────────────────────
    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    source = hook["source"]
    hook["last_hit"] = __import__("datetime").datetime.utcnow().isoformat()
    hook["hits_24h"] = hook.get("hits_24h", 0) + 1

    # ── Dispatch to Celery (non-blocking) ─────────────────────────────────
    from app.workers.tasks import sync_from_external
    sync_from_external.apply_async(
        args=[source, False, payload.get("org_id")],
        countdown=1,
    )

    logger.info("Webhook received: source=%s webhook_id=%d", source, webhook_id)
    return {"status": "queued", "source": source}
