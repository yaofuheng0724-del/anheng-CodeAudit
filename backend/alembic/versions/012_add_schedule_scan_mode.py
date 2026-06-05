"""add schedule scan mode

Revision ID: 012_add_schedule_scan_mode
Revises: 011_add_schedule_windows
Create Date: 2026-05-18 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "012_add_schedule_scan_mode"
down_revision = "011_add_schedule_windows"
branch_labels = None
depends_on = None


def _columns(table_name: str) -> set[str]:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    columns = _columns("scheduled_scans")

    if "scan_mode" not in columns:
        op.add_column(
            "scheduled_scans",
            sa.Column("scan_mode", sa.String(length=20), nullable=False, server_default="fast"),
        )


def downgrade() -> None:
    columns = _columns("scheduled_scans")

    if "scan_mode" in columns:
        op.drop_column("scheduled_scans", "scan_mode")
