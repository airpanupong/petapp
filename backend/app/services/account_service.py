from __future__ import annotations

from pathlib import Path

from sqlalchemy import delete, or_, select, update
from sqlalchemy.orm import Session

from app.models import (
    Ad,
    AdEvent,
    AppNotification,
    Conversation,
    ConversationMember,
    DeviceToken,
    FoundPost,
    LostCaseFollower,
    LostPost,
    Message,
    NotificationPreference,
    OwnershipVerification,
    PasswordResetCode,
    Pet,
    PetEmergencyInfo,
    PetGuardian,
    PetHealthProfile,
    PetImage,
    RefreshToken,
    Report,
    Sighting,
    User,
    UserBlock,
    UserLocation,
    Vaccination,
    WebPushSubscription,
)
from app.services.storage import LOCAL_UPLOAD_DIR, get_storage


def _photos(rows) -> list[str]:
    urls: list[str] = []
    for row in rows:
        urls.extend(u for u in [row.image_url, *(row.image_urls or [])] if u)
    return urls


def _delete_pets(db: Session, pet_ids: list[str]) -> None:
    for model in (PetHealthProfile, Vaccination, PetEmergencyInfo, OwnershipVerification, PetImage, PetGuardian):
        db.execute(delete(model).where(model.pet_id.in_(pet_ids)))
    db.execute(delete(Pet).where(Pet.id.in_(pet_ids)))


def delete_account(db: Session, user: User) -> None:
    """Permanently removes the user with their pets, posts, chats and uploaded photos.

    Conversations are removed for both members: a chat with one side erased is meaningless and still exposes
    the deleted user's messages.
    """
    uid = user.id
    pets = db.scalars(select(Pet).where(Pet.owner_id == uid)).all()
    pet_ids = [p.id for p in pets]
    lost = db.scalars(select(LostPost).where(or_(LostPost.owner_id == uid, LostPost.pet_id.in_(pet_ids)))).all()
    lost_ids = [p.id for p in lost]
    found = db.scalars(select(FoundPost).where(FoundPost.reporter_id == uid)).all()
    found_ids = [p.id for p in found]
    sightings = db.scalars(
        select(Sighting).where(or_(Sighting.reporter_id == uid, Sighting.lost_post_id.in_(lost_ids)))
    ).all()
    conv_ids = list(db.scalars(select(ConversationMember.conversation_id).where(ConversationMember.user_id == uid)))

    files = [user.avatar_url, *(p.profile_image_url for p in pets)]
    files += db.scalars(select(PetImage.image_url).where(PetImage.pet_id.in_(pet_ids))).all()
    files += db.scalars(
        select(OwnershipVerification.evidence_url).where(
            or_(OwnershipVerification.owner_id == uid, OwnershipVerification.pet_id.in_(pet_ids))
        )
    ).all()
    files += db.scalars(select(Message.image_url).where(Message.conversation_id.in_(conv_ids))).all()
    files += _photos(lost) + _photos(found) + _photos(sightings)

    references = pet_ids + lost_ids + found_ids + conv_ids
    db.execute(
        delete(AppNotification).where(or_(AppNotification.user_id == uid, AppNotification.reference_id.in_(references)))
    )
    db.execute(delete(Message).where(Message.conversation_id.in_(conv_ids)))
    db.execute(delete(ConversationMember).where(ConversationMember.conversation_id.in_(conv_ids)))
    db.execute(delete(Conversation).where(Conversation.id.in_(conv_ids)))
    db.execute(delete(Sighting).where(Sighting.id.in_([s.id for s in sightings])))
    db.execute(
        delete(LostCaseFollower).where(
            or_(LostCaseFollower.user_id == uid, LostCaseFollower.lost_post_id.in_(lost_ids))
        )
    )
    db.execute(delete(LostPost).where(LostPost.id.in_(lost_ids)))
    db.execute(delete(FoundPost).where(FoundPost.id.in_(found_ids)))
    db.execute(delete(OwnershipVerification).where(OwnershipVerification.owner_id == uid))
    db.execute(delete(PetGuardian).where(PetGuardian.user_id == uid))
    _delete_pets(db, pet_ids)
    for model in (RefreshToken, PasswordResetCode, NotificationPreference, UserLocation, DeviceToken, WebPushSubscription):
        db.execute(delete(model).where(model.user_id == uid))
    db.execute(delete(Report).where(Report.reporter_id == uid))
    db.execute(update(Report).where(Report.resolver_id == uid).values(resolver_id=None))
    db.execute(delete(UserBlock).where(or_(UserBlock.blocker_id == uid, UserBlock.blocked_id == uid)))
    db.execute(update(AdEvent).where(AdEvent.user_id == uid).values(user_id=None))
    db.execute(delete(User).where(User.id == uid))
    db.commit()
    db.expunge_all()

    storage = get_storage()
    for url in dict.fromkeys(u for u in files if u):
        storage.delete_url(url)


def wipe_content(db: Session) -> dict[str, int]:
    """Clears every pet, post, chat, notification and upload but keeps accounts, their settings and ads."""
    counts: dict[str, int] = {}
    for model in (
        AppNotification, Message, ConversationMember, Conversation, Sighting, LostCaseFollower, LostPost, FoundPost,
        PetHealthProfile, Vaccination, PetEmergencyInfo, OwnershipVerification, PetImage, PetGuardian, Pet,
        Report, AdEvent, PasswordResetCode,
    ):
        counts[model.__tablename__] = db.execute(delete(model)).rowcount or 0
    db.commit()

    keep = {Path(u).name for u in db.scalars(select(User.avatar_url)).all() if u}
    keep |= {Path(u).name for u in db.scalars(select(Ad.image_url)).all() if u}
    removed = 0
    if LOCAL_UPLOAD_DIR.is_dir():
        for path in LOCAL_UPLOAD_DIR.iterdir():
            if path.is_file() and path.name not in keep:
                path.unlink(missing_ok=True)
                removed += 1
    counts["upload_files"] = removed
    return counts
