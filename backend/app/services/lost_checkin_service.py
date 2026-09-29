from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models.features import AppNotification
from app.models.lost_found import CHECKIN_INTERVAL, CHECKIN_RESPONSE_WINDOW, LostPost
from app.services.notification_service import add_notification, notify_lost_followers

logger = logging.getLogger(__name__)

CHECKIN_NOTIFICATION = "lost_checkin"
AUTO_CANCEL_NOTIFICATION = "lost_auto_cancelled"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def close_lost_post(db: Session, post: LostPost, status: str, now: datetime | None = None) -> None:
    now = now or _utcnow()
    post.status = status
    post.closed_at = now
    post.checkin_asked_at = None
    if post.pet is not None and post.pet.status == "lost":
        post.pet.status = "normal"
    clear_checkin_notifications(db, post)
    if status == "resolved":
        name = post.pet.name if post.pet else "น้อง"
        notify_lost_followers(db, post, "lost_resolved", f"{name} เจอแล้ว 🎉", f"เจ้าของแจ้งว่าเจอ {name} แล้ว ขอบคุณที่ช่วยกันตามหา")


def clear_checkin_notifications(db: Session, post: LostPost) -> None:
    db.execute(
        update(AppNotification)
        .where(
            AppNotification.user_id == post.owner_id,
            AppNotification.type == CHECKIN_NOTIFICATION,
            AppNotification.reference_id == post.id,
        )
        .values(is_read=True)
    )


def answer_checkin(db: Session, post: LostPost, found: bool, now: datetime | None = None) -> None:
    now = now or _utcnow()
    if found:
        close_lost_post(db, post, "resolved", now)
        return
    post.checkin_base_at = now
    post.checkin_asked_at = None
    clear_checkin_notifications(db, post)


def run_lost_checkins(db: Session, now: datetime | None = None) -> dict[str, int]:
    now = now or _utcnow()
    asked = 0
    cancelled = 0

    due = db.scalars(
        select(LostPost)
        .where(
            LostPost.status == "active",
            LostPost.checkin_asked_at.is_(None),
            func.coalesce(LostPost.checkin_base_at, LostPost.created_at) <= now - CHECKIN_INTERVAL,
        )
        .with_for_update(skip_locked=True)
    ).all()
    for post in due:
        name = post.pet.name if post.pet else "น้อง"
        post.checkin_asked_at = now
        add_notification(
            db,
            post.owner_id,
            CHECKIN_NOTIFICATION,
            f"เจอ {name} แล้วหรือยัง?",
            f"ประกาศตามหา {name} ครบ 1 สัปดาห์แล้ว กดตอบว่าเจอแล้วหรือยังตามหาอยู่ "
            "ถ้าไม่ตอบภายใน 7 วัน ระบบจะยกเลิกประกาศให้อัตโนมัติ",
            "lost_post",
            post.id,
        )
        asked += 1

    expired = db.scalars(
        select(LostPost)
        .where(
            LostPost.status == "active",
            LostPost.checkin_asked_at.is_not(None),
            LostPost.checkin_asked_at <= now - CHECKIN_RESPONSE_WINDOW,
        )
        .with_for_update(skip_locked=True)
    ).all()
    for post in expired:
        name = post.pet.name if post.pet else "น้อง"
        close_lost_post(db, post, "cancelled", now)
        add_notification(
            db,
            post.owner_id,
            AUTO_CANCEL_NOTIFICATION,
            f"ยกเลิกประกาศตามหา {name} อัตโนมัติ",
            "ไม่มีการตอบกลับภายใน 7 วันหลังแจ้งเตือน ถ้ายังตามหาอยู่ สร้างประกาศใหม่ได้ทุกเมื่อ",
            "lost_post",
            post.id,
        )
        cancelled += 1

    db.commit()
    if asked or cancelled:
        logger.info("Lost check-ins: asked=%s auto_cancelled=%s", asked, cancelled)
    return {"asked": asked, "cancelled": cancelled}
