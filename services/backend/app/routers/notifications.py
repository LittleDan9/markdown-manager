"""Notification endpoints — CRUD + create helper for producers."""
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.database import get_db
from app.models.notification import Notification
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/notifications", tags=["notifications"])


# ---------- Schemas ----------

class NotificationOut(BaseModel):
    id: int
    title: str
    message: str
    category: str
    is_read: bool
    link: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationCreate(BaseModel):
    title: str
    message: str
    category: str = "info"
    link: Optional[str] = None


class NotificationList(BaseModel):
    notifications: list[NotificationOut]
    unread_count: int
    total: int


class UnreadCount(BaseModel):
    count: int


# ---------- Service helper (for producers) ----------

async def create_notification(
    db: AsyncSession,
    user_id: int,
    title: str,
    message: str,
    category: str = "info",
    link: str | None = None,
) -> Notification:
    """Create a notification for a user. Call from any backend service or router."""
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        category=category,
        link=link,
    )
    db.add(notification)
    await db.flush()
    return notification


# ---------- Endpoints ----------

@router.post("", response_model=NotificationOut, status_code=status.HTTP_201_CREATED)
async def post_notification(
    body: NotificationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a notification for the current user (self-notify or testing)."""
    notification = await create_notification(
        db,
        user_id=current_user.id,
        title=body.title,
        message=body.message,
        category=body.category,
        link=body.link,
    )
    await db.commit()
    await db.refresh(notification)
    return NotificationOut.model_validate(notification)


@router.get("", response_model=NotificationList)
async def list_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List notifications for the current user."""
    query = select(Notification).where(Notification.user_id == current_user.id)
    if unread_only:
        query = query.where(Notification.is_read == False)  # noqa: E712
    query = query.order_by(Notification.created_at.desc()).limit(limit).offset(offset)

    result = await db.execute(query)
    notifications = result.scalars().all()

    # Unread count
    count_q = select(func.count()).select_from(Notification).where(
        Notification.user_id == current_user.id, Notification.is_read == False  # noqa: E712
    )
    unread_count = (await db.execute(count_q)).scalar() or 0

    # Total count
    total_q = select(func.count()).select_from(Notification).where(
        Notification.user_id == current_user.id
    )
    total = (await db.execute(total_q)).scalar() or 0

    return NotificationList(
        notifications=[NotificationOut.model_validate(n) for n in notifications],
        unread_count=unread_count,
        total=total,
    )


@router.get("/unread-count", response_model=UnreadCount)
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the count of unread notifications."""
    count_q = select(func.count()).select_from(Notification).where(
        Notification.user_id == current_user.id, Notification.is_read == False  # noqa: E712
    )
    count = (await db.execute(count_q)).scalar() or 0
    return UnreadCount(count=count)


@router.patch("/{notification_id}/read")
async def mark_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a single notification as read."""
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id, Notification.user_id == current_user.id
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    notification.is_read = True
    await db.commit()
    return {"success": True}


@router.patch("/read-all")
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark all unread notifications as read."""
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.is_read == False)  # noqa: E712
        .values(is_read=True)
    )
    await db.commit()
    return {"success": True}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a notification."""
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id, Notification.user_id == current_user.id
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    await db.delete(notification)
    await db.commit()
    return {"success": True}


@router.delete("")
async def clear_notifications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete all notifications for the current user."""
    await db.execute(
        delete(Notification).where(Notification.user_id == current_user.id)
    )
    await db.commit()
    return {"success": True}
