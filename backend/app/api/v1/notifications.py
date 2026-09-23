from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.exceptions import AppError
from app.core.responses import success
from app.models.features import AppNotification, DeviceToken, LostCaseFollower, NotificationPreference, UserLocation
from app.models.lost_found import LostPost
from app.models.user import User
from app.schemas.features import DeviceTokenCreate, DeviceTokenRead, NotificationPreferenceRead, NotificationPreferenceUpdate, NotificationRead, UserLocationUpdate

router = APIRouter(tags=["notifications"])


def get_or_create_prefs(db: Session, user_id: str) -> NotificationPreference:
    row = db.scalar(select(NotificationPreference).where(NotificationPreference.user_id == user_id))
    if row is None:
        row = NotificationPreference(user_id=user_id)
        db.add(row); db.flush()
    return row


@router.get("/notifications")
def list_notifications(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.scalars(select(AppNotification).where(AppNotification.user_id == current_user.id).order_by(AppNotification.created_at.desc()).limit(100)).all()
    return success([NotificationRead.model_validate(x).model_dump(mode="json") for x in rows])


@router.post("/notifications/{notification_id}/read")
def mark_read(notification_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = db.scalar(select(AppNotification).where(AppNotification.id == notification_id, AppNotification.user_id == current_user.id))
    if row is None:
        raise AppError(404, "NOTIFICATION_NOT_FOUND", "Notification not found")
    row.is_read = True; db.commit(); db.refresh(row)
    return success(NotificationRead.model_validate(row).model_dump(mode="json"))


@router.post("/notifications/read-all")
def mark_all_read(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.scalars(select(AppNotification).where(AppNotification.user_id == current_user.id, AppNotification.is_read.is_(False))).all()
    for row in rows:
        row.is_read = True
    db.commit()
    return success({"updated": len(rows)})


@router.get("/notification-preferences")
def get_preferences(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = get_or_create_prefs(db, current_user.id); db.commit(); db.refresh(row)
    return success(NotificationPreferenceRead.model_validate(row).model_dump(mode="json"))


@router.put("/notification-preferences")
def update_preferences(payload: NotificationPreferenceUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = get_or_create_prefs(db, current_user.id)
    for key, value in payload.model_dump().items():
        setattr(row, key, value)
    db.commit(); db.refresh(row)
    return success(NotificationPreferenceRead.model_validate(row).model_dump(mode="json"))


@router.put("/me/location")
def update_location(payload: UserLocationUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = db.scalar(select(UserLocation).where(UserLocation.user_id == current_user.id))
    if row is None:
        row = UserLocation(user_id=current_user.id, **payload.model_dump()); db.add(row)
    else:
        row.latitude = payload.latitude; row.longitude = payload.longitude
    db.commit(); db.refresh(row)
    return success({"latitude": row.latitude, "longitude": row.longitude, "updated_at": row.updated_at.isoformat()})


@router.post("/lost-posts/{post_id}/follow", status_code=201)
def follow_case(post_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    post = db.get(LostPost, post_id)
    if post is None:
        raise AppError(404, "LOST_POST_NOT_FOUND", "Lost post not found")
    existing = db.scalar(select(LostCaseFollower).where(LostCaseFollower.lost_post_id == post_id, LostCaseFollower.user_id == current_user.id))
    if existing is None:
        existing = LostCaseFollower(lost_post_id=post_id, user_id=current_user.id); db.add(existing); db.commit(); db.refresh(existing)
    return success({"following": True})


@router.delete("/lost-posts/{post_id}/follow", status_code=204)
def unfollow_case(post_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = db.scalar(select(LostCaseFollower).where(LostCaseFollower.lost_post_id == post_id, LostCaseFollower.user_id == current_user.id))
    if row: db.delete(row); db.commit()
    return None


@router.get("/lost-posts/{post_id}/follow")
def follow_status(post_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = db.scalar(select(LostCaseFollower).where(LostCaseFollower.lost_post_id == post_id, LostCaseFollower.user_id == current_user.id))
    return success({"following": row is not None})


@router.post("/devices", status_code=201)
def register_device(payload: DeviceTokenCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = db.scalar(select(DeviceToken).where(DeviceToken.platform == payload.platform, DeviceToken.token == payload.token))
    if row is None:
        row = DeviceToken(user_id=current_user.id, **payload.model_dump()); db.add(row)
    else:
        row.user_id = current_user.id; row.device_id = payload.device_id; row.is_active = True
    db.commit(); db.refresh(row)
    return success(DeviceTokenRead.model_validate(row).model_dump(mode="json"))
