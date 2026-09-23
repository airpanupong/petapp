from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.responses import success
from app.models.features import PetEmergencyInfo
from app.models.user import User
from app.schemas.features import EmergencyInfoRead, EmergencyInfoUpdate
from app.services.pet_service import get_owned_pet

router = APIRouter(tags=["pet-emergency"])


def get_or_create_emergency(db: Session, pet_id: str) -> PetEmergencyInfo:
    row = db.scalar(select(PetEmergencyInfo).where(PetEmergencyInfo.pet_id == pet_id))
    if row is None:
        row = PetEmergencyInfo(pet_id=pet_id)
        db.add(row); db.flush()
    return row


@router.get("/pets/{pet_id}/emergency")
def get_emergency(pet_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    get_owned_pet(db, current_user, pet_id)
    row = get_or_create_emergency(db, pet_id)
    db.commit(); db.refresh(row)
    return success(EmergencyInfoRead.model_validate(row).model_dump(mode="json"))


@router.put("/pets/{pet_id}/emergency")
def update_emergency(pet_id: str, payload: EmergencyInfoUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pet = get_owned_pet(db, current_user, pet_id)
    row = get_or_create_emergency(db, pet_id)
    for key, value in payload.model_dump().items():
        setattr(row, key, value)
    pet.emergency_note = payload.emergency_note
    db.commit(); db.refresh(row)
    return success(EmergencyInfoRead.model_validate(row).model_dump(mode="json"))
