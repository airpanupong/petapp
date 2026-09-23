from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class LostPostCreate(BaseModel):
    pet_id: str
    lost_at: datetime
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    location_text: str | None = Field(default=None, max_length=300)
    search_radius_km: float = Field(default=5, gt=0, le=100)
    description: str | None = None
    reward_enabled: bool = False
    reward_text: str | None = Field(default=None, max_length=300)
    image_url: str | None = Field(default=None, max_length=1000)


class LostPostUpdate(BaseModel):
    description: str | None = None
    location_text: str | None = None
    search_radius_km: float | None = Field(default=None, gt=0, le=100)
    reward_enabled: bool | None = None
    reward_text: str | None = None
    image_url: str | None = None


class LostPostRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    pet_id: str
    owner_id: str
    status: str
    title: str
    description: str | None = None
    lost_at: datetime
    latitude: float
    longitude: float
    location_text: str | None = None
    search_radius_km: float
    reward_enabled: bool
    reward_text: str | None = None
    image_url: str | None = None
    share_token: str
    created_at: datetime
    closed_at: datetime | None = None


class FoundPostCreate(BaseModel):
    animal_type: Literal["dog", "cat", "other"]
    breed_guess: str | None = None
    color: str | None = None
    description: str | None = None
    image_url: str | None = None
    found_at: datetime
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    location_text: str | None = None


class FoundPostRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    reporter_id: str | None = None
    animal_type: str
    breed_guess: str | None = None
    color: str | None = None
    description: str | None = None
    image_url: str | None = None
    found_at: datetime
    latitude: float
    longitude: float
    location_text: str | None = None
    status: str
    share_token: str
    created_at: datetime


class SightingCreate(BaseModel):
    seen_at: datetime
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    location_text: str | None = None
    direction: str | None = None
    description: str | None = None
    image_url: str | None = None


class SightingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    lost_post_id: str
    reporter_id: str | None = None
    seen_at: datetime
    latitude: float
    longitude: float
    location_text: str | None = None
    direction: str | None = None
    description: str | None = None
    image_url: str | None = None
    created_at: datetime
