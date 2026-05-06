"""Periodic publisher of AI usage stats to Redis Stream (ai.usage.v1)."""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import date, datetime, timezone

import redis.asyncio as aioredis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.settings import get_settings
from app.database import AsyncSessionLocal
from app.models.ai_usage_daily import AIUsageDaily
from app.models.user import User

logger = logging.getLogger(__name__)

SOURCE_APP = "markdown-manager"
TOPIC = "ai.usage.v1"
PUBLISH_INTERVAL = 300  # 5 minutes


async def publish_usage_stats() -> None:
    """Publish today's usage rollup for all users to the Redis stream."""
    settings = get_settings()
    redis_url = settings.redis_url
    if not redis_url:
        return

    today = date.today()

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(AIUsageDaily, User.email)
            .join(User, AIUsageDaily.user_id == User.id)
            .where(AIUsageDaily.usage_date == today)
        )
        rows = result.all()

    if not rows:
        return

    # Group by user email
    by_user: dict[str, list[dict]] = {}
    for daily, email in rows:
        by_user.setdefault(email, []).append({
            "provider": daily.provider,
            "model": daily.model,
            "request_count": daily.request_count,
            "input_tokens": daily.input_tokens,
            "output_tokens": daily.output_tokens,
            "error_count": daily.error_count,
        })

    try:
        r = aioredis.from_url(redis_url, decode_responses=True)
        try:
            for email, stats in by_user.items():
                event = {
                    "event_id": str(uuid.uuid4()),
                    "event_type": "AIUsagePublished",
                    "topic": TOPIC,
                    "schema_version": "1",
                    "occurred_at": datetime.now(timezone.utc).isoformat(),
                    "aggregate_id": email,
                    "payload": json.dumps({
                        "user_email": email,
                        "source_app": SOURCE_APP,
                        "usage_date": today.isoformat(),
                        "stats": stats,
                    }),
                }
                await r.xadd(TOPIC, event, maxlen=5000)
            logger.info("Published usage stats for %d users", len(by_user))
        finally:
            await r.aclose()
    except Exception as exc:
        logger.warning("Failed to publish usage stats: %s", exc)


async def usage_publish_loop() -> None:
    """Run in a background task — publishes every PUBLISH_INTERVAL seconds."""
    await asyncio.sleep(60)  # Initial delay to let app warm up
    while True:
        try:
            await publish_usage_stats()
        except Exception as exc:
            logger.warning("Usage publish loop error: %s", exc)
        await asyncio.sleep(PUBLISH_INTERVAL)
