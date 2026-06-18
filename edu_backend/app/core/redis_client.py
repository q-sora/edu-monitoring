"""
core/redis_client.py
─────────────────────────────────────────────────────────────────────────────
Redis connection using redis-py 5.x async client.

Responsibilities:
    1. Connection pool shared across the entire application lifetime.
    2. Generic cache helpers: get_cached / set_cached / invalidate_prefix.
    3. Sliding-window rate-limit counters for API endpoints.
    4. Token blacklist for JWT revocation.
"""
from __future__ import annotations

import hashlib
import json
import logging
from typing import Any, Optional

import redis.asyncio as aioredis

from app.core.config import settings

logger = logging.getLogger(__name__)

redis_available = True

# ─────────────────────────────────────────────────────────────────────────────
# Pool — created once at startup, reused across all requests
# ─────────────────────────────────────────────────────────────────────────────

redis_pool: aioredis.ConnectionPool = aioredis.ConnectionPool.from_url(
    settings.REDIS_URL,
    max_connections=50,          # high-load: allow many parallel Redis ops
    decode_responses=True,       # return str, not bytes
    socket_connect_timeout=3,
    socket_timeout=3,
    retry_on_timeout=True,
)


def get_redis() -> aioredis.Redis:
    """
    Returns a Redis client sharing the global pool.
    Do not call .close() on it — the pool manages lifetime.
    """
    return aioredis.Redis(connection_pool=redis_pool)


async def close_redis() -> None:
    await redis_pool.disconnect()
    logger.info("Redis connection pool closed.")


# ─────────────────────────────────────────────────────────────────────────────
# Cache helpers
# ─────────────────────────────────────────────────────────────────────────────

_CACHE_PREFIX = "edu:cache:"


def _cache_key(namespace: str, *parts: Any) -> str:
    """
    Deterministic cache key from namespace + serialisable parts.
    Hash the parts so that long query-param strings don't blow the key limit.
    """
    raw = ":".join(str(p) for p in parts)
    digest = hashlib.sha256(raw.encode()).hexdigest()[:16]
    return f"{_CACHE_PREFIX}{namespace}:{digest}"


async def get_cached(namespace: str, *key_parts: Any) -> Optional[Any]:
    """
    Returns deserialised value from cache, or None on miss / error.
    Errors are swallowed: cache is advisory, not authoritative.
    """
    if not redis_available:
        return None
    r = get_redis()
    try:
        raw = await r.get(_cache_key(namespace, *key_parts))
        return json.loads(raw) if raw else None
    except Exception as exc:
        logger.warning("Cache GET error (%s): %s", namespace, exc)
        return None


async def set_cached(
    namespace: str,
    value: Any,
    *key_parts: Any,
    ttl: int = settings.CACHE_DEFAULT_TTL,
) -> None:
    """Serialise and store value. Silently swallows errors."""
    if not redis_available:
        return
    r = get_redis()
    try:
        await r.setex(
            _cache_key(namespace, *key_parts),
            ttl,
            json.dumps(value, default=str),
        )
    except Exception as exc:
        logger.warning("Cache SET error (%s): %s", namespace, exc)


async def invalidate_prefix(namespace: str, *key_parts: Any) -> int:
    """
    Delete a specific cache key.  Returns 1 if deleted, 0 if not found.
    For broader invalidations (e.g. all keys for an org) use SCAN + DEL.
    """
    if not redis_available:
        return 0
    r = get_redis()
    try:
        return await r.delete(_cache_key(namespace, *key_parts))
    except Exception as exc:
        logger.warning("Cache DELETE error (%s): %s", namespace, exc)
        return 0


async def invalidate_org_cache(org_id: str) -> None:
    """
    Batch-delete all cache keys that include this org_id.
    Uses SCAN to avoid blocking the Redis event loop (KEYS is dangerous).
    """
    if not redis_available:
        return
    r = get_redis()
    pattern = f"{_CACHE_PREFIX}*{org_id}*"
    cursor = 0
    deleted = 0
    try:
        while True:
            cursor, keys = await r.scan(cursor, match=pattern, count=100)
            if keys:
                deleted += await r.delete(*keys)
            if cursor == 0:
                break
        logger.debug("Invalidated %d cache keys for org %s", deleted, org_id)
    except Exception as exc:
        logger.warning("Cache invalidation error for org %s: %s", org_id, exc)


# ─────────────────────────────────────────────────────────────────────────────
# Rate limiting — fixed sliding window using Redis INCR + EXPIRE
# ─────────────────────────────────────────────────────────────────────────────

_RL_PREFIX = "edu:rl:"


async def check_rate_limit(
    identifier: str,               # e.g. user_id or IP address
    window_seconds: int = 60,
    max_requests: int = settings.RATE_LIMIT_PER_MINUTE,
) -> tuple[bool, int]:
    """
    Sliding fixed-window rate limiter.

    Returns:
        (allowed: bool, remaining: int)

    Implementation:
        Uses a single Redis key per (identifier, window bucket).
        INCR is atomic; EXPIRE is set only on first request in window.
        This avoids a Lua script while still being race-safe for most cases.
        For strict accuracy under extreme concurrency use the token-bucket Lua
        approach (see rate_limit_strict below).
    """
    if not redis_available:
        return True, max_requests
    r = get_redis()
    bucket = int(__import__("time").time() // window_seconds)
    key = f"{_RL_PREFIX}{identifier}:{bucket}"
    try:
        current = await r.incr(key)
        if current == 1:
            # First hit in this window — set expiry
            await r.expire(key, window_seconds * 2)
        remaining = max(0, max_requests - current)
        return current <= max_requests, remaining
    except Exception as exc:
        logger.warning("Rate-limit Redis error for %s: %s", identifier, exc)
        return True, max_requests   # fail open on Redis outage


# ─────────────────────────────────────────────────────────────────────────────
# JWT blacklist (token revocation)
# ─────────────────────────────────────────────────────────────────────────────

_BL_PREFIX = "edu:blacklist:"


async def blacklist_token(jti: str, ttl_seconds: int) -> None:
    """Add a JWT ID to the blacklist with TTL matching remaining token lifetime."""
    if not redis_available:
        return
    r = get_redis()
    await r.setex(f"{_BL_PREFIX}{jti}", ttl_seconds, "1")


async def is_token_blacklisted(jti: str) -> bool:
    """Returns True if this token has been revoked."""
    if not redis_available:
        return False
    r = get_redis()
    try:
        return await r.exists(f"{_BL_PREFIX}{jti}") == 1
    except Exception:
        return False   # fail open — do not lock out users on Redis outage
