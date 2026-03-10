"""Outbox relay service for publishing events to Redis Streams."""

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any

import redis.asyncio as redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from .config import Settings

logger = logging.getLogger(__name__)


class OutboxRelay:
    """Relay service for processing outbox events and publishing to Redis Streams."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.engine = None
        self.session_factory = None
        self.redis = None
        self.running = False

    async def initialize(self):
        """Initialize database and Redis connections."""
        # Initialize database connection
        self.engine = create_async_engine(
            self.settings.database_url,
            echo=False,
            pool_pre_ping=True,
            pool_recycle=3600,
        )

        self.session_factory = sessionmaker(
            self.engine, class_=AsyncSession, expire_on_commit=False
        )

        # Initialize Redis connection
        self.redis = redis.from_url(
            self.settings.redis_url,
            decode_responses=True,
            retry_on_timeout=True,
            max_connections=10,
        )

        # Test connections
        await self._test_connections()

    async def _test_connections(self):
        """Test database and Redis connections."""
        # Test database
        async with self.session_factory() as session:
            result = await session.execute(text("SELECT 1"))
            assert result.scalar() == 1
            logger.info("Database connection successful")

        # Test Redis
        await self.redis.ping()
        logger.info("Redis connection successful")

    async def cleanup(self):
        """Clean up connections."""
        if self.redis:
            await self.redis.close()

        if self.engine:
            await self.engine.dispose()

    def is_running(self) -> bool:
        """Check if the relay is currently running."""
        return getattr(self, 'running', False)

    async def run(self, shutdown_flag: asyncio.Event):
        """Main processing loop."""
        self.running = True
        logger.info("Starting outbox relay processing loop")

        while self.running and not shutdown_flag.is_set():
            try:
                # Process a batch of events
                processed_count = await self._process_batch()

                if processed_count > 0:
                    logger.info(f"Processed {processed_count} events")
                else:
                    # No events to process, wait before next poll
                    await asyncio.sleep(self.settings.poll_interval)

            except Exception as e:
                logger.error(f"Error in processing loop: {e}", exc_info=True)
                await asyncio.sleep(self.settings.poll_interval)

        logger.info("Outbox relay processing stopped")

    async def _process_batch(self) -> int:
        """Process a batch of unpublished events."""
        from .metrics import relay_metrics

        async with self.session_factory() as session:
            # Get unpublished events with FOR UPDATE SKIP LOCKED
            events = await self._get_unpublished_events(session, self.settings.batch_size)

            if not events:
                return 0

            processed_count = 0

            for event in events:
                try:
                    # Create event envelope
                    envelope = await self._create_event_envelope(event)

                    # Publish to Redis Stream
                    await self._publish_to_stream(envelope)

                    # Mark as published
                    await self._mark_published(session, event["event_id"])

                    processed_count += 1

                    # Update metrics
                    relay_metrics.increment_published(envelope["topic"])

                    logger.debug(f"Published event {event['event_id']} of type {event['event_type']}")

                except Exception as e:
                    logger.error(f"Failed to process event {event['event_id']}: {e}")

                    # Update failure metrics
                    relay_metrics.increment_failure()
                    relay_metrics.add_error(str(e), event.get("event_id"))

                    # Handle retry logic
                    await self._handle_failed_event(session, event, str(e))

            # Commit all changes
            await session.commit()

            return processed_count

    async def _get_unpublished_events(self, session: AsyncSession, limit: int) -> List[Dict[str, Any]]:
        """Get unpublished events from outbox table."""
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

        result = await session.execute(query, {
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
                "created_at": row.created_at,
                "attempts": row.attempts,
                "next_attempt_at": row.next_attempt_at,
            }
            events.append(event)

        return events

    async def _create_event_envelope(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """Create standardized event envelope."""
        envelope = {
            "event_id": event["event_id"],
            "event_type": event["event_type"],
            "topic": self.settings.stream_name,
            "schema_version": 1,
            "occurred_at": event["created_at"].isoformat() if hasattr(event["created_at"], "isoformat") else event["created_at"],
            "tenant_id": event["payload"].get("tenant_id", "00000000-0000-0000-0000-000000000000"),
            "aggregate_id": event["aggregate_id"],
            "aggregate_type": event["aggregate_type"],
            "payload": event["payload"]
        }

        return envelope

    async def _publish_to_stream(self, envelope: Dict[str, Any]):
        """Publish event envelope to Redis Stream."""
        # Convert envelope to Redis stream format (flat key-value pairs)
        stream_data = {
            "event_id": envelope["event_id"],
            "event_type": envelope["event_type"],
            "topic": envelope["topic"],
            "schema_version": str(envelope["schema_version"]),
            "occurred_at": envelope["occurred_at"],
            "tenant_id": envelope["tenant_id"],
            "aggregate_id": envelope["aggregate_id"],
            "aggregate_type": envelope["aggregate_type"],
            "payload": json.dumps(envelope["payload"])
        }

        # Add to Redis Stream
        stream_id = await self.redis.xadd(
            self.settings.stream_name,
            stream_data,
            maxlen=10000  # Keep last 10k events
        )

        logger.debug(f"Published to stream {self.settings.stream_name} with ID {stream_id}")

    async def _mark_published(self, session: AsyncSession, event_id: str):
        """Mark event as published."""
        query = text("""
            UPDATE identity.outbox
            SET published = TRUE, published_at = :published_at
            WHERE event_id = :event_id
        """)

        await session.execute(query, {
            "event_id": event_id,
            "published_at": datetime.now(timezone.utc)
        })

    async def _handle_failed_event(self, session: AsyncSession, event: Dict[str, Any], error_message: str):
        """Handle failed event with retry logic."""
        attempts = event["attempts"] + 1

        if attempts >= self.settings.max_retry_attempts:
            # Move to DLQ
            logger.warning(f"Moving event {event['event_id']} to DLQ after {attempts} attempts")
            await self._move_to_dlq(event, error_message)
            await self._mark_published(session, event["event_id"])  # Mark as published to stop retries
        else:
            # Schedule retry with exponential backoff
            retry_delay = self.settings.retry_base_delay * (2 ** (attempts - 1))
            next_attempt = datetime.now(timezone.utc).timestamp() + retry_delay
            next_attempt_dt = datetime.fromtimestamp(next_attempt, tz=timezone.utc)

            query = text("""
                UPDATE identity.outbox
                SET attempts = :attempts,
                    next_attempt_at = :next_attempt_at,
                    error_message = :error_message
                WHERE event_id = :event_id
            """)

            await session.execute(query, {
                "event_id": event["event_id"],
                "attempts": attempts,
                "next_attempt_at": next_attempt_dt,
                "error_message": error_message
            })

            logger.info(f"Scheduled retry for event {event['event_id']} in {retry_delay} seconds (attempt {attempts})")

    async def _move_to_dlq(self, event: Dict[str, Any], error_message: str):
        """Move failed event to dead letter queue."""
        from .metrics import relay_metrics

        try:
            # Create DLQ entry
            dlq_data = {
                "original_event_id": event["event_id"],
                "event_type": event["event_type"],
                "aggregate_id": event["aggregate_id"],
                "payload": json.dumps(event["payload"]),
                "error_message": error_message,
                "attempts": str(event["attempts"] + 1),
                "failed_at": datetime.now(timezone.utc).isoformat(),
                "created_at": (event["created_at"].isoformat()
                              if hasattr(event["created_at"], "isoformat")
                              else str(event["created_at"]))
            }

            # Add to DLQ stream
            dlq_id = await self.redis.xadd(
                self.settings.dlq_stream_name,
                dlq_data,
                maxlen=1000  # Keep last 1k failed events
            )

            # Update DLQ metrics
            relay_metrics.increment_dlq(self.settings.stream_name)

            logger.warning(f"Moved event {event['event_id']} to DLQ with ID {dlq_id}")

        except Exception as dlq_error:
            logger.error(f"Failed to move event {event['event_id']} to DLQ: {dlq_error}")