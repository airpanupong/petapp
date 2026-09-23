from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_optional_user
from app.core.database import get_db
from app.core.responses import success
from app.models.community import Ad
from app.models.features import AdEvent
from app.models.user import User
from app.schemas.community import AdRead
from app.schemas.features import AdEventCreate
from app.utils.geo import haversine_km

router = APIRouter(prefix="/ads", tags=["ads"])


@router.get("")
def list_ads(
    latitude: float | None = Query(default=None, ge=-90, le=90),
    longitude: float | None = Query(default=None, ge=-180, le=180),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    stmt = select(Ad).where(
        Ad.status == "active",
        or_(Ad.start_at.is_(None), Ad.start_at <= now),
        or_(Ad.end_at.is_(None), Ad.end_at >= now),
    ).order_by(Ad.created_at.desc()).limit(20)
    rows = db.scalars(stmt).all()
    result = []
    for ad in rows:
        if (
            latitude is not None and longitude is not None
            and ad.target_latitude is not None and ad.target_longitude is not None
            and ad.target_radius_km is not None
        ):
            if haversine_km(latitude, longitude, ad.target_latitude, ad.target_longitude) > ad.target_radius_km:
                continue
        result.append(AdRead.model_validate(ad).model_dump(mode="json"))
    return success(result)


@router.post("/{ad_id}/events", status_code=201)
def track_ad_event(
    ad_id: str,
    payload: AdEventCreate,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    ad = db.get(Ad, ad_id)
    if ad is None:
        from app.core.exceptions import AppError
        raise AppError(404, "AD_NOT_FOUND", "Ad not found")
    row = AdEvent(ad_id=ad_id, user_id=current_user.id if current_user else None, event_type=payload.event_type)
    db.add(row); db.commit(); db.refresh(row)
    return success({"tracked": True, "event_type": row.event_type})
