from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.exceptions import AppError
from app.core.responses import success
from app.models.features import OwnershipVerification
from app.models.user import User
from app.schemas.features import OwnershipReview, OwnershipVerificationCreate, OwnershipVerificationRead
from app.services.pet_service import get_owned_pet

router = APIRouter(tags=["ownership-verification"])


@router.get("/pets/{pet_id}/ownership-verification")
def get_verification(pet_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    get_owned_pet(db, current_user, pet_id)
    row = db.scalar(select(OwnershipVerification).where(OwnershipVerification.pet_id == pet_id, OwnershipVerification.owner_id == current_user.id).order_by(OwnershipVerification.submitted_at.desc()))
    return success(OwnershipVerificationRead.model_validate(row).model_dump(mode="json") if row else None)


@router.post("/pets/{pet_id}/ownership-verification", status_code=201)
def submit_verification(pet_id: str, payload: OwnershipVerificationCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pet = get_owned_pet(db, current_user, pet_id)
    previous = db.scalar(select(OwnershipVerification).where(OwnershipVerification.pet_id == pet_id, OwnershipVerification.owner_id == current_user.id).order_by(OwnershipVerification.submitted_at.desc()))
    if previous and previous.status == "verified":
        raise AppError(409, "OWNERSHIP_ALREADY_VERIFIED", "Ownership is already verified")
    if payload.method == "microchip" and not pet.microchip_id and not payload.evidence_note:
        raise AppError(422, "MICROCHIP_REQUIRED", "Add a microchip ID or evidence note before submitting")
    row = OwnershipVerification(pet_id=pet_id, owner_id=current_user.id, status="pending", **payload.model_dump())
    db.add(row); db.commit(); db.refresh(row)
    return success(OwnershipVerificationRead.model_validate(row).model_dump(mode="json"))


@router.get("/admin/ownership-verifications")
def admin_list(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise AppError(403, "AUTH_FORBIDDEN", "Admin role required")
    rows = db.scalars(select(OwnershipVerification).order_by(OwnershipVerification.submitted_at.desc()).limit(200)).all()
    return success([OwnershipVerificationRead.model_validate(x).model_dump(mode="json") for x in rows])


@router.post("/admin/ownership-verifications/{verification_id}/review")
def admin_review(verification_id: str, payload: OwnershipReview, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise AppError(403, "AUTH_FORBIDDEN", "Admin role required")
    row = db.get(OwnershipVerification, verification_id)
    if row is None:
        raise AppError(404, "VERIFICATION_NOT_FOUND", "Verification not found")
    row.status = payload.status
    row.reviewer_note = payload.reviewer_note
    row.reviewed_at = datetime.now(timezone.utc)
    db.commit(); db.refresh(row)
    return success(OwnershipVerificationRead.model_validate(row).model_dump(mode="json"))
