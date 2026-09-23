from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import AppError
from app.core.responses import success
from app.core.security import hash_password, verify_password, utcnow
from app.models.user import User
from app.schemas.auth import LoginRequest, LogoutRequest, RefreshRequest, RegisterRequest
from app.schemas.user import UserRead
from app.services.auth_service import issue_token_pair, revoke_refresh_token, rotate_refresh_token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    email = payload.email.lower().strip()
    if db.scalar(select(User).where(User.email == email)):
        raise AppError(409, "USER_EMAIL_EXISTS", "Email is already registered")
    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        display_name=payload.display_name.strip(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    tokens = issue_token_pair(db, user)
    return success({"user": UserRead.model_validate(user).model_dump(mode="json"), **tokens})


@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email.lower().strip()))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise AppError(401, "AUTH_INVALID_CREDENTIALS", "Invalid email or password")
    if not user.is_active:
        raise AppError(403, "AUTH_FORBIDDEN", "Account is disabled")
    user.last_login_at = utcnow()
    db.commit()
    tokens = issue_token_pair(db, user)
    return success({"user": UserRead.model_validate(user).model_dump(mode="json"), **tokens})


@router.post("/refresh")
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    user, tokens = rotate_refresh_token(db, payload.refresh_token)
    return success({"user": UserRead.model_validate(user).model_dump(mode="json"), **tokens})


@router.post("/logout")
def logout(payload: LogoutRequest, db: Session = Depends(get_db)):
    revoke_refresh_token(db, payload.refresh_token)
    return success(message="Logged out")
