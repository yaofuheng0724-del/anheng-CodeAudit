"""add code_analysis_results

Revision ID: 017_add_code_analysis_results
Revises: 016_code_patterns
Create Date: 2026-06-03 00:00:00.000000

为 tasks 和 agent_tasks 表添加 code_analysis_results 列，
存储源代码分析结果 (JSON格式)，
用于快速审计和深度审计的代码分析功能。
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "017_add_code_analysis_results"
down_revision = "016_code_patterns"
branch_labels = None
depends_on = None


def _columns(table_name: str) -> set[str]:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    # Add code_analysis_results to tasks table (audit_tasks)
    cols = _columns("audit_tasks")
    if "code_analysis_results" not in cols:
        op.add_column(
            "audit_tasks",
            sa.Column("code_analysis_results", sa.JSON(), nullable=True, server_default="{}"),
        )

    # Add code_analysis_results to agent_tasks table
    cols = _columns("agent_tasks")
    if "code_analysis_results" not in cols:
        op.add_column(
            "agent_tasks",
            sa.Column("code_analysis_results", sa.JSON(), nullable=True, server_default="{}"),
        )


def downgrade() -> None:
    # Remove code_analysis_results from agent_tasks table
    cols = _columns("agent_tasks")
    if "code_analysis_results" in cols:
        op.drop_column("agent_tasks", "code_analysis_results")

    # Remove code_analysis_results from tasks table (audit_tasks)
    cols = _columns("audit_tasks")
    if "code_analysis_results" in cols:
        op.drop_column("audit_tasks", "code_analysis_results")
