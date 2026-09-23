from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.exceptions import AppError
from app.core.responses import success
from app.models.lost_found import LostPost, Sighting
from app.models.user import User
from app.schemas.lost_found import SightingCreate, SightingRead
from app.services.notification_service import notify_sighting

router = APIRouter(tags=["sightings"])


@router.get("/lost-posts/{lost_post_id}/sightings")
def list_sightings(lost_post_id: str, db: Session = Depends(get_db)):
    post = db.get(LostPost, lost_post_id)
    if post is None:
        raise AppError(404, "LOST_POST_NOT_FOUND", "Lost post not found")
    rows = db.scalars(
        select(Sighting).where(Sighting.lost_post_id == lost_post_id).order_by(Sighting.seen_at.desc())
    ).all()
    return success([SightingRead.model_validate(x).model_dump(mode="json") for x in rows])


@router.post("/lost-posts/{lost_post_id}/sightings", status_code=201)
def create_sighting(
    lost_post_id: str,
    payload: SightingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = db.get(LostPost, lost_post_id)
    if post is None:
        raise AppError(404, "LOST_POST_NOT_FOUND", "Lost post not found")
    if post.status != "active":
        raise AppError(409, "LOST_POST_ALREADY_RESOLVED", "This lost case is closed")
    row = Sighting(lost_post_id=lost_post_id, reporter_id=current_user.id, **payload.model_dump())
    db.add(row)
    db.flush()
    notify_sighting(db, post, current_user.id)
    db.commit()
    db.refresh(row)
    return success(SightingRead.model_validate(row).model_dump(mode="json"))
