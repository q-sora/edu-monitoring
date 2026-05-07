"""Initial schema — adds soft-delete, audit, and version columns to domain tables.

Revision ID: 0001
Revises: 
Create Date: 2026-04-22

Notes:
    This migration does NOT recreate tables from edu_monitoring_schema.sql.
    The base tables are assumed to already exist (created by the .sql file).
    This migration adds the columns introduced by our FullAuditMixin and
    SoftDeleteMixin that are NOT in the original schema.
    
    If starting from scratch, run edu_monitoring_schema.sql FIRST, then
    apply this migration.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

# Tables that get the full audit mixin columns
AUDIT_TABLES = [
    "science_activity",
    "contingent_snapshots",
    "finance_records",
    "graduates_records",
    "educational_process",
    "staff_snapshots",
    "infrastructure_records",
    "equipment_records",
    "digitalization_records",
    "medical_records",
]


def upgrade() -> None:
    # ── Add audit + soft-delete + optimistic-lock columns ─────────────────
    for table in AUDIT_TABLES:
        # Skip if column already exists (idempotent)
        connection = op.get_bind()
        result = connection.execute(
            sa.text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = :t AND column_name = 'version'"
            ),
            {"t": table},
        )
        if result.fetchone():
            continue

        op.add_column(table, sa.Column(
            "created_by", sa.String(36), nullable=True,
            comment="User UUID who created this row",
        ))
        op.add_column(table, sa.Column(
            "updated_by", sa.String(36), nullable=True,
            comment="User UUID who last modified this row",
        ))
        op.add_column(table, sa.Column(
            "updated_at", sa.DateTime(timezone=True),
            server_default=sa.func.now(), nullable=True,
        ))
        op.add_column(table, sa.Column(
            "version", sa.Integer,
            server_default="1", nullable=False,
            comment="Optimistic lock counter",
        ))
        op.add_column(table, sa.Column(
            "deleted_at", sa.DateTime(timezone=True), nullable=True,
            comment="Soft delete timestamp",
        ))
        op.add_column(table, sa.Column(
            "deleted_by", sa.String(36), nullable=True,
        ))
        op.add_column(table, sa.Column(
            "submission_status", sa.String(20),
            server_default="draft", nullable=False,
        ))

    # ── Add submission_status index ────────────────────────────────────────
    for table in AUDIT_TABLES:
        op.create_index(
            f"ix_{table}_status",
            table,
            ["submission_status"],
            postgresql_where=sa.text("deleted_at IS NULL"),
        )

    # ── Auto-update updated_at trigger ────────────────────────────────────
    op.execute("""
        CREATE OR REPLACE FUNCTION trigger_set_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    for table in AUDIT_TABLES:
        op.execute(f"""
            DROP TRIGGER IF EXISTS set_updated_at_{table} ON {table}""")
        op.execute(f"""CREATE TRIGGER set_updated_at_{table}
                BEFORE UPDATE ON {table}
                FOR EACH ROW
                EXECUTE FUNCTION trigger_set_updated_at();
        """)

    # ── Version increment trigger ──────────────────────────────────────────
    op.execute("""
        CREATE OR REPLACE FUNCTION increment_version()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.version := COALESCE(OLD.version, 0) + 1;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    for table in AUDIT_TABLES:
        op.execute(f"""
            DROP TRIGGER IF EXISTS version_bump_{table} ON {table}""")
        op.execute(f"""CREATE TRIGGER version_bump_{table}
                BEFORE UPDATE ON {table}
                FOR EACH ROW
                WHEN (OLD.* IS DISTINCT FROM NEW.*)
                EXECUTE FUNCTION increment_version();
        """)

    # ── Audit trigger (writes to audit_log) ───────────────────────────────
    op.execute("""
        CREATE OR REPLACE FUNCTION audit_trigger_fn()
        RETURNS TRIGGER AS $$
        BEGIN
            INSERT INTO audit_log
                (table_name, record_id, action, changed_by, org_id, old_data, new_data, changed_at)
            VALUES (
                TG_TABLE_NAME,
                COALESCE(NEW.id::TEXT, OLD.id::TEXT),
                TG_OP,
                current_setting('app.user_id', true),
                COALESCE(NEW.org_id, OLD.org_id)::uuid,
                CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE row_to_json(OLD) END,
                CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE row_to_json(NEW) END,
                NOW()
            );
            RETURN COALESCE(NEW, OLD);
        END;
        $$ LANGUAGE plpgsql;
    """)

    for table in AUDIT_TABLES:
        op.execute(f"""
            DROP TRIGGER IF EXISTS audit_{table} ON {table}""")
        op.execute(f"""CREATE TRIGGER audit_{table}
                AFTER INSERT OR UPDATE OR DELETE ON {table}
                FOR EACH ROW
                EXECUTE FUNCTION audit_trigger_fn();
        """)

    # ── RLS policies ──────────────────────────────────────────────────────
    for table in AUDIT_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
        op.execute(f"""
            DROP POLICY IF EXISTS org_isolation_{table} ON {table}""")
        op.execute(f"""CREATE POLICY org_isolation_{table} ON {table}
            USING (
                current_setting('app.role', true) IN ('admin','superadmin')
                OR org_id::text = current_setting('app.org_id', true)
            )
            WITH CHECK (
                current_setting('app.role', true) IN ('admin','superadmin')
                OR org_id::text = current_setting('app.org_id', true)
            );
        """)

    # ── GIN indexes for JSONB fields ───────────────────────────────────────
    jsonb_indexes = [
        ("science_activity",   "grants_json"),
        ("science_activity",   "student_projects_json"),
        ("contingent_snapshots", "by_grade_json"),
        ("graduates_records",  "employer_partners_json"),
        ("educational_process","practice_partners_json"),
        ("educational_process","olympiad_participation_json"),
    ]
    for table, col in jsonb_indexes:
        op.create_index(
            f"ix_{table}_{col}_gin",
            table,
            [col],
            postgresql_using="gin",
        )


def downgrade() -> None:
    """
    Downgrade removes audit triggers, RLS policies, and mixin columns.
    The base data tables are left intact.
    """
    for table in AUDIT_TABLES:
        # Drop triggers
        op.execute(f"DROP TRIGGER IF EXISTS audit_{table} ON {table};")
        op.execute(f"DROP TRIGGER IF EXISTS set_updated_at_{table} ON {table};")
        op.execute(f"DROP TRIGGER IF EXISTS version_bump_{table} ON {table};")
        # Drop RLS
        op.execute(f"DROP POLICY IF EXISTS org_isolation_{table} ON {table};")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")
        # Drop mixin columns
        for col in ["created_by", "updated_by", "updated_at", "version",
                    "deleted_at", "deleted_by", "submission_status"]:
            op.drop_column(table, col)
