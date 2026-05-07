"""users and refresh_tokens tables for native auth.

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-22

Creates:
    users          — native local users with bcrypt password hash + RBAC role
    refresh_tokens — server-side refresh token store (bcrypt-hashed)
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── users ─────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("uuid_generate_v4()"),
            primary_key=True,
        ),
        sa.Column("email",         sa.String(255), unique=True, nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("full_name",     sa.String(200), nullable=False),
        sa.Column("phone",         sa.String(20),  nullable=True),
        sa.Column("role",          sa.String(20),  nullable=False, server_default="data_entry"),
        sa.Column(
            "org_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("is_active",            sa.Boolean, nullable=False, server_default="true"),
        sa.Column("must_change_password", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("failed_login_attempts", sa.Integer, nullable=False, server_default="0"),
        sa.Column("locked_until",         sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_login_at",        sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_login_ip",        sa.String(45),              nullable=True),
        sa.Column("password_changed_at",  sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("created_at",           sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at",           sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=True),
        sa.Column("created_by",           postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("deleted_at",           sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "role IN ('superadmin','admin','management','data_entry')",
            name="ck_user_role",
        ),
    )
    op.create_index("ix_users_email_active", "users", ["email", "is_active"])
    op.create_index("ix_users_org_role",     "users", ["org_id", "role"])
    op.create_index("ix_users_deleted_at",   "users", ["deleted_at"])

    # Trigger: auto-update updated_at
    op.execute("""
        CREATE TRIGGER set_updated_at_users
            BEFORE UPDATE ON users
            FOR EACH ROW
            EXECUTE FUNCTION trigger_set_updated_at();
    """)

    # ── refresh_tokens ────────────────────────────────────────────────────
    op.create_table(
        "refresh_tokens",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("uuid_generate_v4()"),
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token_hash",    sa.String(255), unique=True, nullable=False),
        sa.Column("device_info",   sa.String(500), nullable=True),
        sa.Column("ip_address",    sa.String(45),  nullable=True),
        sa.Column("created_at",    sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("expires_at",    sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at",    sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_used_at",  sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_refresh_user_active", "refresh_tokens", ["user_id", "revoked_at"])
    op.create_index("ix_refresh_expires_at",  "refresh_tokens", ["expires_at"])


def downgrade() -> None:
    op.drop_index("ix_refresh_expires_at",  table_name="refresh_tokens")
    op.drop_index("ix_refresh_user_active", table_name="refresh_tokens")
    op.drop_table("refresh_tokens")

    op.execute("DROP TRIGGER IF EXISTS set_updated_at_users ON users;")
    op.drop_index("ix_users_deleted_at",   table_name="users")
    op.drop_index("ix_users_org_role",     table_name="users")
    op.drop_index("ix_users_email_active", table_name="users")
    op.drop_table("users")
