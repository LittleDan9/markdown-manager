"""Outbox service for event publishing pattern."""

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel


class OutboxEvent(BaseModel):
    """Outbox event data model."""
    event_id: str
    event_type: str
    aggregate_type: str
    aggregate_id: str
    payload: Dict[str, Any]
    tenant_id: str = "00000000-0000-0000-0000-000000000000"
    correlation_id: Optional[str] = None


class OutboxService:
    """Service for managing outbox events."""

    def __init__(self, db_session: AsyncSession):
        self.db = db_session

    async def add_event(
        self,
        event_type: str,
        aggregate_id: str,
        payload: Dict[str, Any],
        aggregate_type: str = "user",
        tenant_id: str = "00000000-0000-0000-0000-000000000000",
        correlation_id: Optional[str] = None,
    ) -> str:
        """Add an event to the outbox table.

        Args:
            event_type: Type of event (e.g., UserCreated, UserUpdated)
            aggregate_id: ID of the aggregate that generated the event
            payload: Event payload data
            aggregate_type: Type of aggregate (default: user)
            tenant_id: Tenant identifier for multi-tenancy
            correlation_id: Optional correlation ID for request tracing

        Returns:
            str: The generated event ID
        """
        event_id = str(uuid.uuid4())

        # Insert into outbox table
        query = text("""
            INSERT INTO identity.outbox (
                event_id, event_type, aggregate_type, aggregate_id,
                payload, created_at, published, attempts
            ) VALUES (
                :event_id, :event_type, :aggregate_type, :aggregate_id,
                :payload, :created_at, :published, :attempts
            )
        """)

        await self.db.execute(query, {
            "event_id": event_id,
            "event_type": event_type,
            "aggregate_type": aggregate_type,
            "aggregate_id": aggregate_id,
            "payload": json.dumps(payload),
            "created_at": datetime.now(timezone.utc),
            "published": False,
            "attempts": 0
        })

        return event_id

    async def add_user_created_event(
        self,
        user_id: str,
        email: str,
        display_name: Optional[str] = None,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        is_verified: bool = False,
        is_admin: bool = False,
        mfa_enabled: bool = False,
        tenant_id: str = "00000000-0000-0000-0000-000000000000",
        correlation_id: Optional[str] = None,
    ) -> str:
        """Add a UserCreated event to the outbox."""
        payload = {
            "user_id": user_id,
            "tenant_id": tenant_id,
            "email": email,
            "display_name": display_name,
            "first_name": first_name,
            "last_name": last_name,
            "status": "active",
            "is_verified": is_verified,
            "is_admin": is_admin,
            "mfa_enabled": mfa_enabled,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        return await self.add_event(
            event_type="UserCreated",
            aggregate_id=user_id,
            payload=payload,
            tenant_id=tenant_id,
            correlation_id=correlation_id,
        )

    async def add_user_updated_event(
        self,
        user_id: str,
        email: str,
        display_name: Optional[str] = None,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        is_verified: bool = False,
        is_admin: bool = False,
        mfa_enabled: bool = False,
        changed_fields: list[str] = None,
        tenant_id: str = "00000000-0000-0000-0000-000000000000",
        correlation_id: Optional[str] = None,
    ) -> str:
        """Add a UserUpdated event to the outbox."""
        payload = {
            "user_id": user_id,
            "tenant_id": tenant_id,
            "email": email,
            "display_name": display_name,
            "first_name": first_name,
            "last_name": last_name,
            "status": "active",  # Will be set correctly by caller
            "is_verified": is_verified,
            "is_admin": is_admin,
            "mfa_enabled": mfa_enabled,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "changed_fields": changed_fields or [],
        }

        return await self.add_event(
            event_type="UserUpdated",
            aggregate_id=user_id,
            payload=payload,
            tenant_id=tenant_id,
            correlation_id=correlation_id,
        )

    async def add_user_disabled_event(
        self,
        user_id: str,
        email: str,
        display_name: Optional[str] = None,
        disabled_by: str = "",
        reason: str = "admin_action",
        tenant_id: str = "00000000-0000-0000-0000-000000000000",
        correlation_id: Optional[str] = None,
    ) -> str:
        """Add a UserDisabled event to the outbox."""
        payload = {
            "user_id": user_id,
            "tenant_id": tenant_id,
            "email": email,
            "display_name": display_name,
            "disabled_at": datetime.now(timezone.utc).isoformat(),
            "disabled_by": disabled_by,
            "reason": reason,
        }

        return await self.add_event(
            event_type="UserDisabled",
            aggregate_id=user_id,
            payload=payload,
            tenant_id=tenant_id,
            correlation_id=correlation_id,
        )

    async def get_unpublished_events(self, limit: int = 100) -> list[Dict[str, Any]]:
        """Get unpublished events from the outbox.

        Args:
            limit: Maximum number of events to return

        Returns:
            List of unpublished events
        """
        query = text("""
            SELECT id, event_id, event_type, aggregate_type, aggregate_id,
                   payload, created_at, attempts, next_attempt_at
            FROM identity.outbox
            WHERE published = FALSE
              AND (next_attempt_at IS NULL OR next_attempt_at <= :now)
            ORDER BY created_at ASC
            LIMIT :limit
            FOR UPDATE SKIP LOCKED
        """)

        result = await self.db.execute(query, {
            "now": datetime.now(timezone.utc),
            "limit": limit
        })

        events = []
        for row in result:
            event = {
                "id": row.id,
                "event_id": str(row.event_id),
                "event_type": row.event_type,
                "aggregate_type": row.aggregate_type,
                "aggregate_id": str(row.aggregate_id),
                "payload": json.loads(row.payload) if isinstance(row.payload, str) else row.payload,
                "created_at": row.created_at.isoformat(),
                "attempts": row.attempts,
                "next_attempt_at": row.next_attempt_at.isoformat() if row.next_attempt_at else None,
            }
            events.append(event)

        return events

    async def mark_event_published(self, event_id: str) -> bool:
        """Mark an event as published.

        Args:
            event_id: ID of the event to mark as published

        Returns:
            bool: True if event was found and marked, False otherwise
        """
        query = text("""
            UPDATE identity.outbox
            SET published = TRUE, published_at = :published_at
            WHERE event_id = :event_id AND published = FALSE
        """)

        result = await self.db.execute(query, {
            "event_id": event_id,
            "published_at": datetime.now(timezone.utc)
        })

        return result.rowcount > 0

    async def mark_event_failed(
        self,
        event_id: str,
        error_message: str,
        retry_after_seconds: int = 60
    ) -> bool:
        """Mark an event as failed and schedule retry.

        Args:
            event_id: ID of the event that failed
            error_message: Error message describing the failure
            retry_after_seconds: Seconds to wait before retry

        Returns:
            bool: True if event was found and updated, False otherwise
        """
        query = text("""
            UPDATE identity.outbox
            SET attempts = attempts + 1,
                next_attempt_at = :next_attempt_at,
                error_message = :error_message
            WHERE event_id = :event_id AND published = FALSE
        """)

        next_attempt_at = datetime.now(timezone.utc).timestamp() + retry_after_seconds
        next_attempt_dt = datetime.fromtimestamp(next_attempt_at, tz=timezone.utc)

        result = await self.db.execute(query, {
            "event_id": event_id,
            "next_attempt_at": next_attempt_dt,
            "error_message": error_message
        })

        return result.rowcount > 0