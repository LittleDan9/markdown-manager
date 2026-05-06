"""AI Usage Stats router — aggregated usage queries for the current user."""
import logging
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.database import get_db
from app.models.ai_usage_daily import AIUsageDaily
from app.models.remote_ai_usage_daily import RemoteAIUsageDaily
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai-usage", tags=["ai-usage"])


@router.get("/stats")
async def get_usage_stats(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get aggregated usage stats for the current user over the given number of days."""
    since = date.today() - timedelta(days=days)

    # Local usage
    local_result = await db.execute(
        select(
            AIUsageDaily.provider,
            AIUsageDaily.model,
            func.sum(AIUsageDaily.request_count).label("request_count"),
            func.sum(AIUsageDaily.input_tokens).label("input_tokens"),
            func.sum(AIUsageDaily.output_tokens).label("output_tokens"),
            func.sum(AIUsageDaily.error_count).label("error_count"),
        )
        .where(
            AIUsageDaily.user_id == current_user.id,
            AIUsageDaily.usage_date >= since,
        )
        .group_by(AIUsageDaily.provider, AIUsageDaily.model)
    )
    local_stats = [
        {
            "source": "markdown-manager",
            "provider": row.provider,
            "model": row.model,
            "request_count": row.request_count or 0,
            "input_tokens": row.input_tokens or 0,
            "output_tokens": row.output_tokens or 0,
            "error_count": row.error_count or 0,
        }
        for row in local_result.all()
    ]

    # Remote usage
    remote_result = await db.execute(
        select(
            RemoteAIUsageDaily.source_app,
            RemoteAIUsageDaily.provider,
            RemoteAIUsageDaily.model,
            func.sum(RemoteAIUsageDaily.request_count).label("request_count"),
            func.sum(RemoteAIUsageDaily.input_tokens).label("input_tokens"),
            func.sum(RemoteAIUsageDaily.output_tokens).label("output_tokens"),
            func.sum(RemoteAIUsageDaily.error_count).label("error_count"),
        )
        .where(
            RemoteAIUsageDaily.user_id == current_user.id,
            RemoteAIUsageDaily.usage_date >= since,
        )
        .group_by(RemoteAIUsageDaily.source_app, RemoteAIUsageDaily.provider, RemoteAIUsageDaily.model)
    )
    remote_stats = [
        {
            "source": row.source_app,
            "provider": row.provider,
            "model": row.model,
            "request_count": row.request_count or 0,
            "input_tokens": row.input_tokens or 0,
            "output_tokens": row.output_tokens or 0,
            "error_count": row.error_count or 0,
        }
        for row in remote_result.all()
    ]

    return {
        "days": days,
        "since": since.isoformat(),
        "stats": local_stats + remote_stats,
    }


@router.get("/daily")
async def get_daily_usage(
    days: int = Query(14, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get daily usage breakdown for charts."""
    since = date.today() - timedelta(days=days)

    result = await db.execute(
        select(
            AIUsageDaily.usage_date,
            AIUsageDaily.provider,
            func.sum(AIUsageDaily.request_count).label("request_count"),
            func.sum(AIUsageDaily.output_tokens).label("output_tokens"),
        )
        .where(
            AIUsageDaily.user_id == current_user.id,
            AIUsageDaily.usage_date >= since,
        )
        .group_by(AIUsageDaily.usage_date, AIUsageDaily.provider)
        .order_by(AIUsageDaily.usage_date)
    )

    return [
        {
            "date": row.usage_date.isoformat(),
            "provider": row.provider,
            "request_count": row.request_count or 0,
            "output_tokens": row.output_tokens or 0,
        }
        for row in result.all()
    ]
