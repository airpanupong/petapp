from __future__ import annotations

import secrets

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_optional_user
from app.core.database import get_db
from app.core.exceptions import AppError
from app.core.responses import success
from app.core.roles import PRIVATE_POST_STATUSES, is_staff
from app.models.lost_found import FoundPost, photo_columns, photo_update
from app.models.user import User
from app.schemas.community import ConversationRead
from app.schemas.lost_found import FoundPostCreate, FoundPostRead, FoundPostUpdate
from app.services.chat_service import find_or_create_conversation
from app.services.notification_service import dispatch_found_alerts

router = APIRouter(prefix="/found-posts", tags=["found-posts"])


def get_visible_found_post_or_404(db: Session, post_id: str, viewer: User | None) -> FoundPost:
    post = db.get(FoundPost, post_id)
    if post is None or (
        post.status in PRIVATE_POST_STATUSES
        and not (viewer and (viewer.id == post.reporter_id or is_staff(viewer.role)))
    ):
        raise AppError(404, "FOUND_POST_NOT_FOUND", "Found post not found")
    return post


@router.get("")
def list_found_posts(
    status: str = "active",
    animal_type: str | None = None,
    db: Session = Depends(get_db),
):
    if status in PRIVATE_POST_STATUSES:
        return success([])
    stmt = select(FoundPost).where(FoundPost.status == status)
    if animal_type:
        stmt = stmt.where(FoundPost.animal_type == animal_type)
    posts = db.scalars(stmt.order_by(FoundPost.created_at.desc()).limit(100)).all()
    return success([FoundPostRead.model_validate(x).model_dump(mode="json") for x in posts])


@router.get("/{post_id}")
def get_found_post(
    post_id: str,
    db: Session = Depends(get_db),
    viewer: User | None = Depends(get_optional_user),
):
    post = get_visible_found_post_or_404(db, post_id, viewer)
    return success(FoundPostRead.model_validate(post).model_dump(mode="json"))


@router.post("", status_code=201)
def create_found_post(
    payload: FoundPostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = FoundPost(
        reporter_id=current_user.id,
        share_token=secrets.token_urlsafe(24),
        **payload.model_dump(exclude={"image_url", "image_urls"}),
        **photo_columns([*payload.image_urls, payload.image_url]),
    )
    db.add(post)
    db.flush()
    dispatch_found_alerts(db, post)
    db.commit()
    db.refresh(post)
    return success(FoundPostRead.model_validate(post).model_dump(mode="json"))


@router.patch("/{post_id}")
def update_found_post(
    post_id: str,
    payload: FoundPostUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = db.get(FoundPost, post_id)
    if post is None:
        raise AppError(404, "FOUND_POST_NOT_FOUND", "Found post not found")
    if post.reporter_id != current_user.id:
        raise AppError(403, "AUTH_FORBIDDEN", "Only the reporter can edit this post")
    if post.status != "active":
        raise AppError(409, "FOUND_POST_NOT_ACTIVE", "Found post is not active")
    fields = payload.model_dump(exclude_unset=True)
    fields.update(photo_update(fields))
    for key, value in fields.items():
        if key in {"animal_type", "found_at", "latitude", "longitude"} and value is None:
            continue
        setattr(post, key, value)
    db.commit()
    db.refresh(post)
    return success(FoundPostRead.model_validate(post).model_dump(mode="json"))


def _close_found_post(db: Session, post_id: str, current_user: User, status: str):
    post = db.get(FoundPost, post_id)
    if post is None:
        raise AppError(404, "FOUND_POST_NOT_FOUND", "Found post not found")
    if post.reporter_id != current_user.id:
        raise AppError(403, "AUTH_FORBIDDEN", "Only the reporter can close this post")
    if post.status != "active":
        raise AppError(409, "FOUND_POST_NOT_ACTIVE", "Found post is not active")
    post.status = status
    db.commit()
    db.refresh(post)
    return success(FoundPostRead.model_validate(post).model_dump(mode="json"))


@router.post("/{post_id}/resolve")
def resolve_found_post(
    post_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _close_found_post(db, post_id, current_user, "resolved")


@router.post("/{post_id}/cancel")
def cancel_found_post(
    post_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _close_found_post(db, post_id, current_user, "cancelled")


@router.post("/{post_id}/contact", status_code=201)
def contact_found_reporter(
    post_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = get_visible_found_post_or_404(db, post_id, current_user)
    if not post.reporter_id:
        raise AppError(404, "REPORTER_NOT_FOUND", "Reporter is not available")
    conversation = find_or_create_conversation(
        db,
        current_user=current_user,
        other_user_id=post.reporter_id,
        conv_type="lost_found",
        reference_id=post.id,
    )
    return success(ConversationRead.model_validate(conversation).model_dump(mode="json"))


@router.post("/{post_id}/share-card")
def found_share_card(
    post_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.services.share_card import generate_share_card

    post = db.get(FoundPost, post_id)
    if post is None:
        raise AppError(404, "FOUND_POST_NOT_FOUND", "Found post not found")
    animal = "Dog" if post.animal_type == "dog" else "Cat" if post.animal_type == "cat" else "Pet"
    url = generate_share_card(
        kind="found",
        title=f"Found {animal}",
        subtitle=" · ".join(x for x in [post.breed_guess, post.color] if x) or "Awaiting owner",
        location=post.location_text or f"{post.latitude:.4f}, {post.longitude:.4f}",
        date_text=post.found_at.strftime("%d %b %Y"),
        key_suffix=f"found-{post.id}",
    )
    return success({"url": url, "share_url": f"/found/{post.share_token}"})
