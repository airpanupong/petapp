from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class HealthProfileUpdate(BaseModel):
    allergies: str | None = None
    medications: str | None = None
    conditions: str | None = None
    vet_name: str | None = Field(default=None, max_length=160)
    vet_phone: str | None = Field(default=None, max_length=60)
    notes: str | None = None


class HealthProfileRead(HealthProfileUpdate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    pet_id: str
    updated_at: datetime


class VaccinationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    given_at: date
    next_due_at: date | None = None
    clinic_name: str | None = Field(default=None, max_length=200)
    note: str | None = None


class VaccinationRead(VaccinationCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    pet_id: str
    created_at: datetime


class EmergencyInfoUpdate(BaseModel):
    public_allergies: str | None = None
    public_medications: str | None = None
    public_conditions: str | None = None
    emergency_note: str | None = None
    emergency_contact_name: str | None = Field(default=None, max_length=160)
    emergency_contact_phone: str | None = Field(default=None, max_length=60)
    show_contact_phone: bool = False


class EmergencyInfoRead(EmergencyInfoUpdate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    pet_id: str
    updated_at: datetime


class OwnershipVerificationCreate(BaseModel):
    method: Literal["microchip", "documents", "photos", "other"]
    evidence_note: str | None = Field(default=None, max_length=4000)
    evidence_url: str | None = Field(default=None, max_length=1000)


class OwnershipVerificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    pet_id: str
    owner_id: str
    method: str
    evidence_note: str | None = None
    evidence_url: str | None = None
    status: str
    reviewer_note: str | None = None
    submitted_at: datetime
    reviewed_at: datetime | None = None


class OwnershipReview(BaseModel):
    status: Literal["verified", "rejected"]
    reviewer_note: str | None = Field(default=None, max_length=4000)


class NotificationPreferenceUpdate(BaseModel):
    lost_alerts: bool = True
    radius_km: float = Field(default=5, ge=1, le=50)
    animal_type: Literal["all", "dog", "cat", "other"] = "all"
    chat_notifications: bool = True
    marketing_notifications: bool = False


class NotificationPreferenceRead(NotificationPreferenceUpdate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    user_id: str
    updated_at: datetime


class UserLocationUpdate(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    user_id: str
    type: str
    title: str
    body: str
    reference_type: str | None = None
    reference_id: str | None = None
    is_read: bool
    created_at: datetime


class DeviceTokenCreate(BaseModel):
    platform: Literal["ios", "android"]
    token: str = Field(min_length=1, max_length=1000)
    device_id: str | None = Field(default=None, max_length=200)


class WebPushKeys(BaseModel):
    p256dh: str = Field(min_length=1, max_length=200)
    auth: str = Field(min_length=1, max_length=100)


class WebPushSubscribe(BaseModel):
    endpoint: str = Field(min_length=12, max_length=1000, pattern=r"^https://")
    keys: WebPushKeys


class WebPushUnsubscribe(BaseModel):
    endpoint: str = Field(min_length=1, max_length=1000)


class DeviceTokenRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    platform: str
    token: str
    device_id: str | None = None
    is_active: bool


class AdEventCreate(BaseModel):
    event_type: Literal["impression", "click"]


class PetFoundAlertCreate(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    location_text: str | None = Field(default=None, max_length=300)
    note: str | None = Field(default=None, max_length=2000)
