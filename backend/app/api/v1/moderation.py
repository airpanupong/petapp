from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.exceptions import AppError
from app.core.responses import success
from app.models.moderation import Report, UserBlock
from app.models.user import User
from app.schemas.moderation import ReportCreate, ReportRead

router = APIRouter(tags=["moderation"])


def users_are_blocked(db: Session, a: str, b: str) -> bool:
    row = db.scalar(
        select(UserBlock).where(
            or_(
                (UserBlock.blocker_id == a) & (UserBlock.blocked_id == b),
                (UserBlock.blocker_id == b) & (UserBlock.blocked_id == a),
            )
        )
    )
    return row is not None


@router.post("/reports", status_code=201)
def create_report(
    payload: ReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target_type = "post" if payload.target_type in {"lost_post", "found_post", "post"} else payload.target_type
    row = Report(
        reporter_id=current_user.id,
        target_type=target_type,
        target_id=payload.target_id,
        reason=payload.reason,
        details=payload.details,
        status="open",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return success(ReportRead.model_validate(row).model_dump(mode="json"))


@router.post("/users/{user_id}/block", status_code=201)
def block_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if user_id == current_user.id:
        raise AppError(400, "BLOCK_SELF", "Cannot block yourself")
    other = db.get(User, user_id)
    if other is None:
        raise AppError(404, "USER_NOT_FOUND", "User not found")
    existing = db.scalar(
        select(UserBlock).where(UserBlock.blocker_id == current_user.id, UserBlock.blocked_id == user_id)
    )
    if existing is None:
        db.add(UserBlock(blocker_id=current_user.id, blocked_id=user_id))
        db.commit()
    return success({"blocked": True, "user_id": user_id})


@router.delete("/users/{user_id}/block", status_code=204)
def unblock_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.scalar(
        select(UserBlock).where(UserBlock.blocker_id == current_user.id, UserBlock.blocked_id == user_id)
    )
    if row:
        db.delete(row)
        db.commit()
    return None


@router.get("/users/me/blocks")
def list_blocks(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.scalars(select(UserBlock).where(UserBlock.blocker_id == current_user.id)).all()
    return success(
        [{"id": r.id, "blocked_id": r.blocked_id, "created_at": r.created_at.isoformat()} for r in rows]
    )
