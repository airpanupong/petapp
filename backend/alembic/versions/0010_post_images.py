"""Add image_urls to lost_posts and found_posts

Revision ID: 0010_post_images
Revises: 0009_lost_checkin
Create Date: 2026-09-29
"""

from alembic import op
import sqlalchemy as sa

revision = "0010_post_images"
down_revision = "0009_lost_checkin"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("lost_posts", sa.Column("image_urls", sa.JSON(), nullable=True))
    op.add_column("found_posts", sa.Column("image_urls", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("found_posts", "image_urls")
    op.drop_column("lost_posts", "image_urls")
