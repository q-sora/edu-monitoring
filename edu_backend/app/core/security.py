"""
core/security.py
─────────────────────────────────────────────────────────────────────────────
Password hashing and JWT signing utilities.

All authentication operations go through this module so there is a single,
auditable place where security-critical code lives.

Dependencies:
    passlib[bcrypt]       — password hashing (bcrypt with configurable rounds)
    python-jose[cryptography] — JWT encode / decode with HMAC-SHA256
"""
from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID, uuid4

from jose import ExpiredSignatureError, JWTError, jwt
import bcrypt as _bcrypt_lib

from app.core.config import settings

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Password hashing
# ─────────────────────────────────────────────────────────────────────────────

# Direct bcrypt (no passlib) — passlib 1.7.4 is incompatible with bcrypt >= 4.1.


def hash_password(plain: str) -> str:
    """Hash a plaintext password via bcrypt directly."""
    if len(plain) < 8:
        raise ValueError("Password must be at least 8 characters long.")
    # bcrypt hard limit is 72 bytes; truncate on the encoded form, not chars.
    pwd = plain.encode("utf-8")[:72]
    salt = _bcrypt_lib.gensalt(rounds=settings.BCRYPT_ROUNDS)
    return _bcrypt_lib.hashpw(pwd, salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Constant-time bcrypt compare. Returns False on any error, never raises."""
    try:
        pwd = plain.encode("utf-8")[:72]
        return _bcrypt_lib.checkpw(pwd, hashed.encode("utf-8"))
    except Exception as exc:
        logger.warning("Password verify error: %s", exc)
        return False


def needs_rehash(hashed: str) -> bool:
    """With direct bcrypt we do not track rehash policy here."""
    return False


# ─────────────────────────────────────────────────────────────────────────────
# JWT — Access Token
# ─────────────────────────────────────────────────────────────────────────────

def create_access_token(
    *,
    user_id: UUID | str,
    role: str,
    org_id: Optional[UUID | str] = None,
    email: Optional[str] = None,
    extra_claims: Optional[dict[str, Any]] = None,
) -> tuple[str, datetime, str]:
    """
    Signs and returns an access JWT.

    Returns (token, expires_at, jti).  The jti is unique per token and is used
    as the key in the Redis blacklist for fast revocation.

    Claims:
        sub     user UUID (primary identifier)
        role    RBAC role
        org_id  Optional organisation UUID (for data_entry users)
        email   Optional — displayed in the frontend profile dropdown
        iat     Issued-at Unix timestamp
        exp     Expiry Unix timestamp
        jti     JWT ID (random 16-byte hex) — used for blacklist
        type    "access"  — prevents refresh tokens being used as access tokens
    """
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    jti = secrets.token_hex(16)

    payload: dict[str, Any] = {
        "sub":  str(user_id),
        "role": role,
        "iat":  int(now.timestamp()),
        "exp":  int(expires_at.timestamp()),
        "jti":  jti,
        "type": "access",
    }
    if org_id:
        payload["org_id"] = str(org_id)
    if email:
        payload["email"] = email
    if extra_claims:
        payload.update(extra_claims)

    token = jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    return token, expires_at, jti


def create_refresh_token(
    *,
    user_id: UUID | str,
) -> tuple[str, datetime, str]:
    """
    Generates a long-lived refresh token.
    The raw token is stored only in the client's httpOnly cookie; the server
    stores a bcrypt hash (see models.user.RefreshToken.token_hash).

    Returns (raw_token, expires_at, jti).
    """
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    jti = secrets.token_hex(16)

    payload = {
        "sub":  str(user_id),
        "iat":  int(now.timestamp()),
        "exp":  int(expires_at.timestamp()),
        "jti":  jti,
        "type": "refresh",
    }
    token = jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    return token, expires_at, jti


# ─────────────────────────────────────────────────────────────────────────────
# JWT — Decode & verify
# ─────────────────────────────────────────────────────────────────────────────

class TokenInvalidError(Exception):
    """Base class for token decode errors."""


class TokenExpiredError(TokenInvalidError):
    """Token is expired."""


def decode_token(token: str, *, expected_type: str = "access") -> dict[str, Any]:
    """
    Decode a JWT and verify signature + expiry + type claim.

    Raises:
        TokenExpiredError — token passed the exp timestamp
        TokenInvalidError — signature invalid, malformed, or wrong type
    """
    try:
        payload: dict[str, Any] = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except ExpiredSignatureError as exc:
        raise TokenExpiredError("Token has expired.") from exc
    except JWTError as exc:
        raise TokenInvalidError(f"Invalid token: {exc}") from exc

    token_type = payload.get("type")
    if token_type != expected_type:
        raise TokenInvalidError(
            f"Token type mismatch: expected {expected_type!r}, got {token_type!r}"
        )
    return payload
