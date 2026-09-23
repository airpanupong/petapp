"""Add image_url to lost_posts

Revision ID: 0003_lost_post_image
Revises: 0002_full_features
Create Date: 2026-09-23
"""

from alembic import op
import sqlalchemy as sa

revision = "0003_lost_post_image"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("lost_posts", sa.Column("image_url", sa.String(length=1000), nullable=True))


def downgrade() -> None:
    op.drop_column("lost_posts", "image_url")
