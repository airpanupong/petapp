from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.exceptions import AppError
from app.core.responses import success
from app.models.pet import Pet
from app.models.features import PetEmergencyInfo, OwnershipVerification
from app.models.user import User
from app.schemas.pet import PetCreate, PetRead, PetUpdate, PublicPetRead
from app.schemas.features import PetFoundAlertCreate
from app.services.chat_service import find_or_create_conversation
from app.services.notification_service import add_notification, notify_pet_guardians
from app.services.pet_service import get_owned_pet, unique_pet_code, unique_qr_token
from app.schemas.community import ConversationRead

router = APIRouter(tags=["pets"])


@router.get("/pets")
def list_pets(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pets = db.scalars(
        select(Pet)
        .where(Pet.owner_id == current_user.id, Pet.deleted_at.is_(None))
        .order_by(Pet.created_at.desc())
    ).all()
    return success([PetRead.model_validate(p).model_dump(mode="json") for p in pets])


@router.post("/pets", status_code=201)
def create_pet(
    payload: PetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pet = Pet(
        owner_id=current_user.id,
        pet_code=unique_pet_code(db),
        qr_token=unique_qr_token(db),
        **payload.model_dump(),
    )
    db.add(pet)
    db.commit()
    db.refresh(pet)
    return success(PetRead.model_validate(pet).model_dump(mode="json"))


@router.get("/pets/{pet_id}")
def get_pet(
    pet_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pet = get_owned_pet(db, current_user, pet_id)
    return success(PetRead.model_validate(pet).model_dump(mode="json"))


@router.patch("/pets/{pet_id}")
def update_pet(
    pet_id: str,
    payload: PetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pet = get_owned_pet(db, current_user, pet_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(pet, key, value)
    db.commit()
    db.refresh(pet)
    return success(PetRead.model_validate(pet).model_dump(mode="json"))


@router.delete("/pets/{pet_id}", status_code=204)
def delete_pet(
    pet_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pet = get_owned_pet(db, current_user, pet_id)
    pet.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return None


@router.get("/public/pets/qr/{qr_token}")
def public_pet(qr_token: str, db: Session = Depends(get_db)):
    pet = db.scalar(
        select(Pet).where(Pet.qr_token == qr_token, Pet.deleted_at.is_(None), Pet.is_public.is_(True))
    )
    if pet is None:
        raise AppError(404, "PET_NOT_FOUND", "Public pet profile not found")
    data = PublicPetRead(
        id=pet.id,
        pet_code=pet.pet_code,
        name=pet.name,
        animal_type=pet.animal_type,
        breed=pet.breed,
        gender=pet.gender,
        color=pet.color,
        description=pet.description,
        distinctive_marks=pet.distinctive_marks,
        profile_image_url=pet.profile_image_url,
        emergency_note=pet.emergency_note,
        status=pet.status,
    ).model_dump(mode="json")
    emergency = db.scalar(select(PetEmergencyInfo).where(PetEmergencyInfo.pet_id == pet.id))
    if emergency:
        data["emergency"] = {
            "public_allergies": emergency.public_allergies,
            "public_medications": emergency.public_medications,
            "public_conditions": emergency.public_conditions,
            "emergency_note": emergency.emergency_note,
            "emergency_contact_name": emergency.emergency_contact_name,
            "emergency_contact_phone": emergency.emergency_contact_phone if emergency.show_contact_phone else None,
            "show_contact_phone": emergency.show_contact_phone,
        }
    verified = db.scalar(
        select(OwnershipVerification).where(
            OwnershipVerification.pet_id == pet.id, OwnershipVerification.status == "verified"
        ).order_by(OwnershipVerification.reviewed_at.desc())
    )
    data["ownership_verified"] = verified is not None
    data["owner_id"] = pet.owner_id
    data["actions"] = {"report_found": True, "contact_owner": True}
    return success(data)


@router.post("/public/pets/qr/{qr_token}/contact", status_code=201)
def contact_pet_owner(
    qr_token: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pet = db.scalar(select(Pet).where(Pet.qr_token == qr_token, Pet.deleted_at.is_(None)))
    if pet is None:
        raise AppError(404, "PET_NOT_FOUND", "Pet not found")
    conversation = find_or_create_conversation(
        db,
        current_user=current_user,
        other_user_id=pet.owner_id,
        conv_type="pet_contact",
        reference_id=pet.id,
    )
    return success(ConversationRead.model_validate(conversation).model_dump(mode="json"))


@router.post("/public/pets/qr/{qr_token}/found-alert", status_code=201)
def report_registered_pet_found(
    qr_token: str,
    payload: PetFoundAlertCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pet = db.scalar(select(Pet).where(Pet.qr_token == qr_token, Pet.deleted_at.is_(None)))
    if pet is None:
        raise AppError(404, "PET_NOT_FOUND", "Pet not found")
    if pet.owner_id == current_user.id:
        raise AppError(409, "PET_IS_OWNED_BY_REPORTER", "This is your own pet")
    where = payload.location_text or f"{payload.latitude:.5f}, {payload.longitude:.5f}"
    body = f"มีผู้ใช้แจ้งว่าพบ {pet.name} บริเวณ {where}"
    if payload.note:
        body += f" · {payload.note}"
    add_notification(db, pet.owner_id, "registered_pet_found", f"มีคนพบ {pet.name} 🐾", body, "pet", pet.id)
    notify_pet_guardians(db, pet.id, "registered_pet_found", f"มีคนพบ {pet.name} 🐾", body, "pet", pet.id, current_user.id)
    db.commit()
    return success({"reported": True, "pet_id": pet.id})
