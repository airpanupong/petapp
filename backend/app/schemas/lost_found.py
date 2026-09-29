from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

PhotoList = list[Annotated[str, Field(min_length=1, max_length=1000)]]


class PhotoRead(BaseModel):
    image_url: str | None = None
    image_urls: list[str] = Field(default_factory=list)

    @field_validator("image_urls", mode="before")
    @classmethod
    def _none_to_list(cls, v: list[str] | None) -> list[str]:
        return v or []

    @model_validator(mode="after")
    def _cover_fallback(self):
        if not self.image_urls and self.image_url:
            self.image_urls = [self.image_url]
        return self


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
    image_urls: PhotoList = Field(default_factory=list, max_length=3)


class LostPostUpdate(BaseModel):
    lost_at: datetime | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    description: str | None = None
    location_text: str | None = Field(default=None, max_length=300)
    search_radius_km: float | None = Field(default=None, gt=0, le=100)
    reward_enabled: bool | None = None
    reward_text: str | None = None
    image_url: str | None = None
    image_urls: PhotoList | None = Field(default=None, max_length=3)


class LostPostRead(PhotoRead):
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
    share_token: str
    created_at: datetime
    closed_at: datetime | None = None
    checkin_asked_at: datetime | None = None
    checkin_deadline_at: datetime | None = None


class LostCheckinAnswer(BaseModel):
    found: bool


class FoundPostCreate(BaseModel):
    animal_type: Literal["dog", "cat", "other"]
    breed_guess: str | None = None
    color: str | None = None
    description: str | None = None
    image_url: str | None = None
    image_urls: PhotoList = Field(default_factory=list, max_length=3)
    found_at: datetime
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    location_text: str | None = None


class FoundPostUpdate(BaseModel):
    animal_type: Literal["dog", "cat", "other"] | None = None
    breed_guess: str | None = None
    color: str | None = None
    description: str | None = None
    image_url: str | None = None
    image_urls: PhotoList | None = Field(default=None, max_length=3)
    found_at: datetime | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    location_text: str | None = None


class FoundPostRead(PhotoRead):
    model_config = ConfigDict(from_attributes=True)

    id: str
    reporter_id: str | None = None
    animal_type: str
    breed_guess: str | None = None
    color: str | None = None
    description: str | None = None
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
    image_urls: list[Annotated[str, Field(min_length=1, max_length=1000)]] = Field(default_factory=list, max_length=3)


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
    image_urls: list[str] = Field(default_factory=list)
    created_at: datetime

    @field_validator("image_urls", mode="before")
    @classmethod
    def _none_to_list(cls, v: list[str] | None) -> list[str]:
        return v or []
