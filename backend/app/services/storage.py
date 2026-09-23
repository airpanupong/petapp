from __future__ import annotations

import logging
import uuid
from functools import lru_cache
from pathlib import Path

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from app.core.config import settings
from app.core.exceptions import AppError

logger = logging.getLogger(__name__)

LOCAL_UPLOAD_DIR = Path("/data/uploads")
if not LOCAL_UPLOAD_DIR.exists():
    LOCAL_UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads"
LOCAL_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


class ObjectStorage:
    """S3/MinIO when configured; otherwise local disk (Railway-friendly)."""

    def __init__(self) -> None:
        self.use_s3 = settings.s3_configured
        self.bucket = settings.s3_bucket or ""
        self.public_base = (settings.s3_public_base_url or "").rstrip("/")
        self._client = None
        self._presign_client = None
        if self.use_s3:
            common = dict(
                aws_access_key_id=settings.s3_access_key_id,
                aws_secret_access_key=settings.s3_secret_access_key,
                region_name=settings.s3_region,
                config=Config(
                    signature_version="s3v4",
                    s3={"addressing_style": "path" if settings.s3_force_path_style else "auto"},
                ),
            )
            self._client = boto3.client("s3", endpoint_url=settings.s3_endpoint, **common)
            presign_endpoint = settings.s3_presign_endpoint
            if not presign_endpoint and self.public_base:
                parts = self.public_base.rsplit("/", 1)
                if len(parts) == 2 and parts[1] == self.bucket:
                    presign_endpoint = parts[0]
            self._presign_client = boto3.client(
                "s3",
                endpoint_url=presign_endpoint or settings.s3_endpoint,
                **common,
            )
            self._ensure_bucket()
        else:
            logger.warning("S3 not configured — using local uploads at %s", LOCAL_UPLOAD_DIR)

    def _ensure_bucket(self) -> None:
        assert self._client is not None
        try:
            self._client.head_bucket(Bucket=self.bucket)
        except ClientError:
            try:
                self._client.create_bucket(Bucket=self.bucket)
            except ClientError as exc:
                code = exc.response.get("Error", {}).get("Code", "")
                if code not in {"BucketAlreadyOwnedByYou", "BucketAlreadyExists"}:
                    raise AppError(503, "S3_BUCKET_ERROR", f"Cannot access bucket: {exc}") from exc

    def upload_bytes(self, *, key: str, data: bytes, content_type: str) -> str:
        if self.use_s3:
            assert self._client is not None
            try:
                self._client.put_object(
                    Bucket=self.bucket,
                    Key=key,
                    Body=data,
                    ContentType=content_type,
                    CacheControl="public, max-age=31536000",
                )
            except ClientError as exc:
                raise AppError(502, "S3_UPLOAD_FAILED", f"Upload to S3 failed: {exc}") from exc
            return self.public_url(key)

        filename = Path(key).name
        path = LOCAL_UPLOAD_DIR / filename
        path.write_bytes(data)
        return self.public_url(f"uploads/{filename}")

    def create_presigned_put(self, *, key: str, content_type: str, expires_in: int = 900) -> str | None:
        if not self.use_s3 or self._presign_client is None:
            return None
        try:
            return self._presign_client.generate_presigned_url(
                "put_object",
                Params={"Bucket": self.bucket, "Key": key, "ContentType": content_type},
                ExpiresIn=expires_in,
            )
        except ClientError as exc:
            raise AppError(502, "S3_PRESIGN_FAILED", f"Could not create upload URL: {exc}") from exc

    def public_url(self, key: str) -> str:
        if self.use_s3 and self.public_base:
            return f"{self.public_base}/{key.lstrip('/')}"
        if self.use_s3:
            endpoint = (settings.s3_endpoint or "").rstrip("/")
            return f"{endpoint}/{self.bucket}/{key.lstrip('/')}"
        base = (settings.public_api_base or "").rstrip("/")
        filename = Path(key).name
        if base:
            return f"{base}/api/v1/uploads/files/{filename}"
        return f"/api/v1/uploads/files/{filename}"

    def local_path(self, filename: str) -> Path | None:
        if self.use_s3:
            return None
        path = LOCAL_UPLOAD_DIR / Path(filename).name
        return path if path.is_file() else None


@lru_cache
def get_storage() -> ObjectStorage:
    return ObjectStorage()


# Back-compat alias
S3Storage = ObjectStorage
