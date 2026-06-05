"""local auth and admin bootstrap

Revision ID: 009_local_auth_and_admin
Revises: 008_add_files_with_findings
Create Date: 2026-04-24 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "009_local_auth_and_admin"
down_revision = "008_add_files_with_findings"
branch_labels = None
depends_on = None


def _sanitize_username(value: str) -> str:
    allowed = []
    for ch in (value or "").lower():
        if ch.isalnum() or ch in ("_", "-", "."):
            allowed.append(ch)
        else:
            allowed.append("_")
    candidate = "".join(allowed).strip("._-")
    return candidate or "user"


def upgrade() -> None:
    op.add_column("users", sa.Column("username", sa.String(), nullable=True))

    connection = op.get_bind()
    rows = connection.execute(sa.text("SELECT id, email FROM users")).fetchall()
    used_usernames = set()

    for row in rows:
        base = _sanitize_username(
            (row.email or "").split("@")[0] if row.email else f"user_{row.id[:8]}"
        )
        candidate = base
        suffix = 1
        while candidate in used_usernames:
            suffix += 1
            candidate = f"{base}_{suffix}"
        used_usernames.add(candidate)
        connection.execute(
            sa.text("UPDATE users SET username = :username WHERE id = :id"),
            {"username": candidate, "id": row.id},
        )

    op.alter_column("users", "username", nullable=False)
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)
    op.alter_column("users", "email", existing_type=sa.String(), nullable=True)


def downgrade() -> None:
    op.alter_column("users", "email", existing_type=sa.String(), nullable=False)
    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.drop_column("users", "username")
