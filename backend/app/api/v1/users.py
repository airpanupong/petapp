from __future__ import annotations

from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.exceptions import AppError
from app.core.responses import success
from app.core.roles import SUPER_ADMIN
from app.core.security import verify_password
from app.models.lost_found import FoundPost, LostPost
from app.models.user import User
from app.schemas.auth import DeleteAccountRequest
from app.schemas.lost_found import FoundPostRead, LostPostRead
from app.schemas.user import UserRead, UserUpdate
from app.services.account_service import delete_account

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return success(UserRead.model_validate(current_user).model_dump(mode="json"))


@router.patch("/me")
def update_me(
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(current_user, key, value)
    db.commit()
    db.refresh(current_user)
    return success(UserRead.model_validate(current_user).model_dump(mode="json"))


@router.delete("/me", status_code=204)
def delete_me(
    payload: DeleteAccountRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == SUPER_ADMIN:
        raise AppError(400, "SUPER_ADMIN_UNDELETABLE", "Super admin accounts cannot be deleted")
    if not verify_password(payload.password, current_user.password_hash):
        raise AppError(400, "INVALID_PASSWORD", "Password is incorrect")
    delete_account(db, current_user)
    return Response(status_code=204)


@router.get("/me/posts")
def my_posts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lost = db.scalars(
        select(LostPost).where(LostPost.owner_id == current_user.id).order_by(LostPost.created_at.desc()).limit(100)
    ).all()
    found = db.scalars(
        select(FoundPost)
        .where(FoundPost.reporter_id == current_user.id)
        .order_by(FoundPost.created_at.desc())
        .limit(100)
    ).all()
    lost_items = []
    for post in lost:
        item = LostPostRead.model_validate(post).model_dump(mode="json")
        if post.pet:
            item["pet"] = {
                "id": post.pet.id,
                "name": post.pet.name,
                "animal_type": post.pet.animal_type,
                "breed": post.pet.breed,
                "color": post.pet.color,
                "profile_image_url": post.pet.profile_image_url,
            }
        lost_items.append(item)
    return success(
        {
            "lost": lost_items,
            "found": [FoundPostRead.model_validate(x).model_dump(mode="json") for x in found],
        }
    )
