from __future__ import annotations

import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.exceptions import AppError
from app.core.responses import success
from app.models.lost_found import LostPost
from app.models.features import LostCaseFollower
from app.models.pet import Pet
from app.models.user import User
from app.schemas.lost_found import LostPostCreate, LostPostRead, LostPostUpdate
from app.services.pet_service import get_owned_pet
from app.services.notification_service import dispatch_lost_alerts, notify_pet_guardians
from app.services.chat_service import find_or_create_conversation
from app.schemas.community import ConversationRead

router = APIRouter(prefix="/lost-posts", tags=["lost-posts"])


def get_lost_post_or_404(db: Session, post_id: str) -> LostPost:
    post = db.get(LostPost, post_id)
    if post is None:
        raise AppError(404, "LOST_POST_NOT_FOUND", "Lost post not found")
    return post


@router.get("")
def list_lost_posts(
    status: str = "active",
    animal_type: str | None = None,
    db: Session = Depends(get_db),
):
    stmt = select(LostPost).join(Pet, Pet.id == LostPost.pet_id).where(LostPost.status == status)
    if animal_type:
        stmt = stmt.where(Pet.animal_type == animal_type)
    posts = db.scalars(stmt.order_by(LostPost.created_at.desc()).limit(100)).all()
    data = []
    for post in posts:
        item = LostPostRead.model_validate(post).model_dump(mode="json")
        item["pet"] = {
            "id": post.pet.id,
            "name": post.pet.name,
            "animal_type": post.pet.animal_type,
            "breed": post.pet.breed,
            "color": post.pet.color,
            "profile_image_url": post.pet.profile_image_url,
        }
        data.append(item)
    return success(data)


@router.get("/{post_id}")
def get_lost_post(post_id: str, db: Session = Depends(get_db)):
    post = get_lost_post_or_404(db, post_id)
    item = LostPostRead.model_validate(post).model_dump(mode="json")
    item["pet"] = {
        "id": post.pet.id,
        "name": post.pet.name,
        "animal_type": post.pet.animal_type,
        "breed": post.pet.breed,
        "color": post.pet.color,
        "profile_image_url": post.pet.profile_image_url,
        "distinctive_marks": post.pet.distinctive_marks,
    }
    return success(item)


@router.post("", status_code=201)
def create_lost_post(
    payload: LostPostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pet = get_owned_pet(db, current_user, payload.pet_id)
    active = db.scalar(
        select(LostPost).where(LostPost.pet_id == pet.id, LostPost.status == "active")
    )
    if active:
        raise AppError(409, "LOST_POST_ALREADY_ACTIVE", "This pet already has an active lost post")
    post = LostPost(
        pet_id=pet.id,
        owner_id=current_user.id,
        title=f"ตามหา {pet.name}",
        share_token=secrets.token_urlsafe(24),
        **payload.model_dump(exclude={"pet_id"}),
    )
    pet.status = "lost"
    db.add(post)
    db.flush()
    db.add(LostCaseFollower(lost_post_id=post.id, user_id=current_user.id))
    dispatch_lost_alerts(db, post, pet)
    notify_pet_guardians(
        db, pet.id, "guardian_lost_alert", f"{pet.name} ถูกแจ้งหาย 🔴",
        f"เจ้าของได้เปิดเคสตามหา {pet.name} แล้ว", "lost_post", post.id, current_user.id
    )
    db.commit()
    db.refresh(post)
    return success(LostPostRead.model_validate(post).model_dump(mode="json"))


@router.patch("/{post_id}")
def update_lost_post(
    post_id: str,
    payload: LostPostUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = get_lost_post_or_404(db, post_id)
    if post.owner_id != current_user.id:
        raise AppError(403, "AUTH_FORBIDDEN", "Only the owner can edit this lost post")
    if post.status != "active":
        raise AppError(409, "LOST_POST_ALREADY_RESOLVED", "Lost post is not active")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(post, key, value)
    db.commit()
    db.refresh(post)
    return success(LostPostRead.model_validate(post).model_dump(mode="json"))


@router.post("/{post_id}/resolve")
def resolve_lost_post(
    post_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = get_lost_post_or_404(db, post_id)
    if post.owner_id != current_user.id:
        raise AppError(403, "AUTH_FORBIDDEN", "Only the owner can resolve this lost post")
    if post.status != "active":
        raise AppError(409, "LOST_POST_ALREADY_RESOLVED", "Lost post is not active")
    post.status = "resolved"
    post.closed_at = datetime.now(timezone.utc)
    post.pet.status = "normal"
    db.commit()
    db.refresh(post)
    return success(LostPostRead.model_validate(post).model_dump(mode="json"), "Pet marked as found")


@router.post("/{post_id}/cancel")
def cancel_lost_post(
    post_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = get_lost_post_or_404(db, post_id)
    if post.owner_id != current_user.id:
        raise AppError(403, "AUTH_FORBIDDEN", "Only the owner can cancel this lost post")
    if post.status != "active":
        raise AppError(409, "LOST_POST_ALREADY_RESOLVED", "Lost post is not active")
    post.status = "cancelled"
    post.closed_at = datetime.now(timezone.utc)
    post.pet.status = "normal"
    db.commit()
    db.refresh(post)
    return success(LostPostRead.model_validate(post).model_dump(mode="json"))


@router.post("/{post_id}/contact", status_code=201)
def contact_lost_owner(
    post_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = get_lost_post_or_404(db, post_id)
    conversation = find_or_create_conversation(
        db,
        current_user=current_user,
        other_user_id=post.owner_id,
        conv_type="lost_found",
        reference_id=post.id,
    )
    return success(ConversationRead.model_validate(conversation).model_dump(mode="json"))


@router.post("/{post_id}/share-card")
def lost_share_card(
    post_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.services.share_card import generate_share_card

    post = get_lost_post_or_404(db, post_id)
    pet = post.pet
    url = generate_share_card(
        kind="lost",
        title=pet.name if pet else post.title,
        subtitle=f"{(pet.breed or pet.animal_type) if pet else ''} · {(pet.color or '') if pet else ''}".strip(" ·"),
        location=post.location_text or f"{post.latitude:.4f}, {post.longitude:.4f}",
        date_text=post.lost_at.strftime("%d %b %Y"),
        key_suffix=f"lost-{post.id}",
    )
    return success({"url": url, "share_url": f"/lost/{post.share_token}"})
