"""full pet community features

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-22
"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pet_health_profiles",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("pet_id", sa.String(36), sa.ForeignKey("pets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("allergies", sa.Text()),
        sa.Column("medications", sa.Text()),
        sa.Column("conditions", sa.Text()),
        sa.Column("vet_name", sa.String(160)),
        sa.Column("vet_phone", sa.String(60)),
        sa.Column("notes", sa.Text()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("pet_id"),
    )
    op.create_index("ix_pet_health_profiles_pet_id", "pet_health_profiles", ["pet_id"], unique=True)

    op.create_table(
        "vaccinations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("pet_id", sa.String(36), sa.ForeignKey("pets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("given_at", sa.Date(), nullable=False),
        sa.Column("next_due_at", sa.Date()),
        sa.Column("clinic_name", sa.String(200)),
        sa.Column("note", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_vaccinations_pet_id", "vaccinations", ["pet_id"])

    op.create_table(
        "pet_emergency_infos",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("pet_id", sa.String(36), sa.ForeignKey("pets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("public_allergies", sa.Text()),
        sa.Column("public_medications", sa.Text()),
        sa.Column("public_conditions", sa.Text()),
        sa.Column("emergency_note", sa.Text()),
        sa.Column("emergency_contact_name", sa.String(160)),
        sa.Column("emergency_contact_phone", sa.String(60)),
        sa.Column("show_contact_phone", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("pet_id"),
    )
    op.create_index("ix_pet_emergency_infos_pet_id", "pet_emergency_infos", ["pet_id"], unique=True)

    op.create_table(
        "ownership_verifications",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("pet_id", sa.String(36), sa.ForeignKey("pets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("owner_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("method", sa.String(40), nullable=False),
        sa.Column("evidence_note", sa.Text()),
        sa.Column("evidence_url", sa.String(1000)),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("reviewer_note", sa.Text()),
        sa.Column("submitted_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_ownership_verifications_pet_id", "ownership_verifications", ["pet_id"])
    op.create_index("ix_ownership_verifications_owner_id", "ownership_verifications", ["owner_id"])
    op.create_index("ix_ownership_verifications_status", "ownership_verifications", ["status"])

    op.create_table(
        "notification_preferences",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("lost_alerts", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("radius_km", sa.Float(), nullable=False, server_default="5"),
        sa.Column("animal_type", sa.String(30), nullable=False, server_default="all"),
        sa.Column("chat_notifications", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("marketing_notifications", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index("ix_notification_preferences_user_id", "notification_preferences", ["user_id"], unique=True)

    op.create_table(
        "user_locations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index("ix_user_locations_user_id", "user_locations", ["user_id"], unique=True)

    op.create_table(
        "notifications",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(220), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("reference_type", sa.String(50)),
        sa.Column("reference_id", sa.String(36)),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_type", "notifications", ["type"])
    op.create_index("ix_notifications_is_read", "notifications", ["is_read"])
    op.create_index("ix_notifications_created_at", "notifications", ["created_at"])

    op.create_table(
        "lost_case_followers",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("lost_post_id", sa.String(36), sa.ForeignKey("lost_posts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("lost_post_id", "user_id", name="uq_lost_case_follower"),
    )
    op.create_index("ix_lost_case_followers_lost_post_id", "lost_case_followers", ["lost_post_id"])
    op.create_index("ix_lost_case_followers_user_id", "lost_case_followers", ["user_id"])

    op.create_table(
        "device_tokens",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("platform", sa.String(20), nullable=False),
        sa.Column("token", sa.String(1000), nullable=False),
        sa.Column("device_id", sa.String(200)),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("platform", "token", name="uq_device_platform_token"),
    )
    op.create_index("ix_device_tokens_user_id", "device_tokens", ["user_id"])

    op.create_table(
        "ad_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("ad_id", sa.String(36), sa.ForeignKey("ads.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("event_type", sa.String(30), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_ad_events_ad_id", "ad_events", ["ad_id"])
    op.create_index("ix_ad_events_user_id", "ad_events", ["user_id"])


def downgrade() -> None:
    op.drop_table("ad_events")
    op.drop_table("device_tokens")
    op.drop_table("lost_case_followers")
    op.drop_table("notifications")
    op.drop_table("user_locations")
    op.drop_table("notification_preferences")
    op.drop_table("ownership_verifications")
    op.drop_table("pet_emergency_infos")
    op.drop_table("vaccinations")
    op.drop_table("pet_health_profiles")
