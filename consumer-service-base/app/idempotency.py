"""
Idempotency utilities for ensuring exactly-once event processing.

This module provides utilities for:
- Tracking processed events in event_ledger
- Ensuring idempotent message handling
- Checking if events have been processed before
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class IdempotencyTracker:
    """Utility for tracking processed events to ensure idempotent handling."""

    def __init__(self, consumer_group: str, schema: str = "public"):
        """Initialize idempotency tracker."""
        self.consumer_group = consumer_group
        self.schema = schema

    async def is_event_processed(self, session: AsyncSession, event_id: str) -> bool:
        """Check if event has already been processed."""
        try:
            query = text(f"""
                SELECT 1 FROM {self.schema}.event_ledger
                WHERE event_id = :event_id
                AND consumer_group = :consumer_group
            """)

            result = await session.execute(query, {
                "event_id": event_id,
                "consumer_group": self.consumer_group
            })

            return result.scalar() is not None

        except Exception as e:
            logger.error(f"Failed to check event processing status: {e}")
            return False

    async def mark_event_processed(self, session: AsyncSession, event_id: str,
                                 event_type: str, result: str = "success") -> bool:
        """Mark event as processed in the ledger."""
        try:
            # Validate event_id is a proper UUID
            uuid.UUID(event_id)

            query = text(f"""
                INSERT INTO {self.schema}.event_ledger
                (event_id, event_type, consumer_group, processing_result, processed_at)
                VALUES (:event_id, :event_type, :consumer_group, :result, :processed_at)
                ON CONFLICT (event_id) DO UPDATE SET
                    processing_result = EXCLUDED.processing_result,
                    processed_at = EXCLUDED.processed_at
            """)

            await session.execute(query, {
                "event_id": event_id,
                "event_type": event_type,
                "consumer_group": self.consumer_group,
                "result": result,
                "processed_at": datetime.now(timezone.utc)
            })

            return True

        except Exception as e:
            logger.error(f"Failed to mark event as processed: {e}")
            return False

    async def get_processing_stats(self, session: AsyncSession,
                                 hours: int = 24) -> dict:
        """Get processing statistics for the consumer group."""
        try:
            query = text(f"""
                SELECT
                    processing_result,
                    COUNT(*) as count,
                    MIN(processed_at) as first_processed,
                    MAX(processed_at) as last_processed
                FROM {self.schema}.event_ledger
                WHERE consumer_group = :consumer_group
                AND processed_at >= NOW() - INTERVAL '{hours} hours'
                GROUP BY processing_result
                ORDER BY processing_result
            """)

            result = await session.execute(query, {
                "consumer_group": self.consumer_group
            })

            stats = {}
            for row in result:
                stats[row.processing_result] = {
                    "count": row.count,
                    "first_processed": row.first_processed.isoformat() if row.first_processed else None,
                    "last_processed": row.last_processed.isoformat() if row.last_processed else None
                }

            return stats

        except Exception as e:
            logger.error(f"Failed to get processing stats: {e}")
            return {}

    async def cleanup_old_entries(self, session: AsyncSession, days: int = 30) -> int:
        """Clean up old ledger entries (keep only recent ones)."""
        try:
            query = text(f"""
                DELETE FROM {self.schema}.event_ledger
                WHERE consumer_group = :consumer_group
                AND processed_at < NOW() - INTERVAL '{days} days'
            """)

            result = await session.execute(query, {
                "consumer_group": self.consumer_group
            })

            deleted_count = result.rowcount
            logger.info(f"Cleaned up {deleted_count} old ledger entries for {self.consumer_group}")
            return deleted_count

        except Exception as e:
            logger.error(f"Failed to cleanup old entries: {e}")
            return 0


async def ensure_idempotent_processing(session: AsyncSession, event_id: str,
                                     event_type: str, consumer_group: str,
                                     processing_function, schema: str = "public"):
    """
    Decorator-like function to ensure idempotent event processing.

    Args:
        session: Database session
        event_id: Unique event identifier
        event_type: Type of event being processed
        consumer_group: Consumer group identifier
        processing_function: Async function to execute if not already processed
        schema: Database schema containing event_ledger table

    Returns:
        Result of processing_function or None if already processed
    """
    tracker = IdempotencyTracker(consumer_group, schema)

    # Check if already processed
    if await tracker.is_event_processed(session, event_id):
        logger.info(f"Event {event_id} already processed by {consumer_group}, skipping")
        await tracker.mark_event_processed(session, event_id, event_type, "skipped")
        return None

    try:
        # Execute processing function
        result = await processing_function()

        # Mark as successfully processed
        await tracker.mark_event_processed(session, event_id, event_type, "success")
        await session.commit()

        return result

    except Exception as e:
        # Mark as failed
        await tracker.mark_event_processed(session, event_id, event_type, "failure")
        await session.commit()

        logger.error(f"Failed to process event {event_id}: {e}")
        raise