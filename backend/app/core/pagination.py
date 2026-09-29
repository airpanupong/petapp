from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.core.exceptions import AppError


def as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def make_cursor(at: datetime, item_id: str) -> str:
    return f"{as_utc(at).isoformat()}|{item_id}"


def parse_cursor(cursor: str | None) -> tuple[datetime, str] | None:
    """Cursors look like "<ISO timestamp>|<id>": the last item of the previous page."""
    if not cursor:
        return None
    at, sep, item_id = cursor.rpartition("|")
    try:
        if not sep or not item_id:
            raise ValueError
        return as_utc(datetime.fromisoformat(at.replace("Z", "+00:00"))), item_id
    except ValueError:
        raise AppError(400, "INVALID_CURSOR", "Invalid pagination cursor") from None


def older_than(db: Session, model, at_col, cursor: str | None):
    """SQL filter for rows after the cursor in newest-first order, or None without a cursor."""
    parsed = parse_cursor(cursor)
    if parsed is None:
        return None
    at, item_id = parsed
    if db.scalar(select(model.id).where(model.id == item_id)) is None:
        return at_col < at
    # Compare against the stored value rather than the parsed one; SQLite keeps
    # server-default timestamps as strings that do not round-trip exactly.
    ref = select(at_col).where(model.id == item_id).scalar_subquery()
    return or_(at_col < ref, and_(at_col == ref, model.id < item_id))


def is_older(at: datetime, item_id: str, cursor: tuple[datetime, str] | None) -> bool:
    return cursor is None or (as_utc(at), item_id) < cursor
