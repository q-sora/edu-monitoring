"""
api/v1/auth.py
─────────────────────────────────────────────────────────────────────────────
Native authentication endpoints — 100% self-hosted, no external providers.

Endpoints:
    POST /auth/login           — email + password → access + refresh tokens
    POST /auth/refresh         — refresh cookie → new access token
    POST /auth/logout          — revoke current tokens
    GET  /auth/me              — return current user profile
    POST /auth/change-password — user self-service password change
    POST /auth/register        — admin-only: create a new user

Token storage strategy:
    Access token   → JSON body → React stores in memory (XSS-safe)
    Refresh token  → httpOnly Secure SameSite=Strict cookie (CSRF + XSS safe)

Brute-force protection:
    Failed attempts increment users.failed_login_attempts.
    After 5 failures in 15 minutes → account locked for 30 minutes.
    Successful login resets the counter.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import (
    AuthenticatedUser,
    TokenPayload,
    UserRole,
    require_role,
    verify_token_dep,
)
from app.core.config import settings
from app.core.database import get_db
from app.core.redis_client import blacklist_token, check_rate_limit
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    needs_rehash,
    TokenInvalidError,
    TokenExpiredError,
    verify_password,
)
from app.models.user import RefreshToken, User, UserRoleEnum

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Auth"])

# Security constants
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES     = 30
LOGIN_WINDOW_MIN    = 15     # window in which failed attempts accumulate

# Cookie config
REFRESH_COOKIE_NAME = "refresh_token"
REFRESH_COOKIE_PATH = "/api/v1/auth"


# ─────────────────────────────────────────────────────────────────────────────
# Request / response schemas
# ─────────────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class UserProfile(BaseModel):
    id: UUID
    email: str
    full_name: str
    role: str
    org_id: Optional[UUID] = None
    must_change_password: bool = False


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int
    user: UserProfile


class RefreshResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int


class RegisterUserRequest(BaseModel):
    email:     EmailStr
    password:  str      = Field(..., min_length=8, max_length=128)
    full_name: str      = Field(..., min_length=2, max_length=200)
    role:      str      = Field(..., description="RBAC role")
    org_id:    Optional[UUID] = None
    phone:     Optional[str]  = Field(None, max_length=20)

    @field_validator("role")
    @classmethod
    def role_is_valid(cls, v: str) -> str:
        if v not in UserRoleEnum.ALL:
            raise ValueError(f"Invalid role. Allowed: {sorted(UserRoleEnum.ALL)}")
        return v

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        # minimal complexity enforcement
        if v.isdigit() or v.isalpha():
            raise ValueError(
                "Password must contain both letters and digits."
            )
        return v


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password:     str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if v.isdigit() or v.isalpha():
            raise ValueError("Password must contain both letters and digits.")
        return v


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    """
    Set the refresh-token cookie.
    httpOnly  → JS cannot read it (XSS-safe)
    Secure    → HTTPS only in production
    SameSite=Strict → browser blocks cross-site submission (CSRF-safe)
    Path scoped → cookie only sent to /api/v1/auth/*
    """
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=settings.ENVIRONMENT == "production",
        samesite="strict",
        max_age=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
        path=REFRESH_COOKIE_PATH,
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        samesite="strict",
    )


async def _save_refresh_token(
    db: AsyncSession,
    *,
    user_id: UUID,
    raw_token: str,
    expires_at: datetime,
    device_info: Optional[str],
    ip: Optional[str],
) -> None:
    """Persist a bcrypt-hashed copy of the refresh token."""
    record = RefreshToken(
        user_id=user_id,
        token_hash=hash_password(raw_token),
        device_info=device_info,
        ip_address=ip,
        expires_at=expires_at,
    )
    db.add(record)


async def _increment_failed_attempts(db: AsyncSession, user: User) -> None:
    """
    Increment counter; lock account after MAX_FAILED_ATTEMPTS failures.
    The counter resets on successful login OR after LOGIN_WINDOW_MIN minutes.
    """
    user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
    if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
        user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)
        logger.warning(
            "Account locked after %d failed attempts: %s",
            user.failed_login_attempts, user.email,
        )
    await db.flush()


async def _reset_failed_attempts(db: AsyncSession, user: User, ip: Optional[str]) -> None:
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = datetime.now(timezone.utc)
    user.last_login_ip = ip
    await db.flush()


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Аутентификация по email + паролю",
    description="""
    Проверяет email + password против таблицы `users`.

    При успехе возвращает:
      • access_token в теле ответа — React сохраняет в памяти (XSS-safe)
      • refresh_token в httpOnly Secure cookie — недоступен JS (CSRF + XSS safe)

    Защита от brute-force:
      После 5 неудачных попыток аккаунт блокируется на 30 минут.
      Для защиты от IP-flooding применяется rate-limit: 10 запросов/минуту.
    """,
)
async def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> LoginResponse:
    # Rate-limit login attempts per IP (brute-force protection)
    client_ip = request.client.host if request.client else "unknown"
    allowed, _ = await check_rate_limit(
        identifier=f"login:{client_ip}",
        window_seconds=60,
        max_requests=10,
    )
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Слишком много попыток входа. Подождите минуту.",
        )

    # Look up user by email (case-insensitive)
    email_lc = body.email.lower().strip()
    result = await db.execute(
        select(User).where(
            User.email == email_lc,
            User.deleted_at.is_(None),
        )
    )
    user: Optional[User] = result.scalar_one_or_none()

    # Generic error on missing user — don't leak which emails exist
    if not user:
        # Constant-time sleep-alike to prevent timing attacks
        _ = hash_password("dummy-to-equalise-timing")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль.",
        )

    # Check lockout
    if user.is_locked:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Аккаунт заблокирован до {user.locked_until.isoformat()} из-за множества неудачных попыток.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Аккаунт отключён. Обратитесь к администратору.",
        )

    # Verify password
    if not verify_password(body.password, user.password_hash):
        async with db.begin_nested():
            await _increment_failed_attempts(db, user)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль.",
        )

    # Upgrade password hash if bcrypt rounds changed
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(body.password)

    # Success — reset counter, record login, generate tokens
    async with db.begin_nested():
        await _reset_failed_attempts(db, user, client_ip)

    access_token, access_exp, access_jti = create_access_token(
        user_id=user.id,
        role=user.role,
        org_id=user.org_id,
        email=user.email,
    )
    refresh_token, refresh_exp, _ = create_refresh_token(user_id=user.id)

    await _save_refresh_token(
        db,
        user_id=user.id,
        raw_token=refresh_token,
        expires_at=refresh_exp,
        device_info=request.headers.get("User-Agent", "")[:500],
        ip=client_ip,
    )
    await db.commit()

    _set_refresh_cookie(response, refresh_token)
    logger.info("User logged in: %s", user.email)

    return LoginResponse(
        access_token=access_token,
        expires_in=int((access_exp - datetime.now(timezone.utc)).total_seconds()),
        user=UserProfile(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            org_id=user.org_id,
            must_change_password=user.must_change_password,
        ),
    )


@router.post(
    "/refresh",
    response_model=RefreshResponse,
    summary="Обновление access-токена через refresh cookie",
)
async def refresh(
    response: Response,
    refresh_token: Optional[str] = Cookie(None, alias=REFRESH_COOKIE_NAME),
    db: AsyncSession = Depends(get_db),
) -> RefreshResponse:
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Отсутствует refresh cookie.",
        )

    # 1. Decode the refresh token
    try:
        payload = decode_token(refresh_token, expected_type="refresh")
    except (TokenExpiredError, TokenInvalidError) as exc:
        _clear_refresh_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Недействительный refresh-токен: {exc}",
        )

    user_id = UUID(payload["sub"])

    # 2. Verify refresh token is in DB and not revoked
    # Note: we find the matching stored hash by iterating active tokens for this user.
    # For very active users, consider indexing by a prefix or using the JTI as the PK.
    result = await db.execute(
        select(RefreshToken)
        .where(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > datetime.now(timezone.utc),
        )
    )
    active_tokens = result.scalars().all()

    matched: Optional[RefreshToken] = None
    for rt in active_tokens:
        if verify_password(refresh_token, rt.token_hash):
            matched = rt
            break

    if not matched:
        _clear_refresh_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh-токен отозван или не найден.",
        )

    # 3. Load user
    user = (await db.execute(
        select(User).where(User.id == user_id, User.deleted_at.is_(None))
    )).scalar_one_or_none()
    if not user or not user.can_login:
        _clear_refresh_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь недоступен.",
        )

    # 4. Rotate: revoke old, issue new
    matched.revoked_at = datetime.now(timezone.utc)
    matched.last_used_at = datetime.now(timezone.utc)

    access_token, access_exp, _ = create_access_token(
        user_id=user.id, role=user.role, org_id=user.org_id, email=user.email,
    )
    new_refresh, new_refresh_exp, _ = create_refresh_token(user_id=user.id)
    await _save_refresh_token(
        db,
        user_id=user.id,
        raw_token=new_refresh,
        expires_at=new_refresh_exp,
        device_info=matched.device_info,
        ip=matched.ip_address,
    )
    await db.commit()

    _set_refresh_cookie(response, new_refresh)
    return RefreshResponse(
        access_token=access_token,
        expires_in=int((access_exp - datetime.now(timezone.utc)).total_seconds()),
    )


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    summary="Выход — отзыв текущих токенов",
)
async def logout(
    response: Response,
    token: TokenPayload = Depends(verify_token_dep),
    refresh_token: Optional[str] = Cookie(None, alias=REFRESH_COOKIE_NAME),
    db: AsyncSession = Depends(get_db),
) -> None:
    # Blacklist access token
    remaining = max(0, token.exp - int(datetime.now(timezone.utc).timestamp()))
    if remaining > 0:
        await blacklist_token(token.jti, ttl_seconds=remaining)

    # Revoke refresh token if presented
    if refresh_token:
        try:
            payload = decode_token(refresh_token, expected_type="refresh")
            user_id = UUID(payload["sub"])
            result = await db.execute(
                select(RefreshToken).where(
                    RefreshToken.user_id == user_id,
                    RefreshToken.revoked_at.is_(None),
                )
            )
            for rt in result.scalars():
                if verify_password(refresh_token, rt.token_hash):
                    rt.revoked_at = datetime.now(timezone.utc)
                    break
            await db.commit()
        except Exception as exc:
            logger.warning("Could not revoke refresh token: %s", exc)

    _clear_refresh_cookie(response)
    logger.info("User logged out: %s", token.sub)


@router.get(
    "/me",
    response_model=UserProfile,
    summary="Профиль текущего пользователя",
)
async def me(
    token: AuthenticatedUser,
    db: AsyncSession = Depends(get_db),
) -> UserProfile:
    user = (await db.execute(
        select(User).where(User.id == UUID(token.sub), User.deleted_at.is_(None))
    )).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден.")
    return UserProfile(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        org_id=user.org_id,
        must_change_password=user.must_change_password,
    )


@router.post(
    "/change-password",
    status_code=status.HTTP_200_OK,
    summary="Смена собственного пароля",
)
async def change_password(
    body: ChangePasswordRequest,
    token: AuthenticatedUser,
    db: AsyncSession = Depends(get_db),
) -> None:
    user = (await db.execute(
        select(User).where(User.id == UUID(token.sub))
    )).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден.")

    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Текущий пароль неверен.",
        )

    user.password_hash = hash_password(body.new_password)
    user.must_change_password = False
    user.password_changed_at = datetime.now(timezone.utc)

    # Revoke all other refresh tokens (force re-login on other devices)
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc))
    )
    await db.commit()


@router.post(
    "/register",
    response_model=UserProfile,
    status_code=status.HTTP_201_CREATED,
    summary="Создание пользователя (только для Admin / Superadmin)",
    description="""
    Создаёт нового пользователя в системе.
    Устанавливает флаг `must_change_password=true` — пользователь обязан
    сменить пароль при первом входе.

    Требует роль `admin` или `superadmin`.
    """,
)
async def register_user(
    body: RegisterUserRequest,
    _token: TokenPayload = Depends(require_role(UserRole.ADMIN, UserRole.SUPERADMIN)),
    db: AsyncSession = Depends(get_db),
) -> UserProfile:
    email_lc = body.email.lower().strip()

    # Uniqueness check
    exists = await db.scalar(
        select(User.id).where(User.email == email_lc, User.deleted_at.is_(None))
    )
    if exists:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Пользователь с email {email_lc} уже существует.",
        )

    # Validate org_id requirement
    if body.role == UserRole.DATA_ENTRY and not body.org_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Для роли data_entry обязательно указать org_id.",
        )

    new_user = User(
        email=email_lc,
        password_hash=hash_password(body.password),
        full_name=body.full_name,
        role=body.role,
        org_id=body.org_id,
        phone=body.phone,
        is_active=True,
        must_change_password=True,
        created_by=UUID(_token.sub),
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    logger.info("User created: %s (role=%s) by %s", email_lc, body.role, _token.sub)
    return UserProfile(
        id=new_user.id,
        email=new_user.email,
        full_name=new_user.full_name,
        role=new_user.role,
        org_id=new_user.org_id,
        must_change_password=True,
    )
