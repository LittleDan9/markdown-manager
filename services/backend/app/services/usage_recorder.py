"""Utility to persist token usage after a chat completion."""
from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_usage_daily import AIUsageDaily
from app.models.chat_token_usage import ChatTokenUsage

logger = logging.getLogger(__name__)


async def record_usage(
    db: AsyncSession,
    *,
    user_id: int,
    provider: str,
    model: str,
    input_tokens: int = 0,
    output_tokens: int = 0,
    scope_type: str = "chat",
    conversation_id: Optional[int] = None,
    error_type: Optional[str] = None,
) -> None:
    """Insert a single usage record and update daily rollup. Errors are logged but never raised."""
    try:
        row = ChatTokenUsage(
            user_id=user_id,
            provider=provider,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            scope_type=scope_type,
            conversation_id=conversation_id,
            error_type=error_type,
        )
        db.add(row)

        # Upsert daily rollup
        today = date.today()
        result = await db.execute(
            select(AIUsageDaily).where(
                AIUsageDaily.user_id == user_id,
                AIUsageDaily.usage_date == today,
                AIUsageDaily.provider == provider,
                AIUsageDaily.model == model,
            )
        )
        daily = result.scalar_one_or_none()
        if daily:
            daily.request_count += 1
            daily.input_tokens += input_tokens
            daily.output_tokens += output_tokens
            daily.error_count += (1 if error_type else 0)
            daily.last_request_at = datetime.now(timezone.utc)
        else:
            daily = AIUsageDaily(
                user_id=user_id,
                usage_date=today,
                provider=provider,
                model=model,
                request_count=1,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                error_count=(1 if error_type else 0),
            )
            db.add(daily)

        await db.commit()
    except Exception as exc:
        logger.warning("Failed to record token usage: %s", exc)
        await db.rollback()
