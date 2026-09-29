"""Add sightings.image_urls

Revision ID: 0008_sighting_images
Revises: 0007_password_reset
Create Date: 2026-09-29
"""

from alembic import op
import sqlalchemy as sa

revision = "0008_sighting_images"
down_revision = "0007_password_reset"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("sightings", sa.Column("image_urls", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("sightings", "image_urls")
