from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.exceptions import AppError
from app.core.responses import success
from app.models.features import OwnershipVerification
from app.models.lost_found import FoundPost, LostPost
from app.models.moderation import Report
from app.models.user import User
from app.schemas.features import OwnershipReview, OwnershipVerificationRead
from app.schemas.lost_found import FoundPostRead, LostPostRead
from app.schemas.moderation import ReportRead, ReportResolve
from app.schemas.user import UserRead

router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise AppError(403, "AUTH_FORBIDDEN", "Admin role required")
    return user


@router.get("/metrics")
def metrics(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return success(
        {
            "users": db.scalar(select(func.count()).select_from(User)) or 0,
            "lost_active": db.scalar(select(func.count()).select_from(LostPost).where(LostPost.status == "active")) or 0,
            "found_active": db.scalar(select(func.count()).select_from(FoundPost).where(FoundPost.status == "active"))
            or 0,
            "reports_open": db.scalar(select(func.count()).select_from(Report).where(Report.status == "open")) or 0,
            "ownership_pending": db.scalar(
                select(func.count()).select_from(OwnershipVerification).where(OwnershipVerification.status == "pending")
            )
            or 0,
        }
    )


@router.get("/users")
def list_users(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    rows = db.scalars(select(User).order_by(User.created_at.desc()).limit(200)).all()
    return success([UserRead.model_validate(x).model_dump(mode="json") for x in rows])


@router.post("/users/{user_id}/suspend")
def suspend_user(user_id: str, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    user = db.get(User, user_id)
    if user is None:
        raise AppError(404, "USER_NOT_FOUND", "User not found")
    user.is_active = False
    user.status = "suspended"
    db.commit()
    return success(UserRead.model_validate(user).model_dump(mode="json"))


@router.get("/ownership-verifications")
def list_ownership(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    rows = db.scalars(select(OwnershipVerification).order_by(OwnershipVerification.submitted_at.desc()).limit(200)).all()
    return success([OwnershipVerificationRead.model_validate(x).model_dump(mode="json") for x in rows])


@router.post("/ownership-verifications/{verification_id}/review")
def review_ownership(
    verification_id: str,
    payload: OwnershipReview,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    row = db.get(OwnershipVerification, verification_id)
    if row is None:
        raise AppError(404, "VERIFICATION_NOT_FOUND", "Verification not found")
    row.status = payload.status
    row.reviewer_note = payload.reviewer_note
    row.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    return success(OwnershipVerificationRead.model_validate(row).model_dump(mode="json"))


@router.get("/reports")
def list_reports(
    status: str | None = Query(default="open"),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    stmt = select(Report).order_by(Report.created_at.desc()).limit(200)
    if status:
        stmt = stmt.where(Report.status == status)
    rows = db.scalars(stmt).all()
    return success([ReportRead.model_validate(x).model_dump(mode="json") for x in rows])


@router.post("/reports/{report_id}/resolve")
def resolve_report(
    report_id: str,
    payload: ReportResolve,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    row = db.get(Report, report_id)
    if row is None:
        raise AppError(404, "REPORT_NOT_FOUND", "Report not found")
    row.status = payload.status
    row.resolver_note = payload.resolver_note
    row.resolver_id = admin.id
    row.resolved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    return success(ReportRead.model_validate(row).model_dump(mode="json"))


@router.get("/lost-posts")
def admin_lost_posts(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    rows = db.scalars(select(LostPost).order_by(LostPost.created_at.desc()).limit(200)).all()
    return success([LostPostRead.model_validate(x).model_dump(mode="json") for x in rows])


@router.get("/found-posts")
def admin_found_posts(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    rows = db.scalars(select(FoundPost).order_by(FoundPost.created_at.desc()).limit(200)).all()
    return success([FoundPostRead.model_validate(x).model_dump(mode="json") for x in rows])


@router.post("/lost-posts/{post_id}/close")
def close_lost(post_id: str, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    post = db.get(LostPost, post_id)
    if post is None:
        raise AppError(404, "LOST_POST_NOT_FOUND", "Lost post not found")
    post.status = "removed"
    post.closed_at = datetime.now(timezone.utc)
    if post.pet:
        post.pet.status = "normal"
    db.commit()
    db.refresh(post)
    return success(LostPostRead.model_validate(post).model_dump(mode="json"))


@router.post("/found-posts/{post_id}/close")
def close_found(post_id: str, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    post = db.get(FoundPost, post_id)
    if post is None:
        raise AppError(404, "FOUND_POST_NOT_FOUND", "Found post not found")
    post.status = "removed"
    db.commit()
    db.refresh(post)
    return success(FoundPostRead.model_validate(post).model_dump(mode="json"))
