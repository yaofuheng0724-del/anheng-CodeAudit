"""add name to audit_tasks

Revision ID: 020_add_name_to_audit_tasks
Revises: 019_add_agent_task_total_lines
Create Date: 2026-06-17 00:00:00.000000

Store the user-provided name for regular/quick audit tasks.
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "020_add_name_to_audit_tasks"
down_revision = "019_add_agent_task_total_lines"
branch_labels = None
depends_on = None


def _columns(table_name: str) -> set[str]:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    cols = _columns("audit_tasks")
    if "name" not in cols:
        op.add_column("audit_tasks", sa.Column("name", sa.String(), nullable=True))


def downgrade() -> None:
    cols = _columns("audit_tasks")
    if "name" in cols:
        op.drop_column("audit_tasks", "name")
