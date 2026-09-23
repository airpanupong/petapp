from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


AnimalType = Literal["dog", "cat", "other"]


class PetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    animal_type: AnimalType
    breed: str | None = Field(default=None, max_length=120)
    gender: str | None = Field(default=None, max_length=30)
    color: str | None = Field(default=None, max_length=120)
    birth_date: date | None = None
    weight: Decimal | None = Field(default=None, ge=0, le=500)
    description: str | None = None
    distinctive_marks: str | None = None
    microchip_id: str | None = Field(default=None, max_length=120)
    profile_image_url: str | None = None
    emergency_note: str | None = None
    is_public: bool = True


class PetUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    breed: str | None = None
    gender: str | None = None
    color: str | None = None
    birth_date: date | None = None
    weight: Decimal | None = Field(default=None, ge=0, le=500)
    description: str | None = None
    distinctive_marks: str | None = None
    microchip_id: str | None = None
    profile_image_url: str | None = None
    emergency_note: str | None = None
    is_public: bool | None = None


class PetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_id: str
    pet_code: str
    qr_token: str
    name: str
    animal_type: str
    breed: str | None = None
    gender: str | None = None
    color: str | None = None
    birth_date: date | None = None
    weight: Decimal | None = None
    description: str | None = None
    distinctive_marks: str | None = None
    microchip_id: str | None = None
    profile_image_url: str | None = None
    emergency_note: str | None = None
    status: str
    is_public: bool
    created_at: datetime
    updated_at: datetime


class PublicPetRead(BaseModel):
    id: str
    pet_code: str
    name: str
    animal_type: str
    breed: str | None = None
    gender: str | None = None
    color: str | None = None
    description: str | None = None
    distinctive_marks: str | None = None
    profile_image_url: str | None = None
    emergency_note: str | None = None
    status: str
