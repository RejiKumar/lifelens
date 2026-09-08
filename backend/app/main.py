"""LifeLens FastAPI application entrypoint.

Responsible only for repository setup. Feature endpoints (auth, scan,
analysis, monetization) are added by their own changes.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.health import router as health_router
from app.api.scan import router as scan_router
from app.core.config import get_settings
from app.core.errors import LifeLensError, QuotaExceededError

settings = get_settings()


def _life_lens_error_handler(request: Request, exc: Exception) -> JSONResponse:
    body: dict[str, Any] = {
        "error": {
            "code": exc.code if isinstance(exc, LifeLensError) else "INTERNAL_ERROR",
            "message": (
                exc.message if isinstance(exc, LifeLensError) else "An unexpected error occurred."
            ),
            "details": exc.details if isinstance(exc, LifeLensError) else None,
        }
    }
    if isinstance(exc, QuotaExceededError) and exc.quota is not None:
        body["error"]["quota"] = exc.quota
    status = exc.status_code if isinstance(exc, LifeLensError) else 500
    return JSONResponse(status_code=status, content=body)


def create_app() -> FastAPI:
    app = FastAPI(
        title="LifeLens API",
        version="0.1.0",
        docs_url="/docs" if settings.app_env != "prod" else None,
        redoc_url="/redoc" if settings.app_env != "prod" else None,
        openapi_url="/openapi.json" if settings.app_env != "prod" else None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.add_exception_handler(LifeLensError, _life_lens_error_handler)

    app.include_router(health_router)
    app.include_router(scan_router)

    return app


app = create_app()
