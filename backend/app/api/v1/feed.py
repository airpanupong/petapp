from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_optional_user
from app.api.v1.lost_posts import lost_post_list_item
from app.core.database import get_db
from app.core.pagination import as_utc, is_older, make_cursor, parse_cursor
from app.core.responses import success
from app.models.lost_found import FoundPost, LostPost
from app.models.pet import Pet
from app.models.user import User
from app.schemas.lost_found import FoundPostRead
from app.services.pet_options import matches_pet_option

router = APIRouter(prefix="/feed", tags=["feed"])


@router.get("")
def home_feed(
    kind: Literal["all", "lost", "found"] = "all",
    animal_type: str | None = None,
    breed: str | None = None,
    color: str | None = None,
    cursor: str | None = None,
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    viewer: User | None = Depends(get_optional_user),
):
    """Active lost and found posts, newest event first. The viewer's own posts are left out; the app lists those on top."""
    # Breed/color matching tolerates free-typed legacy values, so it runs here rather than in SQL.
    rows: list[tuple] = []
    if kind != "found":
        stmt = select(LostPost).join(Pet, Pet.id == LostPost.pet_id).where(LostPost.status == "active").options(selectinload(LostPost.pet))
        if animal_type:
            stmt = stmt.where(Pet.animal_type == animal_type)
        if viewer:
            stmt = stmt.where(LostPost.owner_id != viewer.id)
        for post in db.scalars(stmt):
            pet = post.pet
            if matches_pet_option(pet.animal_type, "breed", pet.breed, breed) and matches_pet_option(pet.animal_type, "color", pet.color, color):
                rows.append((as_utc(post.lost_at), post.id, "lost", post))
    if kind != "lost":
        stmt = select(FoundPost).where(FoundPost.status == "active")
        if animal_type:
            stmt = stmt.where(FoundPost.animal_type == animal_type)
        if viewer:
            stmt = stmt.where(or_(FoundPost.reporter_id.is_(None), FoundPost.reporter_id != viewer.id))
        for post in db.scalars(stmt):
            if matches_pet_option(post.animal_type, "breed", post.breed_guess, breed) and matches_pet_option(post.animal_type, "color", post.color, color):
                rows.append((as_utc(post.found_at), post.id, "found", post))

    rows.sort(key=lambda r: (r[0], r[1]), reverse=True)
    after = parse_cursor(cursor)
    rows = [r for r in rows if is_older(r[0], r[1], after)]
    page = rows[:limit]
    items = [
        {"kind": k, "post": lost_post_list_item(post) if k == "lost" else FoundPostRead.model_validate(post).model_dump(mode="json")}
        for _, _, k, post in page
    ]
    counts = {
        "lost": db.scalar(select(func.count()).select_from(LostPost).where(LostPost.status == "active")) or 0,
        "found": db.scalar(select(func.count()).select_from(FoundPost).where(FoundPost.status == "active")) or 0,
    }
    next_cursor = make_cursor(page[-1][0], page[-1][1]) if len(rows) > limit else None
    return success({"items": items, "next_cursor": next_cursor, "counts": counts})
