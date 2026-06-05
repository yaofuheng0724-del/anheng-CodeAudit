"""add dataflow fields to audit_issues

Revision ID: 014_add_dataflow
Revises: 013_unify_statuses
Create Date: 2026-06-02 00:00:00.000000

为 audit_issues 表添加数据流路径字段:
  source — 污点源描述
  sink — 危险操作/汇描述
  dataflow_path — 数据流路径 JSON (DataFlowStep[])
  code_context — 上下文代码

与 agent_findings 的数据流字段保持一致。
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "014_add_dataflow"
down_revision = "013_unify_statuses"
branch_labels = None
depends_on = None


def _columns(table_name: str) -> set[str]:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    cols = _columns("audit_issues")
    new_cols = [
        ("source", sa.Column("source", sa.Text(), nullable=True)),
        ("sink", sa.Column("sink", sa.Text(), nullable=True)),
        ("dataflow_path", sa.Column("dataflow_path", sa.Text(), nullable=True)),
        ("code_context", sa.Column("code_context", sa.Text(), nullable=True)),
    ]
    for col_name, col_def in new_cols:
        if col_name not in cols:
            op.add_column("audit_issues", col_def)


def downgrade() -> None:
    cols = _columns("audit_issues")
    for col_name in ("code_context", "dataflow_path", "sink", "source"):
        if col_name in cols:
            op.drop_column("audit_issues", col_name)