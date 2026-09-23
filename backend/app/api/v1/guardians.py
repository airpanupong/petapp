from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.exceptions import AppError
from app.core.responses import success
from app.models.pet import PetGuardian
from app.models.user import User
from app.schemas.community import GuardianCreate, GuardianRead, GuardianUpdate
from app.services.pet_service import get_owned_pet

router = APIRouter(prefix="/pets/{pet_id}/guardians", tags=["guardians"])


def guardian_payload(row: PetGuardian) -> dict:
    data = GuardianRead.model_validate(row).model_dump(mode="json")
    if row.user:
        data["display_name"] = row.user.display_name
        data["email"] = row.user.email
    return data


@router.get("")
def list_guardians(
    pet_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_owned_pet(db, current_user, pet_id)
    rows = db.scalars(select(PetGuardian).where(PetGuardian.pet_id == pet_id)).all()
    return success([guardian_payload(x) for x in rows])


@router.post("", status_code=201)
def add_guardian(
    pet_id: str,
    payload: GuardianCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_owned_pet(db, current_user, pet_id)
    guardian_user = db.scalar(select(User).where(User.email == payload.email.lower().strip()))
    if guardian_user is None:
        raise AppError(404, "USER_NOT_FOUND", "Guardian must already have an account")
    if guardian_user.id == current_user.id:
        raise AppError(409, "GUARDIAN_IS_OWNER", "Owner is already the primary guardian")
    existing = db.scalar(
        select(PetGuardian).where(
            PetGuardian.pet_id == pet_id,
            PetGuardian.user_id == guardian_user.id,
        )
    )
    if existing:
        raise AppError(409, "GUARDIAN_EXISTS", "User is already a guardian")
    row = PetGuardian(
        pet_id=pet_id,
        user_id=guardian_user.id,
        role=payload.role,
        can_edit=payload.can_edit,
        can_mark_lost=payload.can_mark_lost,
        can_view_private_info=payload.can_view_private_info,
        can_receive_notifications=payload.can_receive_notifications,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return success(guardian_payload(row))


@router.patch("/{guardian_id}")
def update_guardian(
    pet_id: str,
    guardian_id: str,
    payload: GuardianUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_owned_pet(db, current_user, pet_id)
    row = db.scalar(select(PetGuardian).where(PetGuardian.id == guardian_id, PetGuardian.pet_id == pet_id))
    if row is None:
        raise AppError(404, "GUARDIAN_NOT_FOUND", "Guardian not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, key, value)
    db.commit(); db.refresh(row)
    return success(guardian_payload(row))


@router.delete("/{guardian_id}", status_code=204)
def remove_guardian(
    pet_id: str,
    guardian_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_owned_pet(db, current_user, pet_id)
    row = db.scalar(
        select(PetGuardian).where(PetGuardian.id == guardian_id, PetGuardian.pet_id == pet_id)
    )
    if row is None:
        raise AppError(404, "GUARDIAN_NOT_FOUND", "Guardian not found")
    db.delete(row)
    db.commit()
    return None
