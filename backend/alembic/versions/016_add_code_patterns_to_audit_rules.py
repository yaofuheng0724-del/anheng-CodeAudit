"""add code_patterns column to audit_rules

Revision ID: 016_add_code_patterns_to_audit_rules
Revises: 015_add_scheduled_scan_id
Create Date: 2026-06-03 00:00:00.000000

为 audit_rules 表添加 code_patterns 列，
存储按语言分组的代码检测模式 (JSON格式: {"python": ["pattern1"], "java": ["pattern2"]})，
用于静态扫描引擎的模式匹配和前端可视化展示。
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "016_code_patterns"
down_revision = "015_add_scheduled_scan_id"
branch_labels = None
depends_on = None


def _columns(table_name: str) -> set[str]:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    cols = _columns("audit_rules")
    if "code_patterns" not in cols:
        op.add_column(
            "audit_rules",
            sa.Column("code_patterns", sa.Text(), nullable=True),
        )


def downgrade() -> None:
    cols = _columns("audit_rules")
    if "code_patterns" in cols:
        op.drop_column("audit_rules", "code_patterns")
