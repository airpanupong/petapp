from __future__ import annotations

import uuid
from datetime import datetime, timedelta

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


CHECKIN_INTERVAL = timedelta(days=7)
CHECKIN_RESPONSE_WINDOW = timedelta(days=7)
MAX_POST_PHOTOS = 3


def uuid_str() -> str:
    return str(uuid.uuid4())


def photo_columns(urls: list[str | None]) -> dict:
    """image_url stays the cover photo so single-image readers keep working."""
    images = list(dict.fromkeys(u for u in urls if u))[:MAX_POST_PHOTOS]
    return {"image_url": images[0] if images else None, "image_urls": images or None}


def photo_update(fields: dict) -> dict:
    """Pops photo keys from a PATCH payload and returns the columns to write (an empty image_urls clears all photos)."""
    urls = fields.pop("image_urls", None)
    single = fields.pop("image_url", None)
    if urls is not None:
        return photo_columns(urls)
    if single:
        return photo_columns([single])
    return {}


class LostPost(Base):
    __tablename__ = "lost_posts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    pet_id: Mapped[str] = mapped_column(String(36), ForeignKey("pets.id", ondelete="CASCADE"), index=True)
    owner_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(30), default="active", index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    lost_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    location_text: Mapped[str | None] = mapped_column(String(300), nullable=True)
    search_radius_km: Mapped[float] = mapped_column(Float, default=5.0, nullable=False)
    reward_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    reward_text: Mapped[str | None] = mapped_column(String(300), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    image_urls: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    share_token: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # The weekly "found yet?" cycle counts from checkin_base_at (or created_at when unset).
    checkin_base_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    checkin_asked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)

    pet = relationship("Pet")
    owner = relationship("User")
    sightings = relationship("Sighting", back_populates="lost_post", cascade="all, delete-orphan")

    @property
    def checkin_deadline_at(self) -> datetime | None:
        if self.checkin_asked_at is None or self.status != "active":
            return None
        return self.checkin_asked_at + CHECKIN_RESPONSE_WINDOW


class FoundPost(Base):
    __tablename__ = "found_posts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    reporter_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True)
    animal_type: Mapped[str] = mapped_column(String(30), index=True, nullable=False)
    breed_guess: Mapped[str | None] = mapped_column(String(120), nullable=True)
    color: Mapped[str | None] = mapped_column(String(120), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    image_urls: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    found_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    location_text: Mapped[str | None] = mapped_column(String(300), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="active", index=True, nullable=False)
    share_token: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    reporter = relationship("User")


class Sighting(Base):
    __tablename__ = "sightings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    lost_post_id: Mapped[str] = mapped_column(String(36), ForeignKey("lost_posts.id", ondelete="CASCADE"), index=True)
    reporter_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    location_text: Mapped[str | None] = mapped_column(String(300), nullable=True)
    direction: Mapped[str | None] = mapped_column(String(80), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    image_urls: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    lost_post = relationship("LostPost", back_populates="sightings")
    reporter = relationship("User")
