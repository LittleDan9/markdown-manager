"""Analytics ingestion endpoint — accepts events without authentication."""
import hashlib
import json
import logging
from datetime import date, datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory rate limiter (per-session, resets on restart)
_rate_limits: dict[str, list[float]] = {}
_RATE_LIMIT_WINDOW = 60  # seconds
_RATE_LIMIT_MAX = 50  # max events per window per session
_LAST_CLEANUP = 0.0  # timestamp of last cleanup pass
_CLEANUP_INTERVAL = 300  # prune stale sessions every 5 minutes

ALLOWED_EVENT_TYPES = {
    "session_start",
    "document_create",
    "document_edit",
    "document_delete",
    "feature_attempt_blocked",
    "login_modal_opened",
    "registration_completed",
}


class AnalyticsEventIn(BaseModel):
    """Single analytics event from the frontend."""

    event_type: str = Field(..., max_length=50)
    event_data: dict[str, Any] | None = None
    is_authenticated: bool = False
    user_id: int | None = None
    timestamp: str | None = None

    @field_validator("event_type")
    @classmethod
    def validate_event_type(cls, v: str) -> str:
        if v not in ALLOWED_EVENT_TYPES:
            raise ValueError(f"Unknown event type: {v}")
        return v

    @field_validator("user_id")
    @classmethod
    def validate_user_id(cls, v: int | None) -> int | None:
        # Only allow positive user IDs or None
        if v is not None and v < 1:
            return None
        return v


class AnalyticsEventBatch(BaseModel):
    """Batch of analytics events."""

    session_id: str = Field(..., min_length=1, max_length=36)
    events: list[AnalyticsEventIn] = Field(..., min_length=1, max_length=50)


def _hash_ip(ip: str) -> str:
    """Hash IP with daily rotating salt for privacy."""
    daily_salt = f"analytics-{date.today().isoformat()}"
    return hashlib.sha256(f"{daily_salt}:{ip}".encode()).hexdigest()[:16]


def _check_rate_limit(session_id: str) -> bool:
    """Check and enforce per-session rate limit. Returns True if allowed."""
    global _LAST_CLEANUP
    now = datetime.now(timezone.utc).timestamp()
    window_start = now - _RATE_LIMIT_WINDOW

    # Periodic cleanup of stale sessions to prevent memory leak
    if now - _LAST_CLEANUP > _CLEANUP_INTERVAL:
        _LAST_CLEANUP = now
        stale = [
            sid for sid, timestamps in _rate_limits.items()
            if not timestamps or timestamps[-1] < window_start
        ]
        for sid in stale:
            del _rate_limits[sid]

    if session_id not in _rate_limits:
        _rate_limits[session_id] = []

    # Prune old entries
    _rate_limits[session_id] = [
        ts for ts in _rate_limits[session_id] if ts > window_start
    ]

    if len(_rate_limits[session_id]) >= _RATE_LIMIT_MAX:
        return False

    _rate_limits[session_id].append(now)
    return True


@router.post("/analytics/events", status_code=202)
async def ingest_analytics_events(
    batch: AnalyticsEventBatch,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Ingest a batch of analytics events (no authentication required)."""
    if not _check_rate_limit(batch.session_id):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    client_ip = request.headers.get("X-Forwarded-For", request.client.host or "")
    # Take first IP if forwarded through proxies
    if "," in client_ip:
        client_ip = client_ip.split(",")[0].strip()
    ip_hash = _hash_ip(client_ip)

    # Batch insert
    values = []
    for event in batch.events:
        values.append({
            "session_id": batch.session_id,
            "event_type": event.event_type,
            "event_data": json.dumps(event.event_data) if event.event_data else None,
            "is_authenticated": event.is_authenticated,
            "user_id": event.user_id,
            "client_ip_hash": ip_hash,
            "created_at": datetime.now(timezone.utc),
        })

    if values:
        await db.execute(
            text("""
                INSERT INTO analytics_events (
                    session_id, event_type, event_data,
                    is_authenticated, user_id, client_ip_hash,
                    created_at
                ) VALUES (
                    :session_id, :event_type, :event_data,
                    :is_authenticated, :user_id, :client_ip_hash,
                    :created_at
                )
            """),
            values,
        )
        await db.commit()

    logger.info(
        "Analytics: ingested %d events for session %s (authenticated=%s)",
        len(batch.events),
        batch.session_id[:8],
        any(e.is_authenticated for e in batch.events),
    )

    return {"status": "accepted"}
