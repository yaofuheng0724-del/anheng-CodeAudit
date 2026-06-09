"""add missing total_lines to agent_tasks

Revision ID: 019_add_agent_task_total_lines
Revises: 018_add_project_scan_mode
Create Date: 2026-06-09 00:00:00.000000

agent_tasks 模型包含 total_lines 字段，但部分已部署数据库缺少该列，
导致 GET /api/v1/agent-tasks/ 查询 ORM 对象时触发 UndefinedColumnError。
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "019_add_agent_task_total_lines"
down_revision = "018_add_project_scan_mode"
branch_labels = None
depends_on = None


def _columns(table_name: str) -> set[str]:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    cols = _columns("agent_tasks")
    if "total_lines" not in cols:
        op.add_column(
            "agent_tasks",
            sa.Column("total_lines", sa.Integer(), nullable=True, server_default="0"),
        )
        op.execute("UPDATE agent_tasks SET total_lines = 0 WHERE total_lines IS NULL")


def downgrade() -> None:
    cols = _columns("agent_tasks")
    if "total_lines" in cols:
        op.drop_column("agent_tasks", "total_lines")
