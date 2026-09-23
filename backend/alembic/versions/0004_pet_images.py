"""Add pet_images table

Revision ID: 0004_pet_images
Revises: 0003_lost_post_image
Create Date: 2026-09-23
"""

from alembic import op
import sqlalchemy as sa

revision = "0004_pet_images"
down_revision = "0003_lost_post_image"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pet_images",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("pet_id", sa.String(36), sa.ForeignKey("pets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("image_url", sa.String(1000), nullable=False),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_pet_images_pet_id", "pet_images", ["pet_id"])


def downgrade() -> None:
    op.drop_index("ix_pet_images_pet_id", table_name="pet_images")
    op.drop_table("pet_images")
