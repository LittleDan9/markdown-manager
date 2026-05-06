"""Publish AI provider state events to Redis Streams.

Publishes the full list of a user's AI providers to the ai.provider.v1 stream
so that other apps (e.g., Team Manager) can display cross-app diffs.
"""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone

import redis.asyncio as aioredis
from sqlalchemy import select, distinct
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.settings import get_settings
from app.models.user import User
from app.models.user_api_key import UserApiKey

logger = logging.getLogger(__name__)

TOPIC = "ai.provider.v1"
EVENT_TYPE = "AIProviderStatePublished"
SOURCE_APP = "markdown-manager"


async def _get_redis() -> aioredis.Redis:
    """Get a Redis connection for event publishing."""
    settings = get_settings()
    return aioredis.from_url(settings.redis_url, decode_responses=True)


async def _publish_event(topic: str, event_type: str, aggregate_id: str, payload: dict) -> str | None:
    """Publish a single event to a Redis Stream topic via XADD."""
    event_id = str(uuid.uuid4())
    envelope = {
        "event_id": event_id,
        "event_type": event_type,
        "topic": topic,
        "schema_version": "1",
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "tenant_id": "default",
        "aggregate_id": aggregate_id,
        "payload": json.dumps(payload),
    }
    try:
        redis = await _get_redis()
        try:
            msg_id = await redis.xadd(topic, envelope)
            logger.debug("Published %s to %s (msg_id=%s)", event_type, topic, msg_id)
            return msg_id
        finally:
            await redis.aclose()
    except Exception as exc:
        logger.warning("Failed to publish event %s to %s: %s", event_type, topic, exc)
        return None


async def publish_user_provider_state(user: User, db: AsyncSession) -> None:
    """Publish a user's full AI provider state to the event stream."""
    result = await db.execute(
        select(UserApiKey).where(UserApiKey.user_id == user.id)
    )
    keys = result.scalars().all()

    providers = []
    for k in keys:
        providers.append({
            "id": k.id,
            "provider": k.provider,
            "label": k.label or "",
            "base_url": k.base_url or None,
            "preferred_model": k.preferred_model or None,
            "org_name": k.org_name or None,
            "is_active": k.is_active,
            "has_key": bool(k.api_key_encrypted),
        })

    payload = {
        "user_email": user.email,
        "source_app": SOURCE_APP,
        "providers": providers,
    }

    await _publish_event(
        topic=TOPIC,
        event_type=EVENT_TYPE,
        aggregate_id=str(user.id),
        payload=payload,
    )


async def publish_all_provider_state(db: AsyncSession) -> None:
    """Publish all users' provider state. Called on startup for backfill."""
    result = await db.execute(
        select(distinct(UserApiKey.user_id))
    )
    user_ids = [row[0] for row in result.all()]

    if not user_ids:
        logger.info("No AI provider settings to publish (0 users)")
        return

    logger.info("Publishing AI provider state for %d users (startup backfill)", len(user_ids))
    batch_size = 50
    published = 0

    for i in range(0, len(user_ids), batch_size):
        batch = user_ids[i:i + batch_size]
        for uid in batch:
            try:
                user_result = await db.execute(select(User).where(User.id == uid))
                user = user_result.scalar_one_or_none()
                if user:
                    await publish_user_provider_state(user, db)
                    published += 1
            except Exception as exc:
                logger.warning("Failed to publish provider state for user_id=%d: %s", uid, exc)
        if i + batch_size < len(user_ids):
            await asyncio.sleep(0.1)

    logger.info("Startup backfill complete: published %d/%d users", published, len(user_ids))
