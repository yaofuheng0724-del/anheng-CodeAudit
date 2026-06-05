"""add scan_mode and compiled_options to projects

Revision ID: 018_add_project_scan_mode
Revises: 017_add_code_analysis_results
Create Date: 2026-06-04 00:00:00.000000

为 projects 表添加 scan_mode 和 compiled_options 列，
将扫描模式（源代码/编译后产物）从任务级别提升为项目级别属性。
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "018_add_project_scan_mode"
down_revision = "017_add_code_analysis_results"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 添加 scan_mode 字段，区分源代码扫描与编译后产物扫描
    op.add_column(
        'projects',
        sa.Column('scan_mode', sa.String(20), nullable=False, server_default='source'),
    )
    # 添加 compiled_options 字段，存储编译后产物扫描的可选参数 (JSON 字符串)
    op.add_column(
        'projects',
        sa.Column('compiled_options', sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('projects', 'compiled_options')
    op.drop_column('projects', 'scan_mode')
