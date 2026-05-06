"""Background Redis Streams consumer for Markdown Manager backend.

Consumes cross-app events (e.g., ai.provider.v1) directly in the backend
process since they need access to the same database.
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone

import redis.asyncio as aioredis
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.settings import get_settings
from app.models.remote_ai_provider import RemoteAIProvider
from app.models.user import User

logger = logging.getLogger(__name__)

CONSUMER_GROUP = "mm-backend"
CONSUMER_NAME = "mm-consumer-1"
TOPICS = ["ai.provider.v1", "ai.usage.v1"]


async def start_event_consumer() -> None:
    """Start the background event consumer loop."""
    settings = get_settings()
    try:
        redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    except Exception as exc:
        logger.warning("Event consumer cannot start — Redis unavailable: %s", exc)
        return

    # Create consumer groups
    for topic in TOPICS:
        try:
            await redis.xgroup_create(topic, CONSUMER_GROUP, id="$", mkstream=True)
            logger.info("Created consumer group %s for topic %s", CONSUMER_GROUP, topic)
        except Exception:
            pass

    logger.info("Event consumer started (group=%s, topics=%s)", CONSUMER_GROUP, TOPICS)

    try:
        while True:
            try:
                streams = {topic: ">" for topic in TOPICS}
                results = await redis.xreadgroup(
                    groupname=CONSUMER_GROUP,
                    consumername=CONSUMER_NAME,
                    streams=streams,
                    count=10,
                    block=5000,
                )

                if not results:
                    continue

                for topic, messages in results:
                    for msg_id, data in messages:
                        try:
                            await _handle_event(topic, msg_id, data)
                            await redis.xack(topic, CONSUMER_GROUP, msg_id)
                        except Exception as exc:
                            logger.error("Failed to process event %s from %s: %s", msg_id, topic, exc)

            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.error("Event consumer error: %s", exc)
                await asyncio.sleep(5)
    finally:
        await redis.aclose()


async def _handle_event(topic: str, msg_id: str, data: dict) -> None:
    """Route an event to its handler."""
    event_type = data.get("event_type", "")
    payload_str = data.get("payload", "{}")

    try:
        payload = json.loads(payload_str)
    except json.JSONDecodeError:
        logger.warning("Invalid JSON payload in event %s", msg_id)
        return

    if event_type == "AIProviderStatePublished":
        await _handle_ai_provider_state(payload)
    elif event_type == "AIUsagePublished":
        await _handle_ai_usage(payload)
    else:
        logger.debug("Unhandled event type: %s (topic=%s)", event_type, topic)


async def _handle_ai_provider_state(payload: dict) -> None:
    """Process AIProviderStatePublished — upsert remote provider cache."""
    from app.database import AsyncSessionLocal

    user_email = payload.get("user_email")
    source_app = payload.get("source_app")
    providers = payload.get("providers", [])

    if not user_email or not source_app:
        logger.warning("AIProviderStatePublished missing user_email or source_app")
        return

    # Don't process our own events
    if source_app == "markdown-manager":
        return

    async with AsyncSessionLocal() as db:
        # Resolve user by email
        result = await db.execute(select(User).where(User.email == user_email))
        user = result.scalar_one_or_none()
        if not user:
            logger.debug("Ignoring provider state for unknown user: %s", user_email)
            return

        # Delete existing remote providers for this user+source_app
        await db.execute(
            delete(RemoteAIProvider).where(
                RemoteAIProvider.user_id == user.id,
                RemoteAIProvider.source_app == source_app,
            )
        )

        # Insert new remote providers
        now = datetime.now(timezone.utc)
        for p in providers:
            remote = RemoteAIProvider(
                user_id=user.id,
                source_app=source_app,
                remote_id=p.get("id", 0),
                provider=p.get("provider", ""),
                label=p.get("label", ""),
                base_url=p.get("base_url"),
                preferred_model=p.get("preferred_model"),
                org_name=p.get("org_name"),
                is_active=p.get("is_active", True),
                has_key=p.get("has_key", False),
                synced_at=now,
            )
            db.add(remote)

        await db.commit()
        logger.debug("Updated remote providers for user %s from %s (%d providers)", user_email, source_app, len(providers))


async def _handle_ai_usage(payload: dict) -> None:
    """Process AIUsagePublished — upsert remote usage daily cache."""
    from datetime import date as date_type
    from app.database import AsyncSessionLocal
    from app.models.remote_ai_usage_daily import RemoteAIUsageDaily

    user_email = payload.get("user_email")
    source_app = payload.get("source_app")
    usage_date_str = payload.get("usage_date")
    stats = payload.get("stats", [])

    if not user_email or not source_app or not usage_date_str:
        return

    # Don't process our own events
    if source_app == "markdown-manager":
        return

    try:
        usage_date = date_type.fromisoformat(usage_date_str)
    except ValueError:
        return

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == user_email))
        user = result.scalar_one_or_none()
        if not user:
            return

        now = datetime.now(timezone.utc)
        for stat in stats:
            provider = stat.get("provider", "")
            model = stat.get("model", "")
            if not provider or not model:
                continue

            existing = await db.execute(
                select(RemoteAIUsageDaily).where(
                    RemoteAIUsageDaily.user_id == user.id,
                    RemoteAIUsageDaily.source_app == source_app,
                    RemoteAIUsageDaily.usage_date == usage_date,
                    RemoteAIUsageDaily.provider == provider,
                    RemoteAIUsageDaily.model == model,
                )
            )
            row = existing.scalar_one_or_none()
            if row:
                row.request_count = stat.get("request_count", 0)
                row.input_tokens = stat.get("input_tokens", 0)
                row.output_tokens = stat.get("output_tokens", 0)
                row.error_count = stat.get("error_count", 0)
                row.synced_at = now
            else:
                db.add(RemoteAIUsageDaily(
                    user_id=user.id,
                    source_app=source_app,
                    usage_date=usage_date,
                    provider=provider,
                    model=model,
                    request_count=stat.get("request_count", 0),
                    input_tokens=stat.get("input_tokens", 0),
                    output_tokens=stat.get("output_tokens", 0),
                    error_count=stat.get("error_count", 0),
                    synced_at=now,
                ))

        await db.commit()
        logger.debug("Updated remote usage for user %s from %s (%d stats)", user_email, source_app, len(stats))
