from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def uuid_str() -> str:
    return str(uuid.uuid4())


class Pet(Base):
    __tablename__ = "pets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    owner_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    pet_code: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    qr_token: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    animal_type: Mapped[str] = mapped_column(String(30), index=True, nullable=False)
    breed: Mapped[str | None] = mapped_column(String(120), nullable=True)
    gender: Mapped[str | None] = mapped_column(String(30), nullable=True)
    color: Mapped[str | None] = mapped_column(String(120), nullable=True)
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    weight: Mapped[Decimal | None] = mapped_column(Numeric(7, 2), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    distinctive_marks: Mapped[str | None] = mapped_column(Text, nullable=True)
    microchip_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    profile_image_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    emergency_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="normal", index=True, nullable=False)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    owner = relationship("User", back_populates="pets")
    guardians = relationship("PetGuardian", back_populates="pet", cascade="all, delete-orphan")
    images = relationship("PetImage", back_populates="pet", cascade="all, delete-orphan")


class PetImage(Base):
    __tablename__ = "pet_images"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    pet_id: Mapped[str] = mapped_column(String(36), ForeignKey("pets.id", ondelete="CASCADE"), index=True)
    image_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    pet = relationship("Pet", back_populates="images")


class PetGuardian(Base):
    __tablename__ = "pet_guardians"
    __table_args__ = (UniqueConstraint("pet_id", "user_id", name="uq_pet_guardian_user"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    pet_id: Mapped[str] = mapped_column(String(36), ForeignKey("pets.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(30), default="guardian", nullable=False)
    can_edit: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_mark_lost: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    can_view_private_info: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_receive_notifications: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    pet = relationship("Pet", back_populates="guardians")
    user = relationship("User")
