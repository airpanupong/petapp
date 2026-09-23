from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: EmailStr
    display_name: str
    phone: str | None = None
    avatar_url: str | None = None
    role: str
    status: str
    created_at: datetime


class UserUpdate(BaseModel):
    display_name: str | None = None
    phone: str | None = None
    avatar_url: str | None = None
