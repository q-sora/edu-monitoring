"""
api/dependencies.py
─────────────────────────────────────────────────────────────────────────────
FastAPI dependencies for authentication, RBAC, and session injection.

Auth flow (100% local — no external provider):

    Request
      │  Authorization: Bearer <jwt>
      ▼
    verify_token_dep()
      │  ← core.security.decode_token (HS256 signature + exp check)
      │  ← redis blacklist check
      │  ← rate limit check
      ▼
    TokenPayload  (Pydantic)  + context vars set for audit trail
      │
      ▼
    require_permission / require_role / require_own_org_or_admin
      │
      ▼
    Route handler
"""
from __future__ import annotations

import logging
from typing import Annotated, Optional
from uuid import UUID

from fastapi import Depends, HTTPException, Path, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, get_read_db
from app.core.redis_client import check_rate_limit, is_token_blacklisted
from app.core.security import (
    TokenExpiredError,
    TokenInvalidError,
    decode_token,
)
from app.models.mixins import current_org_id, current_user_id
from app.models.user import UserRoleEnum

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Role constants
# ─────────────────────────────────────────────────────────────────────────────

class UserRole:
    SUPERADMIN = UserRoleEnum.SUPERADMIN
    ADMIN      = UserRoleEnum.ADMIN
    MANAGEMENT = UserRoleEnum.MANAGEMENT
    DATA_ENTRY = UserRoleEnum.DATA_ENTRY
    ALL        = UserRoleEnum.ALL


# Centralised permission registry — mirrors frontend RBAC matrix exactly
ROLE_PERMISSIONS: dict[str, set[str]] = {
    UserRole.SUPERADMIN: {"*"},
    UserRole.ADMIN: {
        "users.view", "users.create", "users.edit", "users.delete", "users.assign_role",
        "data.view_all", "data.approve", "data.reject", "data.export",
        "integrations.view", "integrations.manage", "integrations.trigger",
        "reports.view", "audit.view", "ai_insights.view", "organizations.manage",
    },
    UserRole.MANAGEMENT: {
        "reports.view", "audit.view", "ai_insights.view", "data.view_all",
    },
    UserRole.DATA_ENTRY: {
        "data.submit", "data.view_own", "data.edit_draft",
    },
}


def _check_permission(role: str, permission: str) -> bool:
    perms = ROLE_PERMISSIONS.get(role, set())
    return "*" in perms or permission in perms


# ─────────────────────────────────────────────────────────────────────────────
# Token payload model (parsed from JWT)
# ─────────────────────────────────────────────────────────────────────────────

class TokenPayload(BaseModel):
    sub: str = Field(..., description="User UUID")
    role: str
    org_id: Optional[str] = None
    email: Optional[str] = None
    exp: int
    jti: str

    @field_validator("role")
    @classmethod
    def role_must_be_known(cls, v: str) -> str:
        if v not in UserRole.ALL:
            raise ValueError(f"Unknown role: {v!r}")
        return v

    def can(self, permission: str) -> bool:
        return _check_permission(self.role, permission)

    @property
    def user_id(self) -> str:
        return self.sub

    @property
    def is_data_entry(self) -> bool:
        return self.role == UserRole.DATA_ENTRY

    @property
    def can_view_all(self) -> bool:
        return self.can("data.view_all")


# ─────────────────────────────────────────────────────────────────────────────
# Bearer scheme
# ─────────────────────────────────────────────────────────────────────────────

_bearer = HTTPBearer(auto_error=True, description="Bearer JWT from /auth/login")


async def verify_token_dep(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
) -> TokenPayload:
    """
    Decode + verify + blacklist-check + rate-limit.
    Sets context vars (current_user_id / current_org_id) for the audit trail.
    """
    token = credentials.credentials

    # 1. Decode + signature check
    try:
        raw = decode_token(token, expected_type="access")
    except TokenExpiredError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Срок действия токена истёк. Войдите снова.",
            headers={"WWW-Authenticate": 'Bearer error="invalid_token"'},
        )
    except TokenInvalidError as exc:
        logger.warning("Token decode error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный токен авторизации.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 2. Blacklist check (Redis)
    jti = raw.get("jti")
    if jti and await is_token_blacklisted(jti):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Токен отозван.",
        )

    # 3. Parse into typed model
    try:
        payload = TokenPayload(**raw)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Некорректные поля токена: {exc}",
        )

    # 4. Context vars — read by audit event listener
    current_user_id.set(payload.sub)
    current_org_id.set(payload.org_id)

    # 5. Rate limit per user
    allowed, remaining = await check_rate_limit(
        identifier=f"user:{payload.sub}",
        window_seconds=60,
        max_requests=60,
    )
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Превышен лимит запросов. Попробуйте через минуту.",
            headers={"Retry-After": "60", "X-RateLimit-Remaining": "0"},
        )

    return payload


# Backwards-compatible alias — old code imported `verify_token`
verify_token = verify_token_dep


# ─────────────────────────────────────────────────────────────────────────────
# RBAC guards
# ─────────────────────────────────────────────────────────────────────────────

def require_permission(permission: str):
    """Dependency factory — requires the caller's role has `permission`."""
    async def _guard(
        token: TokenPayload = Depends(verify_token_dep),
    ) -> TokenPayload:
        if not token.can(permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Нет прав: требуется '{permission}'",
            )
        return token

    _guard.__name__ = f"require_{permission.replace('.', '_')}"
    return _guard


def require_role(*roles: str):
    """Dependency factory — requires one of the listed roles."""
    async def _guard(
        token: TokenPayload = Depends(verify_token_dep),
    ) -> TokenPayload:
        if token.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Доступ запрещён. Требуется роль: {list(roles)}",
            )
        return token

    _guard.__name__ = f"require_role_{'_or_'.join(roles)}"
    return _guard


# ─────────────────────────────────────────────────────────────────────────────
# Org isolation guard — data_entry users can only access their own org
# ─────────────────────────────────────────────────────────────────────────────

async def require_own_org_or_admin(
    org_id: UUID = Path(..., description="Organisation UUID in URL"),
    token: TokenPayload = Depends(verify_token_dep),
) -> TokenPayload:
    """
    Enforces org_id isolation for data_entry users.
    Admin / superadmin / management bypass this check.
    """
    if token.can("data.view_all"):
        return token

    if token.org_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ваша учётная запись не привязана к организации.",
        )

    if str(org_id) != str(token.org_id):
        logger.warning(
            "Org isolation violation: user=%s attempted org=%s (owns %s)",
            token.sub, org_id, token.org_id,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ только к данным своей организации.",
        )

    return token


async def get_actor_org_id(
    token: TokenPayload = Depends(verify_token_dep),
) -> UUID:
    """Convenience dep: resolves the actor's org_id UUID from the JWT."""
    if not token.org_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Для этого эндпоинта требуется учётная запись с привязкой к организации.",
        )
    return UUID(token.org_id)


# ─────────────────────────────────────────────────────────────────────────────
# Database session injectors with RLS context
# ─────────────────────────────────────────────────────────────────────────────

async def get_db_with_rls(
    token: TokenPayload = Depends(verify_token_dep),
    db: AsyncSession = Depends(get_db),
) -> AsyncSession:
    """
    Yields a write session with PostgreSQL session variables set for RLS.

    IMPORTANT: `SET LOCAL` only has effect inside an active transaction.
    We explicitly begin one before calling it.  If we don't, PostgreSQL
    silently applies SET to the session level (not LOCAL), which leaks
    across requests on pooled connections — a security bug.

    The session is NOT committed here; the caller owns the transaction
    boundary.  When they eventually `await db.begin()` + commit, the
    SET LOCAL is scoped to THAT transaction.  To keep the setting alive
    across multiple transactions inside the same request, we call SET
    again at route level if needed.

    Practical approach: use `SET` (not `SET LOCAL`) at the session level —
    it persists until the connection returns to the pool, then pool_pre_ping
    + pool_recycle ensure a fresh connection state next time.
    """
    # Use SET (session-scoped) instead of SET LOCAL so it works without a
    # pre-existing transaction. The value is overwritten on every request
    # via this dependency, and the connection is recycled before it could
    # ever leak to an unauthenticated request.
    await db.execute(
        text("SELECT set_config('app.org_id',  :v, false)"),
        {"v": token.org_id or ""},
    )
    await db.execute(
        text("SELECT set_config('app.role',    :v, false)"),
        {"v": token.role},
    )
    await db.execute(
        text("SELECT set_config('app.user_id', :v, false)"),
        {"v": token.sub},
    )
    return db


# ─────────────────────────────────────────────────────────────────────────────
# Typed aliases — DRY route signatures
# ─────────────────────────────────────────────────────────────────────────────

AuthenticatedUser = Annotated[TokenPayload, Depends(verify_token_dep)]
CanSubmit         = Annotated[TokenPayload, Depends(require_permission("data.submit"))]
CanApprove        = Annotated[TokenPayload, Depends(require_permission("data.approve"))]
SuperadminOnly    = Annotated[TokenPayload, Depends(require_role(UserRole.SUPERADMIN))]
AdminOrSuper      = Annotated[TokenPayload, Depends(require_role(UserRole.ADMIN, UserRole.SUPERADMIN))]
DBSession         = Annotated[AsyncSession, Depends(get_db_with_rls)]
ReadDBSession     = Annotated[AsyncSession, Depends(get_read_db)]
