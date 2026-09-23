from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.core.security import generate_pet_code, generate_qr_token
from app.models.pet import Pet
from app.models.user import User


def get_owned_pet(db: Session, user: User, pet_id: str) -> Pet:
    pet = db.scalar(select(Pet).where(Pet.id == pet_id, Pet.deleted_at.is_(None)))
    if pet is None:
        raise AppError(404, "PET_NOT_FOUND", "Pet not found")
    if pet.owner_id != user.id:
        raise AppError(403, "PET_FORBIDDEN", "You do not own this pet")
    return pet


def unique_pet_code(db: Session) -> str:
    for _ in range(10):
        code = generate_pet_code()
        if db.scalar(select(Pet.id).where(Pet.pet_code == code)) is None:
            return code
    raise RuntimeError("Could not allocate pet code")


def unique_qr_token(db: Session) -> str:
    for _ in range(10):
        token = generate_qr_token()
        if db.scalar(select(Pet.id).where(Pet.qr_token == token)) is None:
            return token
    raise RuntimeError("Could not allocate QR token")
