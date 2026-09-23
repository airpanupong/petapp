from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PetImageCreate(BaseModel):
    image_url: str = Field(min_length=1, max_length=1000)
    is_primary: bool = False


class PetImageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    pet_id: str
    image_url: str
    is_primary: bool
    created_at: datetime
