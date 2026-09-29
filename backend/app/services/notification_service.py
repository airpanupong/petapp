from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.features import AppNotification, LostCaseFollower, NotificationPreference, UserLocation
from app.models.lost_found import FoundPost, LostPost
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


DEFAULT_ALERT_RADIUS_KM = 5.0
FOUND_MATCH_MIN_RADIUS_KM = 5.0


def animal_word(animal_type: str | None) -> str:
    return "แมว" if animal_type == "cat" else "สุนัข" if animal_type == "dog" else "สัตว์"


def nearby_alert_recipients(
    db: Session,
    latitude: float,
    longitude: float,
    animal_type: str,
    max_radius_km: float | None = None,
    exclude_user_ids: set[str] | None = None,
) -> list[tuple[str, float]]:
    """Users whose last known location is within their alert radius.

    Users who never saved preferences still get alerts with the default settings.
    """
    rows = db.execute(
        select(UserLocation, NotificationPreference).outerjoin(
            NotificationPreference, NotificationPreference.user_id == UserLocation.user_id
        )
    ).all()
    exclude = exclude_user_ids or set()
    matches: list[tuple[str, float]] = []
    for location, prefs in rows:
        if location.user_id in exclude:
            continue
        if prefs is not None and not prefs.lost_alerts:
            continue
        wanted = prefs.animal_type if prefs is not None else "all"
        if wanted not in {"all", animal_type}:
            continue
        radius = float(prefs.radius_km) if prefs is not None else DEFAULT_ALERT_RADIUS_KM
        if max_radius_km is not None:
            radius = min(radius, float(max_radius_km))
        distance = haversine_km(location.latitude, location.longitude, latitude, longitude)
        if distance <= radius:
            matches.append((location.user_id, distance))
    return matches


def dispatch_lost_alerts(db: Session, post: LostPost, pet: Pet) -> int:
    recipients = nearby_alert_recipients(
        db, post.latitude, post.longitude, pet.animal_type, post.search_radius_km, {post.owner_id}
    )
    for user_id, distance in recipients:
        add_notification(
            db,
            user_id,
            "lost_pet_alert",
            f"มี{animal_word(pet.animal_type)}หายใกล้คุณ",
            f"{pet.name} หายห่างจากตำแหน่งล่าสุดของคุณประมาณ {distance:.1f} กม.",
            "lost_post",
            post.id,
        )
    return len(recipients)


def dispatch_found_alerts(db: Session, post: FoundPost) -> int:
    """Tell owners of matching lost pets nearby first, then everyone else nearby."""
    notified: set[str] = set()
    if post.reporter_id:
        notified.add(post.reporter_id)
    animal = animal_word(post.animal_type)

    lost_rows = db.execute(
        select(LostPost, Pet).join(Pet, Pet.id == LostPost.pet_id).where(LostPost.status == "active")
    ).all()
    for lost, pet in lost_rows:
        if lost.owner_id in notified:
            continue
        if post.animal_type != "other" and pet.animal_type != post.animal_type:
            continue
        distance = haversine_km(lost.latitude, lost.longitude, post.latitude, post.longitude)
        if distance > max(float(lost.search_radius_km), FOUND_MATCH_MIN_RADIUS_KM):
            continue
        add_notification(
            db,
            lost.owner_id,
            "found_match_alert",
            f"มีคนพบ{animal}ใกล้จุดที่ {pet.name} หาย",
            f"ห่างจากจุดที่ {pet.name} หายประมาณ {distance:.1f} กม. กดดูว่าใช่น้องหรือเปล่า",
            "found_post",
            post.id,
        )
        notified.add(lost.owner_id)

    for user_id, distance in nearby_alert_recipients(db, post.latitude, post.longitude, post.animal_type, exclude_user_ids=notified):
        add_notification(
            db,
            user_id,
            "found_pet_alert",
            f"มีคนพบ{animal}ใกล้คุณ",
            f"ห่างจากคุณประมาณ {distance:.1f} กม. ช่วยดูหน่อยว่าเป็นน้องของใครแถวบ้านหรือเปล่า",
            "found_post",
            post.id,
        )
        notified.add(user_id)
    return len(notified) - (1 if post.reporter_id else 0)


def notify_lost_followers(db: Session, post: LostPost, type_: str, title: str, body: str) -> int:
    followers = db.scalars(select(LostCaseFollower).where(LostCaseFollower.lost_post_id == post.id)).all()
    count = 0
    for follower in followers:
        if follower.user_id == post.owner_id:
            continue
        add_notification(db, follower.user_id, type_, title, body, "lost_post", post.id)
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
