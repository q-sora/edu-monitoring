"""
scripts/create_superadmin.py
─────────────────────────────────────────────────────────────────────────────
Создаёт первого суперадминистратора в системе.

Два режима:
  1. Интерактивный (для ручного запуска на сервере):
       python -m scripts.create_superadmin

  2. Автоматический из .env (для CI / first-time deploy):
       BOOTSTRAP_SUPERADMIN_EMAIL=admin@...
       BOOTSTRAP_SUPERADMIN_PASSWORD=...
       python -m scripts.create_superadmin --auto

Скрипт идемпотентен: если суперадмин с таким email уже существует,
пароль НЕ перезаписывается, возвращается сообщение и код выхода 0.

Использование для production bootstrap:
    docker compose run --rm api python -m scripts.create_superadmin --auto

После успешного создания рекомендуется удалить BOOTSTRAP_* переменные из .env.
"""
from __future__ import annotations

import asyncio
import getpass
import logging
import sys
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncWriteSession, init_db
from app.core.security import hash_password
from app.models.user import User, UserRoleEnum

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def _validate_password(password: str) -> str | None:
    """Return None if OK, else a human-readable error string."""
    if len(password) < 12:
        return "Пароль должен быть не менее 12 символов."
    if password.isalpha():
        return "Пароль должен содержать цифры."
    if password.isdigit():
        return "Пароль должен содержать буквы."
    if password.lower() in {"admin", "password", "12345678", "qwerty"}:
        return "Пароль слишком простой."
    return None


def _validate_email(email: str) -> bool:
    return "@" in email and "." in email.split("@", 1)[1] and len(email) < 255


# ─────────────────────────────────────────────────────────────────────────────
# Core creation logic
# ─────────────────────────────────────────────────────────────────────────────

async def create_superadmin(
    session: AsyncSession,
    *,
    email: str,
    password: str,
    full_name: str = "Системный администратор",
    force: bool = False,
) -> User:
    """
    Create (or optionally reset) a superadmin user.

    If a user with this email already exists:
        force=False — raise RuntimeError (default)
        force=True  — reset password AND role to superadmin

    Returns the User instance.
    """
    email_lc = email.lower().strip()
    result = await session.execute(
        select(User).where(User.email == email_lc, User.deleted_at.is_(None))
    )
    existing = result.scalar_one_or_none()

    if existing and not force:
        raise RuntimeError(
            f"Пользователь {email_lc} уже существует. "
            "Используйте --force для сброса пароля."
        )

    if existing and force:
        existing.password_hash = hash_password(password)
        existing.role = UserRoleEnum.SUPERADMIN
        existing.is_active = True
        existing.full_name = full_name
        existing.failed_login_attempts = 0
        existing.locked_until = None
        existing.must_change_password = False
        existing.password_changed_at = datetime.now(timezone.utc)
        await session.commit()
        await session.refresh(existing)
        logger.info("✔ Пароль суперадмина %s сброшен.", email_lc)
        return existing

    # New user
    user = User(
        email=email_lc,
        password_hash=hash_password(password),
        full_name=full_name,
        role=UserRoleEnum.SUPERADMIN,
        org_id=None,
        is_active=True,
        must_change_password=False,  # first superadmin trusts the bootstrap password
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    logger.info("✔ Суперадмин создан: %s (id=%s)", email_lc, user.id)
    return user


# ─────────────────────────────────────────────────────────────────────────────
# CLI driver
# ─────────────────────────────────────────────────────────────────────────────

async def main_interactive() -> int:
    print("╔══════════════════════════════════════════════════════╗")
    print("║  Создание суперадминистратора EDU Monitoring         ║")
    print("╚══════════════════════════════════════════════════════╝")
    print()

    email = input("Email суперадмина: ").strip()
    if not _validate_email(email):
        print("❌ Некорректный email.", file=sys.stderr)
        return 1

    full_name = input("ФИО [Системный администратор]: ").strip() or "Системный администратор"

    while True:
        pwd = getpass.getpass("Пароль (мин. 12 символов, буквы + цифры): ")
        err = _validate_password(pwd)
        if err:
            print(f"❌ {err}", file=sys.stderr)
            continue
        pwd_confirm = getpass.getpass("Повторите пароль: ")
        if pwd != pwd_confirm:
            print("❌ Пароли не совпадают.", file=sys.stderr)
            continue
        break

    force = "--force" in sys.argv

    await init_db()
    async with AsyncWriteSession() as session:
        try:
            user = await create_superadmin(
                session,
                email=email,
                password=pwd,
                full_name=full_name,
                force=force,
            )
        except RuntimeError as exc:
            print(f"❌ {exc}", file=sys.stderr)
            return 2

    print()
    print(f"✅ Готово. Суперадмин {user.email} создан.")
    print(f"   ID: {user.id}")
    print(f"   Теперь войдите в портал: http://localhost:3000/login")
    return 0


async def main_auto() -> int:
    """Non-interactive mode — reads credentials from env."""
    email = settings.BOOTSTRAP_SUPERADMIN_EMAIL
    password = settings.BOOTSTRAP_SUPERADMIN_PASSWORD

    if not email or not password:
        print(
            "❌ BOOTSTRAP_SUPERADMIN_EMAIL и BOOTSTRAP_SUPERADMIN_PASSWORD "
            "обязательны в режиме --auto.",
            file=sys.stderr,
        )
        return 1

    err = _validate_password(password)
    if err:
        print(f"❌ Некорректный пароль в .env: {err}", file=sys.stderr)
        return 1

    await init_db()
    async with AsyncWriteSession() as session:
        try:
            user = await create_superadmin(
                session,
                email=email,
                password=password,
                force="--force" in sys.argv,
            )
        except RuntimeError as exc:
            print(f"⚠ {exc}")
            print("   Пропускаю создание (идемпотентность).")
            return 0

    print(f"✅ Суперадмин {user.email} готов.")
    print("⚠ Удалите BOOTSTRAP_SUPERADMIN_* из .env после успешного запуска.")
    return 0


def main() -> int:
    if "--auto" in sys.argv:
        return asyncio.run(main_auto())
    return asyncio.run(main_interactive())


if __name__ == "__main__":
    sys.exit(main())
