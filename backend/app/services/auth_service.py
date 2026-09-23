from __future__ import annotations

from datetime import datetime, timezone

import jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    token_digest,
    utcnow,
)
from app.models.user import RefreshToken, User


def issue_token_pair(db: Session, user: User) -> dict:
    access_token, _, _ = create_access_token(user.id)
    refresh_token, refresh_jti, refresh_expires = create_refresh_token(user.id)
    db.add(
        RefreshToken(
            user_id=user.id,
            jti=refresh_jti,
            token_hash=token_digest(refresh_token),
            expires_at=refresh_expires,
        )
    )
    db.commit()
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


def rotate_refresh_token(db: Session, raw_token: str) -> tuple[User, dict]:
    try:
        payload = decode_token(raw_token)
    except jwt.ExpiredSignatureError:
        raise AppError(401, "AUTH_TOKEN_EXPIRED", "Refresh token expired")
    except jwt.PyJWTError:
        raise AppError(401, "AUTH_INVALID_TOKEN", "Invalid refresh token")

    if payload.get("type") != "refresh":
        raise AppError(401, "AUTH_INVALID_TOKEN", "Invalid refresh token type")

    token_row = db.scalar(
        select(RefreshToken).where(
            RefreshToken.jti == payload.get("jti"),
            RefreshToken.token_hash == token_digest(raw_token),
        )
    )
    if token_row is None or token_row.revoked_at is not None:
        raise AppError(401, "AUTH_INVALID_TOKEN", "Refresh token has been revoked")

    expires_at = token_row.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= utcnow():
        raise AppError(401, "AUTH_TOKEN_EXPIRED", "Refresh token expired")

    user = db.get(User, payload.get("sub"))
    if user is None or not user.is_active:
        raise AppError(401, "AUTH_INVALID_TOKEN", "User is unavailable")

    token_row.revoked_at = utcnow()
    db.commit()
    return user, issue_token_pair(db, user)


def revoke_refresh_token(db: Session, raw_token: str) -> None:
    try:
        payload = decode_token(raw_token)
    except jwt.PyJWTError:
        return
    token_row = db.scalar(
        select(RefreshToken).where(
            RefreshToken.jti == payload.get("jti"),
            RefreshToken.token_hash == token_digest(raw_token),
        )
    )
    if token_row and token_row.revoked_at is None:
        token_row.revoked_at = utcnow()
        db.commit()
