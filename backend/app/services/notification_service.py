from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.features import AppNotification, LostCaseFollower, NotificationPreference, UserLocation
from app.models.lost_found import LostPost
from app.models.pet import Pet, PetGuardian
from app.services.push_service import send_push_to_user
from app.utils.geo import haversine_km


def add_notification(
    db: Session,
    user_id: str,
    type_: str,
    title: str,
    body: str,
    reference_type: str | None = None,
    reference_id: str | None = None,
) -> AppNotification:
    row = AppNotification(
        user_id=user_id,
        type=type_,
        title=title,
        body=body,
        reference_type=reference_type,
        reference_id=reference_id,
    )
    db.add(row)
    db.flush()
    try:
        send_push_to_user(
            db,
            user_id,
            title,
            body,
            {"type": type_, "reference_type": reference_type or "", "reference_id": reference_id or ""},
        )
    except Exception:  # noqa: BLE001
        pass
    return row


def notify_pet_guardians(db: Session, pet_id: str, type_: str, title: str, body: str, reference_type: str | None = None, reference_id: str | None = None, exclude_user_id: str | None = None) -> int:
    guardians = db.scalars(
        select(PetGuardian).where(
            PetGuardian.pet_id == pet_id,
            PetGuardian.can_receive_notifications.is_(True),
        )
    ).all()
    count = 0
    for guardian in guardians:
        if guardian.user_id == exclude_user_id:
            continue
        add_notification(db, guardian.user_id, type_, title, body, reference_type, reference_id)
        count += 1
    return count


def dispatch_lost_alerts(db: Session, post: LostPost, pet: Pet) -> int:
    rows = db.execute(
        select(UserLocation, NotificationPreference)
        .join(NotificationPreference, NotificationPreference.user_id == UserLocation.user_id)
        .where(NotificationPreference.lost_alerts.is_(True))
    ).all()
    count = 0
    for location, prefs in rows:
        if location.user_id == post.owner_id:
            continue
        if prefs.animal_type not in {"all", pet.animal_type}:
            continue
        distance = haversine_km(location.latitude, location.longitude, post.latitude, post.longitude)
        effective_radius = min(float(prefs.radius_km), float(post.search_radius_km))
        if distance <= effective_radius:
            add_notification(
                db,
                location.user_id,
                "lost_pet_alert",
                f"มี{('แมว' if pet.animal_type == 'cat' else 'สุนัข' if pet.animal_type == 'dog' else 'สัตว์')}หายใกล้คุณ",
                f"{pet.name} หายห่างจากตำแหน่งล่าสุดของคุณประมาณ {distance:.1f} กม.",
                "lost_post",
                post.id,
            )
            count += 1
    return count


def notify_sighting(db: Session, post: LostPost, reporter_id: str | None) -> int:
    recipients = {post.owner_id}
    followers = db.scalars(select(LostCaseFollower).where(LostCaseFollower.lost_post_id == post.id)).all()
    recipients.update(x.user_id for x in followers)
    guardians = db.scalars(
        select(PetGuardian).where(
            PetGuardian.pet_id == post.pet_id, PetGuardian.can_receive_notifications.is_(True)
        )
    ).all()
    recipients.update(x.user_id for x in guardians)
    if reporter_id:
        recipients.discard(reporter_id)
    for user_id in recipients:
        add_notification(
            db,
            user_id,
            "new_sighting",
            "มีเบาะแสใหม่ 👀",
            "มีผู้ใช้แจ้งจุดที่พบเห็นในเคสสัตว์หายที่คุณติดตาม",
            "lost_post",
            post.id,
        )
    return len(recipients)
