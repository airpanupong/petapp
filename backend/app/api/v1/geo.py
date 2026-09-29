from __future__ import annotations

import asyncio
import logging
import time
from collections import OrderedDict

import httpx
from fastapi import APIRouter, Query

from app.core.exceptions import AppError
from app.core.responses import success

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/geo", tags=["geo"])

NOMINATIM = "https://nominatim.openstreetmap.org"
# Nominatim's usage policy requires an identifying User-Agent and at most one request per second.
HEADERS = {"User-Agent": "PetHaii/1.0 (support@pethaii.com)", "Accept-Language": "th,en"}
MIN_INTERVAL = 1.0
CACHE_SIZE = 1000
CACHE_TTL = 24 * 3600

_cache: OrderedDict[str, tuple[float, object]] = OrderedDict()
_lock = asyncio.Lock()
_last_call = 0.0


def _cache_get(key: str):
    hit = _cache.get(key)
    if hit is None or time.monotonic() - hit[0] > CACHE_TTL:
        return None
    _cache.move_to_end(key)
    return hit[1]


def _cache_put(key: str, value: object) -> None:
    _cache[key] = (time.monotonic(), value)
    _cache.move_to_end(key)
    while len(_cache) > CACHE_SIZE:
        _cache.popitem(last=False)


async def _nominatim(path: str, params: dict[str, str | int | float]):
    global _last_call
    async with _lock:
        wait = MIN_INTERVAL - (time.monotonic() - _last_call)
        if wait > 0:
            await asyncio.sleep(wait)
        try:
            async with httpx.AsyncClient(timeout=8, headers=HEADERS) as client:
                res = await client.get(f"{NOMINATIM}{path}", params={**params, "format": "jsonv2"})
        except httpx.HTTPError as exc:
            logger.warning("Nominatim request failed: %s", exc)
            raise AppError(502, "GEOCODE_UNAVAILABLE", "Place search is unavailable") from exc
        finally:
            _last_call = time.monotonic()
    if res.status_code != 200:
        logger.warning("Nominatim returned %s", res.status_code)
        raise AppError(502, "GEOCODE_UNAVAILABLE", "Place search is unavailable")
    return res.json()


def _short_name(item: dict) -> str:
    address = item.get("address") or {}
    parts = [
        item.get("name"),
        address.get("road"),
        address.get("suburb") or address.get("quarter") or address.get("neighbourhood"),
        address.get("city_district") or address.get("district"),
        address.get("city") or address.get("province") or address.get("state"),
    ]
    seen: list[str] = []
    for part in parts:
        if part and part not in seen:
            seen.append(part)
    return " ".join(seen[:3]) or item.get("display_name", "")


@router.get("/search")
async def search_places(
    q: str = Query(min_length=2, max_length=120),
    lat: float | None = Query(default=None, ge=-90, le=90),
    lng: float | None = Query(default=None, ge=-180, le=180),
):
    query = " ".join(q.split())
    near = f"{round(lat, 1)},{round(lng, 1)}" if lat is not None and lng is not None else ""
    key = f"s|{query.lower()}|{near}"
    cached = _cache_get(key)
    if cached is not None:
        return success(cached)
    params: dict[str, str | int | float] = {"q": query, "countrycodes": "th", "limit": 6, "addressdetails": 1}
    if lat is not None and lng is not None:
        # Prefer (but do not restrict to) results around the user.
        params["viewbox"] = f"{lng - 0.3},{lat + 0.3},{lng + 0.3},{lat - 0.3}"
    rows = await _nominatim("/search", params)
    results = [
        {
            "name": _short_name(r),
            "address": r.get("display_name", ""),
            "latitude": float(r["lat"]),
            "longitude": float(r["lon"]),
        }
        for r in rows
        if r.get("lat") and r.get("lon")
    ]
    _cache_put(key, results)
    return success(results)


@router.get("/reverse")
async def reverse_geocode(
    lat: float = Query(ge=-90, le=90),
    lng: float = Query(ge=-180, le=180),
):
    key = f"r|{round(lat, 4)},{round(lng, 4)}"
    cached = _cache_get(key)
    if cached is not None:
        return success(cached)
    row = await _nominatim("/reverse", {"lat": lat, "lon": lng, "zoom": 17, "addressdetails": 1})
    result = {"name": _short_name(row) if isinstance(row, dict) and not row.get("error") else ""}
    _cache_put(key, result)
    return success(result)
