"""add analyses moment columns

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-08 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "analyses",
        sa.Column("moment_headline", sa.Text(), nullable=False, server_default=""),
    )
    op.add_column(
        "analyses",
        sa.Column("moment_action", sa.Text(), nullable=False, server_default=""),
    )


def downgrade() -> None:
    op.drop_column("analyses", "moment_action")
    op.drop_column("analyses", "moment_headline")
