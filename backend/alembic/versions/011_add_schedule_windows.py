"""add schedule windows

Revision ID: 011_add_schedule_windows
Revises: 010_add_schedules_and_knowledge
Create Date: 2026-05-18 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "011_add_schedule_windows"
down_revision = "010_add_schedules_and_knowledge"
branch_labels = None
depends_on = None


def _columns(table_name: str) -> set[str]:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    columns = _columns("scheduled_scans")

    if "time_window_start" not in columns:
        op.add_column("scheduled_scans", sa.Column("time_window_start", sa.String(length=5), nullable=True))
    if "time_window_end" not in columns:
        op.add_column("scheduled_scans", sa.Column("time_window_end", sa.String(length=5), nullable=True))
    if "timezone" not in columns:
        op.add_column(
            "scheduled_scans",
            sa.Column("timezone", sa.String(length=64), nullable=False, server_default="Asia/Shanghai"),
        )
    if "rule_set_id" not in columns:
        op.add_column("scheduled_scans", sa.Column("rule_set_id", sa.String(), nullable=True))
    if "prompt_template_id" not in columns:
        op.add_column("scheduled_scans", sa.Column("prompt_template_id", sa.String(), nullable=True))


def downgrade() -> None:
    columns = _columns("scheduled_scans")

    if "prompt_template_id" in columns:
        op.drop_column("scheduled_scans", "prompt_template_id")
    if "rule_set_id" in columns:
        op.drop_column("scheduled_scans", "rule_set_id")
    if "timezone" in columns:
        op.drop_column("scheduled_scans", "timezone")
    if "time_window_end" in columns:
        op.drop_column("scheduled_scans", "time_window_end")
    if "time_window_start" in columns:
        op.drop_column("scheduled_scans", "time_window_start")
