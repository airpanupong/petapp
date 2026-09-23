from __future__ import annotations

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import AppError
from app.core.security import decode_token
from app.models.user import User

bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise AppError(401, "AUTH_INVALID_TOKEN", "Authentication required")
    try:
        payload = decode_token(credentials.credentials)
    except jwt.ExpiredSignatureError:
        raise AppError(401, "AUTH_TOKEN_EXPIRED", "Access token expired")
    except jwt.PyJWTError:
        raise AppError(401, "AUTH_INVALID_TOKEN", "Invalid access token")

    if payload.get("type") != "access":
        raise AppError(401, "AUTH_INVALID_TOKEN", "Invalid access token type")

    user = db.get(User, payload.get("sub"))
    if user is None or not user.is_active:
        raise AppError(401, "AUTH_INVALID_TOKEN", "User is unavailable")
    return user


def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User | None:
    if credentials is None:
        return None
    try:
        payload = decode_token(credentials.credentials)
    except jwt.PyJWTError:
        return None
    if payload.get("type") != "access":
        return None
    user = db.get(User, payload.get("sub"))
    return user if user and user.is_active else None
