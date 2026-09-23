from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.exceptions import AppError
from app.core.responses import success
from app.models.features import PetHealthProfile, Vaccination
from app.models.user import User
from app.schemas.features import HealthProfileRead, HealthProfileUpdate, VaccinationCreate, VaccinationRead
from app.services.pet_service import get_owned_pet

router = APIRouter(tags=["pet-health"])


def get_or_create_health(db: Session, pet_id: str) -> PetHealthProfile:
    row = db.scalar(select(PetHealthProfile).where(PetHealthProfile.pet_id == pet_id))
    if row is None:
        row = PetHealthProfile(pet_id=pet_id)
        db.add(row)
        db.flush()
    return row


@router.get("/pets/{pet_id}/health")
def get_health(pet_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    get_owned_pet(db, current_user, pet_id)
    row = get_or_create_health(db, pet_id)
    db.commit(); db.refresh(row)
    return success(HealthProfileRead.model_validate(row).model_dump(mode="json"))


@router.put("/pets/{pet_id}/health")
def update_health(pet_id: str, payload: HealthProfileUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    get_owned_pet(db, current_user, pet_id)
    row = get_or_create_health(db, pet_id)
    for key, value in payload.model_dump().items():
        setattr(row, key, value)
    db.commit(); db.refresh(row)
    return success(HealthProfileRead.model_validate(row).model_dump(mode="json"))


@router.get("/pets/{pet_id}/vaccinations")
def list_vaccinations(pet_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    get_owned_pet(db, current_user, pet_id)
    rows = db.scalars(select(Vaccination).where(Vaccination.pet_id == pet_id).order_by(Vaccination.given_at.desc())).all()
    return success([VaccinationRead.model_validate(x).model_dump(mode="json") for x in rows])


@router.post("/pets/{pet_id}/vaccinations", status_code=201)
def create_vaccination(pet_id: str, payload: VaccinationCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    get_owned_pet(db, current_user, pet_id)
    row = Vaccination(pet_id=pet_id, **payload.model_dump())
    db.add(row); db.commit(); db.refresh(row)
    return success(VaccinationRead.model_validate(row).model_dump(mode="json"))


@router.delete("/pets/{pet_id}/vaccinations/{vaccination_id}", status_code=204)
def delete_vaccination(pet_id: str, vaccination_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    get_owned_pet(db, current_user, pet_id)
    row = db.scalar(select(Vaccination).where(Vaccination.id == vaccination_id, Vaccination.pet_id == pet_id))
    if row is None:
        raise AppError(404, "VACCINATION_NOT_FOUND", "Vaccination not found")
    db.delete(row); db.commit()
    return None
