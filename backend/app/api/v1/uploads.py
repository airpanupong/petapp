from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import FileResponse

from app.api.deps import get_current_user
from app.core.exceptions import AppError
from app.core.responses import success
from app.models.user import User
from app.schemas.moderation import PresignRequest
from app.services.storage import get_storage

router = APIRouter(prefix="/uploads", tags=["uploads"])

ALLOWED_TYPES = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/heic": ".heic",
}
MAX_BYTES = 8 * 1024 * 1024


def _resolve_ext(content_type: str, filename: str | None) -> tuple[str, str]:
    ext = ALLOWED_TYPES.get(content_type)
    if ext is not None:
        media = "image/jpeg" if ext == ".jpg" else content_type
        return ext, media
    name = (filename or "").lower()
    if name.endswith((".jpg", ".jpeg")):
        return ".jpg", "image/jpeg"
    if name.endswith(".png"):
        return ".png", "image/png"
    if name.endswith(".webp"):
        return ".webp", "image/webp"
    raise AppError(400, "UPLOAD_INVALID_TYPE", "Only JPEG, PNG or WebP images are allowed")


@router.post("/presign", status_code=201)
def create_presign(
    payload: PresignRequest,
    current_user: User = Depends(get_current_user),
):
    storage = get_storage()
    ext, media = _resolve_ext(payload.content_type, payload.filename)
    filename = f"{uuid.uuid4().hex}{ext}"
    key = f"uploads/{filename}"
    upload_url = storage.create_presigned_put(key=key, content_type=media)
    if not upload_url:
        # Local storage: client should use POST /uploads instead
        raise AppError(
            501,
            "PRESIGN_UNAVAILABLE",
            "Direct upload is unavailable; use POST /uploads",
        )
    return success(
        {
            "upload_url": upload_url,
            "key": key,
            "filename": filename,
            "content_type": media,
            "url": storage.public_url(key),
            "uploader_id": current_user.id,
        }
    )


@router.post("", status_code=201)
async def upload_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    content_type = (file.content_type or "").lower()
    ext, media_type = _resolve_ext(content_type, file.filename)
    data = await file.read()
    if not data:
        raise AppError(400, "UPLOAD_EMPTY", "Empty file")
    if len(data) > MAX_BYTES:
        raise AppError(400, "UPLOAD_TOO_LARGE", "Image must be 8MB or smaller")

    filename = f"{uuid.uuid4().hex}{ext}"
    key = f"uploads/{filename}"
    storage = get_storage()
    url = storage.upload_bytes(key=key, data=data, content_type=media_type)
    return success(
        {
            "url": url,
            "key": key,
            "filename": filename,
            "uploader_id": current_user.id,
        }
    )


@router.get("/files/{filename}")
def get_local_file(filename: str):
    storage = get_storage()
    path = storage.local_path(filename)
    if path is None:
        raise AppError(404, "UPLOAD_NOT_FOUND", "File not found")
    media = "image/jpeg"
    name = path.name.lower()
    if name.endswith(".png"):
        media = "image/png"
    elif name.endswith(".webp"):
        media = "image/webp"
    return FileResponse(path, media_type=media)
