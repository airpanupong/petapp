from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class GuardianCreate(BaseModel):
    email: EmailStr
    role: str = "guardian"
    can_edit: bool = False
    can_mark_lost: bool = True
    can_view_private_info: bool = False
    can_receive_notifications: bool = True


class GuardianRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    pet_id: str
    user_id: str
    role: str
    can_edit: bool
    can_mark_lost: bool
    can_view_private_info: bool
    can_receive_notifications: bool
    created_at: datetime
    display_name: str | None = None
    email: str | None = None


class GuardianUpdate(BaseModel):
    role: str | None = None
    can_edit: bool | None = None
    can_mark_lost: bool | None = None
    can_view_private_info: bool | None = None
    can_receive_notifications: bool | None = None


class AdRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    advertiser_name: str
    title: str
    description: str
    image_url: str | None = None
    target_url: str | None = None
    ad_type: str


class ConversationCreate(BaseModel):
    member_user_id: str
    type: str = "lost_found"
    reference_id: str | None = None


class ConversationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    type: str
    reference_id: str | None = None
    created_at: datetime


class MessageCreate(BaseModel):
    message_type: str = "text"
    content: str | None = Field(default=None, max_length=4000)
    image_url: str | None = None


class MessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    conversation_id: str
    sender_id: str
    message_type: str
    content: str | None = None
    image_url: str | None = None
    created_at: datetime
    read_at: datetime | None = None
