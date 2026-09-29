"""Ensure the configured super admin account exists. Safe to run on every deploy."""

from __future__ import annotations

from sqlalchemy import select

import app.models  # noqa: F401  (register all mappers)
from app.core.config import settings
from app.core.database import SessionLocal
from app.core.roles import SUPER_ADMIN
from app.core.security import hash_password
from app.models.user import User


def ensure_super_admin() -> None:
    email = settings.super_admin_email.lower().strip()
    if not email:
        return
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            if not settings.super_admin_password:
                print(f"[bootstrap] {email} not found and SUPER_ADMIN_PASSWORD unset; skipping")
                return
            user = User(
                email=email,
                password_hash=hash_password(settings.super_admin_password),
                display_name="Pet haii Support",
                status="active",
                role=SUPER_ADMIN,
                is_active=True,
            )
            db.add(user)
            db.commit()
            print(f"[bootstrap] created super admin {email}")
            return
        if user.role != SUPER_ADMIN or not user.is_active:
            user.role = SUPER_ADMIN
            user.is_active = True
            user.status = "active"
            db.commit()
            print(f"[bootstrap] promoted {email} to super admin")


if __name__ == "__main__":
    ensure_super_admin()
