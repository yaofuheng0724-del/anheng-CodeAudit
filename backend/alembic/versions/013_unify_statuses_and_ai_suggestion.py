"""unify issue statuses and add ai_suggestion column

Revision ID: 013_unify_statuses
Revises: bb3ab402d17a
Create Date: 2026-06-02 00:00:00.000000

状态统一为 4 种: fixed, not_fixed, false_positive, suspicious
同时新增 ai_suggestion 列用于存储 AI 排查结果

旧状态迁移映射:
  audit_issues: open -> not_fixed, resolved -> not_fixed, pending_review -> suspicious
  agent_findings: new -> not_fixed, verified -> not_fixed, wont_fix -> not_fixed,
                  analyzing -> suspicious, needs_review -> suspicious,
                  duplicate -> false_positive
  fixed 和 false_positive 保持不变
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "013_unify_statuses"
down_revision = "bb3ab402d17a"
branch_labels = None
depends_on = None


def _columns(table_name: str) -> set[str]:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    # ---- 1. 状态数据迁移 ----
    # audit_issues: open -> not_fixed, resolved -> not_fixed, pending_review -> suspicious
    op.execute("UPDATE audit_issues SET status = 'not_fixed' WHERE status = 'open'")
    op.execute("UPDATE audit_issues SET status = 'not_fixed' WHERE status = 'resolved'")
    op.execute("UPDATE audit_issues SET status = 'suspicious' WHERE status = 'pending_review'")

    # agent_findings: 旧状态映射
    op.execute("UPDATE agent_findings SET status = 'not_fixed' WHERE status = 'new'")
    op.execute("UPDATE agent_findings SET status = 'not_fixed' WHERE status = 'verified'")
    op.execute("UPDATE agent_findings SET status = 'not_fixed' WHERE status = 'wont_fix'")
    op.execute("UPDATE agent_findings SET status = 'suspicious' WHERE status IN ('analyzing', 'needs_review')")
    op.execute("UPDATE agent_findings SET status = 'false_positive' WHERE status = 'duplicate'")

    # ---- 2. 更新 server_default ----
    # audit_issues.status 默认值改为 not_fixed
    op.alter_column("audit_issues", "status",
                    server_default="not_fixed")

    # agent_findings.status 默认值改为 not_fixed
    op.alter_column("agent_findings", "status",
                    existing_type=sa.String(30),
                    server_default="not_fixed")

    # ---- 3. 新增 ai_suggestion 列 ----
    audit_cols = _columns("audit_issues")
    if "ai_suggestion" not in audit_cols:
        op.add_column("audit_issues",
                      sa.Column("ai_suggestion", sa.Text(), nullable=True))

    agent_cols = _columns("agent_findings")
    if "ai_suggestion" not in agent_cols:
        op.add_column("agent_findings",
                      sa.Column("ai_suggestion", sa.Text(), nullable=True))


def downgrade() -> None:
    # 注意：状态映射是损压缩的（verified 和 wont_fix 都映射到了 not_fixed），
    # 降级时无法完美还原，仅做尽力恢复

    # audit_issues: 逆向映射（best-effort）
    op.execute("UPDATE audit_issues SET status = 'open' WHERE status = 'not_fixed'")
    op.execute("UPDATE audit_issues SET status = 'suspicious' WHERE status = 'suspicious'")  # 无变化
    # fixed 在旧系统中无直接对应，映射为 resolved
    op.execute("UPDATE audit_issues SET status = 'resolved' WHERE status = 'fixed'")

    # agent_findings: 逆向映射（best-effort）
    op.execute("UPDATE agent_findings SET status = 'new' WHERE status = 'not_fixed'")
    op.execute("UPDATE agent_findings SET status = 'analyzing' WHERE status = 'suspicious'")

    # 还原 server_default
    op.alter_column("audit_issues", "status",
                    server_default="open")
    op.alter_column("agent_findings", "status",
                    existing_type=sa.String(30),
                    server_default="new")

    # 删除 ai_suggestion 列
    audit_cols = _columns("audit_issues")
    if "ai_suggestion" in audit_cols:
        op.drop_column("audit_issues", "ai_suggestion")

    agent_cols = _columns("agent_findings")
    if "ai_suggestion" in agent_cols:
        op.drop_column("agent_findings", "ai_suggestion")