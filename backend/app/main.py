from __future__ import annotations

import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import SessionLocal
from app.core.exceptions import AppError, app_error_handler
from app.core.responses import error_payload
from app.services.lost_checkin_service import run_lost_checkins

logger = logging.getLogger(__name__)

CHECKIN_JOB_INTERVAL_SECONDS = 30 * 60
CHECKIN_JOB_FIRST_DELAY_SECONDS = 60


def _run_checkins_once() -> None:
    with SessionLocal() as db:
        run_lost_checkins(db)


async def _checkin_loop() -> None:
    await asyncio.sleep(CHECKIN_JOB_FIRST_DELAY_SECONDS)
    while True:
        try:
            await asyncio.to_thread(_run_checkins_once)
        except Exception:  # noqa: BLE001
            logger.exception("Lost check-in job failed")
        await asyncio.sleep(CHECKIN_JOB_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = None if settings.app_env == "test" else asyncio.create_task(_checkin_loop())
    yield
    if task is not None:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Pet identity, QR, lost & found and nearby community API",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=settings.cors_origin_list != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(AppError, app_error_handler)


@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content=error_payload("VALIDATION_ERROR", "Request validation failed", exc.errors()),
    )


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(api_router, prefix=settings.api_v1_prefix)
