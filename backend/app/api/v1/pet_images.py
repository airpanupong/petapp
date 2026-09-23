from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.exceptions import AppError
from app.core.responses import success
from app.models.pet import PetImage
from app.models.user import User
from app.schemas.pet_image import PetImageCreate, PetImageRead
from app.services.pet_service import get_owned_pet

router = APIRouter(prefix="/pets/{pet_id}/images", tags=["pet-images"])

MAX_IMAGES = 8


@router.get("")
def list_pet_images(
    pet_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_owned_pet(db, current_user, pet_id)
    rows = db.scalars(
        select(PetImage).where(PetImage.pet_id == pet_id).order_by(PetImage.is_primary.desc(), PetImage.created_at.desc())
    ).all()
    return success([PetImageRead.model_validate(x).model_dump(mode="json") for x in rows])


@router.post("", status_code=201)
def add_pet_image(
    pet_id: str,
    payload: PetImageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pet = get_owned_pet(db, current_user, pet_id)
    count = len(db.scalars(select(PetImage).where(PetImage.pet_id == pet_id)).all())
    if count >= MAX_IMAGES:
        raise AppError(400, "PET_IMAGE_LIMIT", f"Maximum {MAX_IMAGES} images per pet")

    make_primary = payload.is_primary or count == 0
    if make_primary:
        for img in db.scalars(select(PetImage).where(PetImage.pet_id == pet_id)).all():
            img.is_primary = False

    row = PetImage(pet_id=pet_id, image_url=payload.image_url, is_primary=make_primary)
    db.add(row)
    if make_primary:
        pet.profile_image_url = payload.image_url
    db.commit()
    db.refresh(row)
    return success(PetImageRead.model_validate(row).model_dump(mode="json"))


@router.post("/{image_id}/primary")
def set_primary_image(
    pet_id: str,
    image_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pet = get_owned_pet(db, current_user, pet_id)
    row = db.get(PetImage, image_id)
    if row is None or row.pet_id != pet_id:
        raise AppError(404, "PET_IMAGE_NOT_FOUND", "Image not found")
    for img in db.scalars(select(PetImage).where(PetImage.pet_id == pet_id)).all():
        img.is_primary = img.id == image_id
    pet.profile_image_url = row.image_url
    db.commit()
    db.refresh(row)
    return success(PetImageRead.model_validate(row).model_dump(mode="json"))


@router.delete("/{image_id}", status_code=204)
def delete_pet_image(
    pet_id: str,
    image_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pet = get_owned_pet(db, current_user, pet_id)
    row = db.get(PetImage, image_id)
    if row is None or row.pet_id != pet_id:
        raise AppError(404, "PET_IMAGE_NOT_FOUND", "Image not found")
    was_primary = row.is_primary
    db.delete(row)
    db.flush()
    if was_primary:
        next_img = db.scalar(
            select(PetImage).where(PetImage.pet_id == pet_id).order_by(PetImage.created_at.desc())
        )
        if next_img:
            next_img.is_primary = True
            pet.profile_image_url = next_img.image_url
        else:
            pet.profile_image_url = None
    db.commit()
    return None
