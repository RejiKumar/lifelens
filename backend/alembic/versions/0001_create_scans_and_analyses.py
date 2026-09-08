"""create scans and analyses tables

Revision ID: 0001
Revises:
Create Date: 2026-09-07 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "scans",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=True),
        sa.Column("guest_session_id", sa.String(length=36), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("idempotency_key", sa.String(length=36), nullable=False),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column("storage_path", sa.String(length=512), nullable=False),
        sa.Column("source", sa.String(length=16), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_scans_user_id", "scans", ["user_id"])
    op.create_index("ix_scans_guest_session_id", "scans", ["guest_session_id"])
    op.create_index("ix_scans_expires_at", "scans", ["expires_at"])

    # Session-scoped idempotency: duplicate submissions scoped to the owner.
    # NULLs are distinct in Postgres, so guest rows (user_id NULL) and
    # authenticated rows (guest_session_id NULL) never collide across owners.
    op.create_unique_constraint(
        "uq_scans_guest_idempotency", "scans", ["guest_session_id", "idempotency_key"]
    )
    op.create_unique_constraint(
        "uq_scans_user_idempotency", "scans", ["user_id", "idempotency_key"]
    )
    op.create_unique_constraint(
        "uq_scans_guest_content_hash", "scans", ["guest_session_id", "content_hash"]
    )
    op.create_unique_constraint(
        "uq_scans_user_content_hash", "scans", ["user_id", "content_hash"]
    )

    op.create_table(
        "analyses",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("scan_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("risk_level", sa.String(length=16), nullable=False),
        sa.Column("observations", postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column("actions", postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column("warnings", postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column("when_to_seek_help", sa.Text(), nullable=True),
        sa.Column("follow_up_suggestions", postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column("is_medical", sa.Boolean(), nullable=False),
        sa.Column("is_hazardous", sa.Boolean(), nullable=False),
        sa.Column("is_electrical", sa.Boolean(), nullable=False),
        sa.Column("is_structural", sa.Boolean(), nullable=False),
        sa.Column("is_vehicle", sa.Boolean(), nullable=False),
        sa.Column("is_chemical", sa.Boolean(), nullable=False),
        sa.Column("is_gas", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["scan_id"], ["scans.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("scan_id"),
    )
    op.create_index("ix_analyses_scan_id", "analyses", ["scan_id"], unique=True)
    op.create_index("ix_analyses_risk_level", "analyses", ["risk_level"])


def downgrade() -> None:
    op.drop_index("ix_analyses_risk_level", table_name="analyses")
    op.drop_index("ix_analyses_scan_id", table_name="analyses")
    op.drop_table("analyses")
    op.drop_constraint("uq_scans_user_content_hash", "scans", type_="unique")
    op.drop_constraint("uq_scans_guest_content_hash", "scans", type_="unique")
    op.drop_constraint("uq_scans_user_idempotency", "scans", type_="unique")
    op.drop_constraint("uq_scans_guest_idempotency", "scans", type_="unique")
    op.drop_index("ix_scans_expires_at", table_name="scans")
    op.drop_index("ix_scans_guest_session_id", table_name="scans")
    op.drop_index("ix_scans_user_id", table_name="scans")
    op.drop_table("scans")
