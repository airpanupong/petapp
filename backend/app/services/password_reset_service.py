from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from html import escape

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import AppError
from app.core.security import hash_password, utcnow
from app.models.user import PasswordResetCode, RefreshToken, User
from app.services.email_service import send_email

CODE_TTL = timedelta(minutes=10)
RESEND_COOLDOWN = timedelta(seconds=60)
MAX_CODES_PER_HOUR = 5
MAX_ATTEMPTS = 5


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _digest(user_id: str, code: str) -> str:
    return hmac.new(settings.secret_key.encode(), f"{user_id}:{code}".encode(), hashlib.sha256).hexdigest()


def _user_by_email(db: Session, email: str) -> User:
    user = db.scalar(select(User).where(User.email == email.lower().strip()))
    if user is None:
        raise AppError(404, "EMAIL_NOT_FOUND", "Email is not registered")
    if not user.is_active:
        raise AppError(403, "AUTH_FORBIDDEN", "Account is disabled")
    return user


def _reset_email(user: User, code: str) -> tuple[str, str, str]:
    minutes = int(CODE_TTL.total_seconds() // 60)
    subject = f"รหัสยืนยันรีเซ็ตรหัสผ่าน Pet haii: {code}"
    text = (
        f"สวัสดี {user.display_name}\n\n"
        f"รหัสยืนยันสำหรับตั้งรหัสผ่านใหม่ของคุณคือ {code}\n"
        f"รหัสนี้ใช้ได้ {minutes} นาที\n\n"
        "ถ้าคุณไม่ได้ขอรีเซ็ตรหัสผ่าน ไม่ต้องทำอะไร บัญชีของคุณยังปลอดภัย\n\n"
        "Pet haii · พาน้องกลับบ้าน\nhttps://pethaii.com"
    )
    html = f"""\
<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#4b3a36">
  <h2 style="color:#e0566f;margin:0 0 12px">Pet haii</h2>
  <p>สวัสดี {escape(user.display_name)}</p>
  <p>รหัสยืนยันสำหรับตั้งรหัสผ่านใหม่ของคุณคือ</p>
  <p style="font-size:32px;font-weight:bold;letter-spacing:8px;background:#fff4ec;border-radius:12px;padding:16px;text-align:center">{code}</p>
  <p>รหัสนี้ใช้ได้ {minutes} นาที</p>
  <p style="color:#9a8580;font-size:13px">ถ้าคุณไม่ได้ขอรีเซ็ตรหัสผ่าน ไม่ต้องทำอะไร บัญชีของคุณยังปลอดภัย</p>
  <p style="color:#9a8580;font-size:13px">Pet haii · พาน้องกลับบ้าน · <a href="https://pethaii.com">pethaii.com</a></p>
</div>"""
    return subject, text, html


def request_reset_code(db: Session, email: str) -> dict:
    user = _user_by_email(db, email)
    now = utcnow()

    recent = db.scalars(
        select(PasswordResetCode.created_at).where(
            PasswordResetCode.user_id == user.id,
            PasswordResetCode.created_at >= now - timedelta(hours=1),
        )
    ).all()
    if recent:
        wait = RESEND_COOLDOWN - (now - _aware(max(recent)))
        if wait.total_seconds() > 0:
            raise AppError(429, "RESET_COOLDOWN", "Please wait before requesting a new code", {"retry_after": int(wait.total_seconds()) + 1})
    if len(recent) >= MAX_CODES_PER_HOUR:
        raise AppError(429, "RESET_TOO_MANY", "Too many code requests. Try again later")

    db.execute(
        update(PasswordResetCode)
        .where(PasswordResetCode.user_id == user.id, PasswordResetCode.consumed_at.is_(None))
        .values(consumed_at=now)
    )
    code = f"{secrets.randbelow(1_000_000):06d}"
    row = PasswordResetCode(user_id=user.id, code_hash=_digest(user.id, code), expires_at=now + CODE_TTL, created_at=now)
    db.add(row)
    db.flush()

    try:
        send_email(user.email, *_reset_email(user, code))
    except AppError:
        db.rollback()
        raise
    db.commit()
    return {"sent": True, "expires_in": int(CODE_TTL.total_seconds()), "resend_in": int(RESEND_COOLDOWN.total_seconds())}


def _check_code(db: Session, user: User, code: str) -> PasswordResetCode:
    row = db.scalar(
        select(PasswordResetCode)
        .where(PasswordResetCode.user_id == user.id, PasswordResetCode.consumed_at.is_(None))
        .order_by(PasswordResetCode.created_at.desc())
    )
    if row is None or _aware(row.expires_at) <= utcnow():
        raise AppError(400, "RESET_CODE_EXPIRED", "Code expired. Request a new one")
    if row.attempts >= MAX_ATTEMPTS:
        raise AppError(400, "RESET_CODE_LOCKED", "Too many attempts. Request a new code")
    if not hmac.compare_digest(row.code_hash, _digest(user.id, code.strip())):
        row.attempts += 1
        db.commit()
        if row.attempts >= MAX_ATTEMPTS:
            raise AppError(400, "RESET_CODE_LOCKED", "Too many attempts. Request a new code")
        raise AppError(400, "RESET_CODE_INVALID", "Invalid code")
    return row


def verify_reset_code(db: Session, email: str, code: str) -> None:
    _check_code(db, _user_by_email(db, email), code)


def reset_password(db: Session, email: str, code: str, new_password: str) -> User:
    user = _user_by_email(db, email)
    row = _check_code(db, user, code)
    now = utcnow()
    row.consumed_at = now
    user.password_hash = hash_password(new_password)
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )
    db.commit()
    return user

