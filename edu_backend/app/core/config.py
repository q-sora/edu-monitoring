"""
core/config.py
─────────────────────────────────────────────────────────────────────────────
Pydantic V2 Settings.  Reads from environment / .env file.
All secrets (DB passwords, JWT keys) come from env-vars only —
never hardcoded, never committed to version control.

The system is 100% self-hosted — no external auth providers.
JWTs are generated, signed, and validated entirely by this FastAPI backend.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Optional

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict



class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ────────────────────────────────────────────────────────────────
    APP_NAME: str = "EDU Monitoring API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = Field(default="production", pattern="^(development|staging|production)$")

    # ── Database (Primary) ─────────────────────────────────────────────────
    # asyncpg DSN: postgresql+asyncpg://user:password@host:5432/dbname
    DATABASE_URL: str
    DATABASE_REPLICA_URL: Optional[str] = None

    DB_POOL_SIZE: int = Field(default=20, ge=5, le=100)
    DB_MAX_OVERFLOW: int = Field(default=20, ge=0, le=50)
    DB_POOL_TIMEOUT: int = Field(default=10, ge=3, le=60)

    # ── Local Authentication (native JWT) ──────────────────────────────────
    # Generate a new secret with:
    #   python -c "import secrets; print(secrets.token_urlsafe(48))"
    JWT_SECRET_KEY: str = Field(
        ...,
        min_length=32,
        description="HS256 signing key (≥32 chars). Rotate every 90 days in prod.",
    )
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=60, ge=5, le=1440)
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7, ge=1, le=30)

    BCRYPT_ROUNDS: int = Field(default=12, ge=10, le=15)

    # ── Redis ──────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"
    CACHE_DEFAULT_TTL: int = 300
    CACHE_CONTINGENT_TTL: int = 60
    RATE_LIMIT_PER_MINUTE: int = 60

    # ── Celery ─────────────────────────────────────────────────────────────
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # ── CORS ───────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    # ── External integrations ──────────────────────────────────────────────
    NOBD_API_URL: str = "https://nobd.edu.kz/api/v1"
    NOBD_API_KEY: str = ""
    EPVO_API_URL: str = "https://epvo.kz/api/v1"
    EPVO_API_KEY: str = ""
    GEMINI_API_KEY: str = ""

    # ── Apache Superset ────────────────────────────────────────────────────
    SUPERSET_URL: str = "http://edu_superset:8088"
    SUPERSET_ADMIN_USER: str = "admin"
    SUPERSET_ADMIN_PASSWORD: str = ""

    # Token blacklist TTL = access token lifetime
    ACCESS_TOKEN_LIFETIME_SECONDS: int = 3600

    # Bootstrap superadmin (used only by seed script, not in runtime)
    BOOTSTRAP_SUPERADMIN_EMAIL: Optional[str] = None
    BOOTSTRAP_SUPERADMIN_PASSWORD: Optional[str] = None

    @model_validator(mode="after")
    def _check_async_dsn(self) -> "Settings":
        if not self.DATABASE_URL.startswith("postgresql+asyncpg://"):
            raise ValueError(
                "DATABASE_URL must use asyncpg driver: postgresql+asyncpg://..."
            )
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings: Settings = get_settings()
