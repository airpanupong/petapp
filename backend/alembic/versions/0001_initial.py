"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-09-22
"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("password_hash", sa.String(512), nullable=False),
        sa.Column("display_name", sa.String(120), nullable=False),
        sa.Column("phone", sa.String(40)),
        sa.Column("avatar_url", sa.String(1000)),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("role", sa.String(30), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("jti", sa.String(36), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("jti"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
    op.create_index("ix_refresh_tokens_jti", "refresh_tokens", ["jti"], unique=True)

    op.create_table(
        "pets",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("owner_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("pet_code", sa.String(32), nullable=False),
        sa.Column("qr_token", sa.String(128), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("animal_type", sa.String(30), nullable=False),
        sa.Column("breed", sa.String(120)),
        sa.Column("gender", sa.String(30)),
        sa.Column("color", sa.String(120)),
        sa.Column("birth_date", sa.Date()),
        sa.Column("weight", sa.Numeric(7, 2)),
        sa.Column("description", sa.Text()),
        sa.Column("distinctive_marks", sa.Text()),
        sa.Column("microchip_id", sa.String(120)),
        sa.Column("profile_image_url", sa.String(1000)),
        sa.Column("emergency_note", sa.Text()),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("is_public", sa.Boolean(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("pet_code"),
        sa.UniqueConstraint("qr_token"),
    )
    op.create_index("ix_pets_owner_id", "pets", ["owner_id"])
    op.create_index("ix_pets_pet_code", "pets", ["pet_code"], unique=True)
    op.create_index("ix_pets_qr_token", "pets", ["qr_token"], unique=True)
    op.create_index("ix_pets_animal_type", "pets", ["animal_type"])
    op.create_index("ix_pets_status", "pets", ["status"])

    op.create_table(
        "pet_guardians",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("pet_id", sa.String(36), sa.ForeignKey("pets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(30), nullable=False),
        sa.Column("can_edit", sa.Boolean(), nullable=False),
        sa.Column("can_mark_lost", sa.Boolean(), nullable=False),
        sa.Column("can_view_private_info", sa.Boolean(), nullable=False),
        sa.Column("can_receive_notifications", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("pet_id", "user_id", name="uq_pet_guardian_user"),
    )
    op.create_index("ix_pet_guardians_pet_id", "pet_guardians", ["pet_id"])
    op.create_index("ix_pet_guardians_user_id", "pet_guardians", ["user_id"])

    op.create_table(
        "lost_posts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("pet_id", sa.String(36), sa.ForeignKey("pets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("owner_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("lost_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("location_text", sa.String(300)),
        sa.Column("search_radius_km", sa.Float(), nullable=False),
        sa.Column("reward_enabled", sa.Boolean(), nullable=False),
        sa.Column("reward_text", sa.String(300)),
        sa.Column("share_token", sa.String(128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("share_token"),
    )
    op.create_index("ix_lost_posts_pet_id", "lost_posts", ["pet_id"])
    op.create_index("ix_lost_posts_owner_id", "lost_posts", ["owner_id"])
    op.create_index("ix_lost_posts_status", "lost_posts", ["status"])
    op.create_index("ix_lost_posts_share_token", "lost_posts", ["share_token"], unique=True)

    op.create_table(
        "found_posts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("reporter_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("animal_type", sa.String(30), nullable=False),
        sa.Column("breed_guess", sa.String(120)),
        sa.Column("color", sa.String(120)),
        sa.Column("description", sa.Text()),
        sa.Column("image_url", sa.String(1000)),
        sa.Column("found_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("location_text", sa.String(300)),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("share_token", sa.String(128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("share_token"),
    )
    op.create_index("ix_found_posts_reporter_id", "found_posts", ["reporter_id"])
    op.create_index("ix_found_posts_animal_type", "found_posts", ["animal_type"])
    op.create_index("ix_found_posts_status", "found_posts", ["status"])
    op.create_index("ix_found_posts_share_token", "found_posts", ["share_token"], unique=True)

    op.create_table(
        "sightings",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("lost_post_id", sa.String(36), sa.ForeignKey("lost_posts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reporter_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("location_text", sa.String(300)),
        sa.Column("direction", sa.String(80)),
        sa.Column("description", sa.Text()),
        sa.Column("image_url", sa.String(1000)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_sightings_lost_post_id", "sightings", ["lost_post_id"])

    op.create_table(
        "ads",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("advertiser_name", sa.String(160), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("image_url", sa.String(1000)),
        sa.Column("target_url", sa.String(1000)),
        sa.Column("ad_type", sa.String(30), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("start_at", sa.DateTime(timezone=True)),
        sa.Column("end_at", sa.DateTime(timezone=True)),
        sa.Column("target_latitude", sa.Float()),
        sa.Column("target_longitude", sa.Float()),
        sa.Column("target_radius_km", sa.Float()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_ads_status", "ads", ["status"])

    op.create_table(
        "conversations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("type", sa.String(30), nullable=False),
        sa.Column("reference_id", sa.String(36)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "conversation_members",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("conversation_id", sa.String(36), sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("conversation_id", "user_id", name="uq_conversation_member"),
    )
    op.create_index("ix_conversation_members_conversation_id", "conversation_members", ["conversation_id"])
    op.create_index("ix_conversation_members_user_id", "conversation_members", ["user_id"])

    op.create_table(
        "messages",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("conversation_id", sa.String(36), sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("message_type", sa.String(30), nullable=False),
        sa.Column("content", sa.Text()),
        sa.Column("image_url", sa.String(1000)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_messages_conversation_id", "messages", ["conversation_id"])
    op.create_index("ix_messages_sender_id", "messages", ["sender_id"])
    op.create_index("ix_messages_created_at", "messages", ["created_at"])


def downgrade() -> None:
    op.drop_table("messages")
    op.drop_table("conversation_members")
    op.drop_table("conversations")
    op.drop_table("ads")
    op.drop_table("sightings")
    op.drop_table("found_posts")
    op.drop_table("lost_posts")
    op.drop_table("pet_guardians")
    op.drop_table("pets")
    op.drop_table("refresh_tokens")
    op.drop_table("users")
