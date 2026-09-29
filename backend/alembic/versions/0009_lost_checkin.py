"""Add weekly check-in columns to lost_posts

Revision ID: 0009_lost_checkin
Revises: 0008_sighting_images
Create Date: 2026-09-29
"""

from alembic import op
import sqlalchemy as sa

revision = "0009_lost_checkin"
down_revision = "0008_sighting_images"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("lost_posts", sa.Column("checkin_base_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("lost_posts", sa.Column("checkin_asked_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_lost_posts_checkin_asked_at", "lost_posts", ["checkin_asked_at"])


def downgrade() -> None:
    op.drop_index("ix_lost_posts_checkin_asked_at", table_name="lost_posts")
    op.drop_column("lost_posts", "checkin_asked_at")
    op.drop_column("lost_posts", "checkin_base_at")
