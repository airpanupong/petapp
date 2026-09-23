from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.responses import success
from app.models.lost_found import FoundPost, LostPost, Sighting
from app.models.pet import Pet
from app.schemas.lost_found import FoundPostRead, LostPostRead
from app.utils.geo import haversine_km

router = APIRouter(prefix="/nearby", tags=["nearby"])


@router.get("")
def nearby(
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    radius_km: float = Query(default=5, gt=0, le=100),
    animal_type: str | None = None,
    post_type: str | None = Query(default=None, pattern="^(lost|found|sighting)$"),
    days: int | None = Query(default=None, ge=1, le=365),
    db: Session = Depends(get_db),
):
    lost_items: list[dict] = []
    found_items: list[dict] = []
    sighting_items: list[dict] = []
    since = datetime.now(timezone.utc) - timedelta(days=days) if days else None

    if post_type in {None, "lost"}:
        stmt = select(LostPost).join(Pet, Pet.id == LostPost.pet_id).where(LostPost.status == "active")
        if animal_type:
            stmt = stmt.where(Pet.animal_type == animal_type)
        if since is not None:
            stmt = stmt.where(LostPost.created_at >= since)
        for post in db.scalars(stmt.order_by(LostPost.created_at.desc()).limit(500)).all():
            distance = haversine_km(latitude, longitude, post.latitude, post.longitude)
            if distance <= radius_km:
                item = LostPostRead.model_validate(post).model_dump(mode="json")
                item["distance_km"] = round(distance, 2)
                item["pet"] = {
                    "id": post.pet.id,
                    "name": post.pet.name,
                    "animal_type": post.pet.animal_type,
                    "breed": post.pet.breed,
                    "color": post.pet.color,
                    "profile_image_url": post.pet.profile_image_url,
                }
                lost_items.append(item)

    if post_type in {None, "found"}:
        stmt = select(FoundPost).where(FoundPost.status == "active")
        if animal_type:
            stmt = stmt.where(FoundPost.animal_type == animal_type)
        if since is not None:
            stmt = stmt.where(FoundPost.created_at >= since)
        for post in db.scalars(stmt.order_by(FoundPost.created_at.desc()).limit(500)).all():
            distance = haversine_km(latitude, longitude, post.latitude, post.longitude)
            if distance <= radius_km:
                item = FoundPostRead.model_validate(post).model_dump(mode="json")
                item["distance_km"] = round(distance, 2)
                found_items.append(item)

    if post_type in {None, "sighting"}:
        stmt = (
            select(Sighting)
            .join(LostPost, LostPost.id == Sighting.lost_post_id)
            .where(LostPost.status == "active")
        )
        if since is not None:
            stmt = stmt.where(Sighting.seen_at >= since)
        if animal_type:
            stmt = stmt.join(Pet, Pet.id == LostPost.pet_id).where(Pet.animal_type == animal_type)
        for sighting in db.scalars(stmt.order_by(Sighting.seen_at.desc()).limit(500)).all():
            distance = haversine_km(latitude, longitude, sighting.latitude, sighting.longitude)
            if distance <= radius_km:
                lost = sighting.lost_post
                sighting_items.append(
                    {
                        "id": sighting.id,
                        "lost_post_id": sighting.lost_post_id,
                        "seen_at": sighting.seen_at.isoformat(),
                        "latitude": sighting.latitude,
                        "longitude": sighting.longitude,
                        "location_text": sighting.location_text,
                        "direction": sighting.direction,
                        "description": sighting.description,
                        "distance_km": round(distance, 2),
                        "pet_name": lost.pet.name if lost and lost.pet else None,
                    }
                )

    lost_items.sort(key=lambda x: x["distance_km"])
    found_items.sort(key=lambda x: x["distance_km"])
    sighting_items.sort(key=lambda x: x["distance_km"])
    return success({"lost": lost_items, "found": found_items, "sightings": sighting_items})
