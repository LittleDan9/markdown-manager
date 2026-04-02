"""Admin notification broadcasting endpoints."""
import logging
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_admin_user
from app.database import get_db
from app.models.user import User
from app.routers.notifications import create_notification, broadcast_notification

logger = logging.getLogger(__name__)
router = APIRouter()


class AdminNotificationSend(BaseModel):
    title: str
    message: str
    category: str = "info"
    detail: Optional[str] = None
    user_ids: Optional[list[int]] = None  # None = broadcast to all


class AdminNotificationResult(BaseModel):
    success: bool
    recipients: int


@router.post(
    "/send",
    response_model=AdminNotificationResult,
    summary="Send notification to users",
    description=(
        "Send a notification to all active users or a specific set of users. "
        "Supports markdown in the detail field."
    ),
)
async def send_notification(
    body: AdminNotificationSend,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin: send notification to all or specific users."""
    if body.user_ids:
        count = 0
        for uid in body.user_ids:
            await create_notification(
                db=db,
                user_id=uid,
                title=body.title,
                message=body.message,
                category=body.category,
                detail=body.detail,
            )
            count += 1
        await db.commit()
        logger.info(
            "Admin %s sent notification to %d specific user(s): %s",
            current_user.email, count, body.title,
        )
        return AdminNotificationResult(success=True, recipients=count)
    else:
        count = await broadcast_notification(
            db=db,
            title=body.title,
            message=body.message,
            category=body.category,
            detail=body.detail,
        )
        await db.commit()
        logger.info(
            "Admin %s broadcast notification to %d user(s): %s",
            current_user.email, count, body.title,
        )
        return AdminNotificationResult(success=True, recipients=count)
