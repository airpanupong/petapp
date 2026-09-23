from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ReportCreate(BaseModel):
    target_type: Literal["post", "user", "message", "ad", "lost_post", "found_post"]
    target_id: str
    reason: Literal[
        "spam",
        "fake_post",
        "fraud",
        "inappropriate",
        "animal_abuse",
        "harassment",
        "other",
    ]
    details: str | None = Field(default=None, max_length=2000)


class ReportRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    reporter_id: str
    target_type: str
    target_id: str
    reason: str
    details: str | None = None
    status: str
    resolver_id: str | None = None
    resolver_note: str | None = None
    created_at: datetime
    resolved_at: datetime | None = None


class ReportResolve(BaseModel):
    status: Literal["resolved", "dismissed", "action_taken"]
    resolver_note: str | None = Field(default=None, max_length=2000)


class PresignRequest(BaseModel):
    content_type: Literal["image/jpeg", "image/png", "image/webp", "image/jpg"] = "image/jpeg"
    filename: str | None = Field(default=None, max_length=200)
