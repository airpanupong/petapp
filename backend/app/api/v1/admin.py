from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.exceptions import AppError
from app.core.responses import success
from app.core.roles import ADMIN, SUPER_ADMIN, USER, is_staff
from app.models.features import OwnershipVerification
from app.models.lost_found import FoundPost, LostPost
from app.models.moderation import Report
from app.models.user import RefreshToken, User
from app.schemas.features import OwnershipReview, OwnershipVerificationRead
from app.schemas.lost_found import FoundPostRead, LostPostRead
from app.schemas.moderation import ReportRead, ReportResolve
from app.schemas.user import UserRead

router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin(user: User = Depends(get_current_user)) -> User:
    if not is_staff(user.role):
        raise AppError(403, "AUTH_FORBIDDEN", "Admin role required")
    return user


def require_super_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != SUPER_ADMIN:
        raise AppError(403, "AUTH_FORBIDDEN", "Super admin role required")
    return user


class RoleUpdate(BaseModel):
    role: str


def _user_or_404(db: Session, user_id: str) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise AppError(404, "USER_NOT_FOUND", "User not found")
    return user


def _set_user_posts_status(db: Session, user_id: str, from_status: str, to_status: str) -> None:
    db.execute(
        update(LostPost).where(LostPost.owner_id == user_id, LostPost.status == from_status).values(status=to_status)
    )
    db.execute(
        update(FoundPost).where(FoundPost.reporter_id == user_id, FoundPost.status == from_status).values(status=to_status)
    )


def _set_post_visibility(post: LostPost | FoundPost, hidden: bool) -> None:
    if hidden:
        if post.status != "active":
            raise AppError(409, "POST_NOT_ACTIVE", "Only active posts can be hidden")
        post.status = "hidden"
    else:
        if post.status != "hidden":
            raise AppError(409, "POST_NOT_HIDDEN", "Post is not hidden")
        post.status = "active"


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
def list_users(
    q: str | None = Query(default=None, max_length=120),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    stmt = select(User).order_by(User.created_at.desc()).limit(200)
    if q and q.strip():
        term = f"%{q.strip().lower()}%"
        stmt = stmt.where(or_(func.lower(User.email).like(term), func.lower(User.display_name).like(term)))
    rows = db.scalars(stmt).all()
    return success([UserRead.model_validate(x).model_dump(mode="json") for x in rows])


@router.post("/users/{user_id}/block")
def block_user(user_id: str, db: Session = Depends(get_db), actor: User = Depends(require_super_admin)):
    user = _user_or_404(db, user_id)
    if user.id == actor.id:
        raise AppError(409, "CANNOT_BLOCK_SELF", "You cannot block yourself")
    if user.role == SUPER_ADMIN:
        raise AppError(403, "AUTH_FORBIDDEN", "Super admins cannot be blocked")
    user.is_active = False
    user.status = "blocked"
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc))
    )
    _set_user_posts_status(db, user.id, "active", "hidden")
    db.commit()
    db.refresh(user)
    return success(UserRead.model_validate(user).model_dump(mode="json"))


@router.post("/users/{user_id}/unblock")
def unblock_user(user_id: str, db: Session = Depends(get_db), _: User = Depends(require_super_admin)):
    user = _user_or_404(db, user_id)
    user.is_active = True
    user.status = "active"
    _set_user_posts_status(db, user.id, "hidden", "active")
    db.commit()
    db.refresh(user)
    return success(UserRead.model_validate(user).model_dump(mode="json"))


@router.post("/users/{user_id}/role")
def set_user_role(
    user_id: str,
    payload: RoleUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_super_admin),
):
    if payload.role not in (USER, ADMIN):
        raise AppError(422, "INVALID_ROLE", "Role must be user or admin")
    user = _user_or_404(db, user_id)
    if user.id == actor.id or user.role == SUPER_ADMIN:
        raise AppError(403, "AUTH_FORBIDDEN", "Super admin role cannot be changed here")
    user.role = payload.role
    db.commit()
    db.refresh(user)
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


@router.post("/lost-posts/{post_id}/hide")
def hide_lost(post_id: str, db: Session = Depends(get_db), _: User = Depends(require_super_admin)):
    return _toggle_lost(db, post_id, hidden=True)


@router.post("/lost-posts/{post_id}/unhide")
def unhide_lost(post_id: str, db: Session = Depends(get_db), _: User = Depends(require_super_admin)):
    return _toggle_lost(db, post_id, hidden=False)


@router.post("/found-posts/{post_id}/hide")
def hide_found(post_id: str, db: Session = Depends(get_db), _: User = Depends(require_super_admin)):
    return _toggle_found(db, post_id, hidden=True)


@router.post("/found-posts/{post_id}/unhide")
def unhide_found(post_id: str, db: Session = Depends(get_db), _: User = Depends(require_super_admin)):
    return _toggle_found(db, post_id, hidden=False)


def _toggle_lost(db: Session, post_id: str, hidden: bool):
    post = db.get(LostPost, post_id)
    if post is None:
        raise AppError(404, "LOST_POST_NOT_FOUND", "Lost post not found")
    _set_post_visibility(post, hidden)
    db.commit()
    db.refresh(post)
    return success(LostPostRead.model_validate(post).model_dump(mode="json"))


def _toggle_found(db: Session, post_id: str, hidden: bool):
    post = db.get(FoundPost, post_id)
    if post is None:
        raise AppError(404, "FOUND_POST_NOT_FOUND", "Found post not found")
    _set_post_visibility(post, hidden)
    db.commit()
    db.refresh(post)
    return success(FoundPostRead.model_validate(post).model_dump(mode="json"))
