"""create analysis_message and usage tables

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-08 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "analysis_message",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("analysis_id", sa.Uuid(), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["analysis_id"], ["analyses.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("analysis_id", "seq", name="uq_analysis_message_analysis_seq"),
    )

    op.create_table(
        "usage",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("subject", sa.String(length=64), nullable=False),
        sa.Column("usage_date", sa.Date(), nullable=False),
        sa.Column("used", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("subject", "usage_date", name="uq_usage_subject_date"),
    )
    op.create_index("ix_usage_subject_date", "usage", ["subject", "usage_date"])


def downgrade() -> None:
    op.drop_index("ix_usage_subject_date", table_name="usage")
    op.drop_table("usage")
    op.drop_table("analysis_message")
