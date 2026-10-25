"""Record PDPA consent on users

Revision ID: 0012_user_consent
Revises: 0011_merge_conversations
Create Date: 2026-09-30
"""

from alembic import op
import sqlalchemy as sa

revision = "0012_user_consent"
down_revision = "0011_merge_conversations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("privacy_accepted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("data_access_accepted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("consent_version", sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "consent_version")
    op.drop_column("users", "data_access_accepted_at")
    op.drop_column("users", "privacy_accepted_at")
