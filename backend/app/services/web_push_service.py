from __future__ import annotations

import json
import logging
from concurrent.futures import ThreadPoolExecutor

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.features import WebPushSubscription

logger = logging.getLogger(__name__)

_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="webpush")

REFERENCE_PATHS = {
    "lost_post": "/lost/{}",
    "found_post": "/found/{}",
    "pet": "/pets/{}",
    "conversation": "/chat/{}",
}


def web_push_enabled() -> bool:
    return bool(settings.vapid_public_key and settings.vapid_private_key)


def notification_url(data: dict | None) -> str:
    data = data or {}
    template = REFERENCE_PATHS.get(data.get("reference_type") or "")
    ref_id = data.get("reference_id")
    return template.format(ref_id) if template and ref_id else "/notifications"


def _deliver(subscriptions: list[dict], payload: str) -> None:
    from pywebpush import WebPushException, webpush

    expired: list[str] = []
    for sub in subscriptions:
        try:
            webpush(
                subscription_info={"endpoint": sub["endpoint"], "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]}},
                data=payload,
                vapid_private_key=settings.vapid_private_key,
                vapid_claims={"sub": settings.vapid_subject},
                ttl=24 * 60 * 60,
                timeout=10,
            )
        except WebPushException as exc:
            status = getattr(exc.response, "status_code", None)
            if status in (404, 410):
                expired.append(sub["endpoint"])
            else:
                logger.warning("Web push failed (%s) for %s...: %s", status, sub["endpoint"][:40], exc)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Web push error for %s...: %s", sub["endpoint"][:40], exc)

    if expired:
        with SessionLocal() as db:
            db.execute(delete(WebPushSubscription).where(WebPushSubscription.endpoint.in_(expired)))
            db.commit()


def send_web_push_to_user(db: Session, user_id: str, title: str, body: str, data: dict | None = None) -> int:
    if not web_push_enabled():
        return 0
    rows = db.scalars(select(WebPushSubscription).where(WebPushSubscription.user_id == user_id)).all()
    if not rows:
        return 0
    subscriptions = [{"endpoint": r.endpoint, "p256dh": r.p256dh, "auth": r.auth} for r in rows]
    payload = json.dumps(
        {
            "title": title,
            "body": body,
            "url": notification_url(data),
            "tag": f"{(data or {}).get('reference_type') or 'general'}:{(data or {}).get('reference_id') or ''}",
        },
        ensure_ascii=False,
    )
    # Push services can be slow; never hold the API request open for them.
    _executor.submit(_deliver, subscriptions, payload)
    return len(subscriptions)
