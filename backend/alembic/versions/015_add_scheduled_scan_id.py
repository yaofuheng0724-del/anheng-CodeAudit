"""add scheduled_scan_id and schedule whitelist columns

Revision ID: 015_add_scheduled_scan_id
Revises: 014_add_dataflow
Create Date: 2026-06-02 00:00:00.000000

为 audit_tasks 和 agent_tasks 表添加 scheduled_scan_id 列，
用于关联定时计划创建的占位任务。
为 scheduled_scans 表添加白名单配置列。

当用户创建定时扫描时，同时创建一条 "scheduled" 状态的任务记录，
该任务出现在任务列表中，状态显示为"待扫描"。
ScheduledScanRunner 在 next_run_at 到达时复用该任务并启动扫描。
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "015_add_scheduled_scan_id"
down_revision = "014_add_dataflow"
branch_labels = None
depends_on = None


def _columns(table_name: str) -> set[str]:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    # audit_tasks: 添加 scheduled_scan_id 列
    cols = _columns("audit_tasks")
    if "scheduled_scan_id" not in cols:
        op.add_column(
            "audit_tasks",
            sa.Column("scheduled_scan_id", sa.String(), nullable=True),
        )
        op.create_index(
            "ix_audit_tasks_scheduled_scan_id",
            "audit_tasks",
            ["scheduled_scan_id"],
        )

    # agent_tasks: 添加 scheduled_scan_id 列
    cols = _columns("agent_tasks")
    if "scheduled_scan_id" not in cols:
        op.add_column(
            "agent_tasks",
            sa.Column("scheduled_scan_id", sa.String(36), nullable=True),
        )
        op.create_index(
            "ix_agent_tasks_scheduled_scan_id",
            "agent_tasks",
            ["scheduled_scan_id"],
        )

    # scheduled_scans: 添加白名单配置列
    cols = _columns("scheduled_scans")
    if "function_whitelist" not in cols:
        op.add_column(
            "scheduled_scans",
            sa.Column("function_whitelist", sa.Text(), server_default="[]"),
        )
    if "vulnerability_whitelist" not in cols:
        op.add_column(
            "scheduled_scans",
            sa.Column("vulnerability_whitelist", sa.Text(), server_default="[]"),
        )
    if "sanitizer_functions" not in cols:
        op.add_column(
            "scheduled_scans",
            sa.Column("sanitizer_functions", sa.Text(), server_default="[]"),
        )


def downgrade() -> None:
    # scheduled_scans: 移除白名单列
    cols = _columns("scheduled_scans")
    if "sanitizer_functions" in cols:
        op.drop_column("scheduled_scans", "sanitizer_functions")
    if "vulnerability_whitelist" in cols:
        op.drop_column("scheduled_scans", "vulnerability_whitelist")
    if "function_whitelist" in cols:
        op.drop_column("scheduled_scans", "function_whitelist")

    # agent_tasks: 移除 scheduled_scan_id
    cols = _columns("agent_tasks")
    if "scheduled_scan_id" in cols:
        op.drop_index("ix_agent_tasks_scheduled_scan_id", "agent_tasks")
        op.drop_column("agent_tasks", "scheduled_scan_id")

    # audit_tasks: 移除 scheduled_scan_id
    cols = _columns("audit_tasks")
    if "scheduled_scan_id" in cols:
        op.drop_index("ix_audit_tasks_scheduled_scan_id", "audit_tasks")
        op.drop_column("audit_tasks", "scheduled_scan_id")
