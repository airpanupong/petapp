from __future__ import annotations

import json
import logging
from functools import lru_cache

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.features import DeviceToken

logger = logging.getLogger(__name__)


@lru_cache
def _firebase_app():
    creds = (settings.firebase_credentials_json or "").strip()
    if not creds:
        return None
    try:
        import firebase_admin
        from firebase_admin import credentials

        if firebase_admin._apps:
            return firebase_admin.get_app()
        data = json.loads(creds) if creds.startswith("{") else None
        if data is None:
            cred = credentials.Certificate(creds)  # path
        else:
            cred = credentials.Certificate(data)
        return firebase_admin.initialize_app(cred)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Firebase init failed: %s", exc)
        return None


def send_push_to_user(db: Session, user_id: str, title: str, body: str, data: dict | None = None) -> int:
    tokens = db.scalars(
        select(DeviceToken).where(DeviceToken.user_id == user_id, DeviceToken.is_active.is_(True))
    ).all()
    if not tokens:
        return 0

    app = _firebase_app()
    if app is None:
        logger.info("Push skipped (no FIREBASE_CREDENTIALS_JSON): %s — %s", title, user_id)
        return 0

    try:
        from firebase_admin import messaging
    except Exception as exc:  # noqa: BLE001
        logger.warning("firebase_admin messaging unavailable: %s", exc)
        return 0

    sent = 0
    for row in tokens:
        # Skip obvious non-FCM development placeholders
        if row.token.startswith("dev-"):
            continue
        try:
            messaging.send(
                messaging.Message(
                    notification=messaging.Notification(title=title, body=body),
                    data={k: str(v) for k, v in (data or {}).items()},
                    token=row.token,
                )
            )
            sent += 1
        except Exception as exc:  # noqa: BLE001
            logger.warning("FCM send failed for token %s...: %s", row.token[:12], exc)
            # deactivate invalid tokens
            msg = str(exc).lower()
            if "not-registered" in msg or "invalid" in msg:
                row.is_active = False
    return sent
