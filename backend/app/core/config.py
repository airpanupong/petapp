from __future__ import annotations

from functools import lru_cache
from typing import Literal
from urllib.parse import urlparse, urlunparse

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def normalize_database_url(url: str) -> str:
    """Railway/Heroku give postgres:// — SQLAlchemy+psycopg need postgresql+psycopg://"""
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://") :]
    if url.startswith("postgresql://") and "+psycopg" not in url:
        return "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


class Settings(BaseSettings):
    app_name: str = "Pet haii API"
    app_env: Literal["development", "test", "production"] = "development"
    api_v1_prefix: str = "/api/v1"
    secret_key: str = "dev-only-change-me"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 30
    database_url: str = "sqlite:///./petapp-dev.db"
    redis_url: str = "redis://localhost:6379/0"
    cors_origins: str = "*"
    # Public base of this API, e.g. https://petapp-api.up.railway.app (no trailing slash)
    public_api_base: str | None = None

    s3_endpoint: str | None = None
    s3_access_key_id: str | None = None
    s3_secret_access_key: str | None = None
    s3_bucket: str | None = None
    s3_region: str = "us-east-1"
    s3_public_base_url: str | None = None
    s3_force_path_style: bool = True
    s3_presign_endpoint: str | None = None
    firebase_credentials_json: str | None = None
    vapid_public_key: str | None = None
    vapid_private_key: str | None = None
    vapid_subject: str = "mailto:support@pethaii.com"

    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from: str = "Pet haii <support@pethaii.com>"
    # HTTPS email API (https://resend.com). Preferred over SMTP when set; Railway Hobby blocks SMTP ports.
    resend_api_key: str | None = None

    super_admin_email: str = "support@pethaii.com"
    # Only used to create the super admin account when it does not exist yet.
    super_admin_password: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    @field_validator("database_url", mode="before")
    @classmethod
    def _db_url(cls, value: object) -> object:
        if isinstance(value, str):
            return normalize_database_url(value)
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [x.strip() for x in self.cors_origins.split(",") if x.strip()]

    @property
    def s3_configured(self) -> bool:
        return bool(
            self.s3_endpoint
            and self.s3_access_key_id
            and self.s3_secret_access_key
            and self.s3_bucket
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
