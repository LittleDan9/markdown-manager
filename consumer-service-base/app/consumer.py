"""Configurable Redis Streams consumer."""

import asyncio
import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

import redis.asyncio as redis
from sqlalchemy.ext.asyncio import AsyncSession

from .database import DatabaseManager
from events_core.models.envelope_v1 import EventEnvelopeV1

# Import validators and constants
try:
    from events_core.validators import EventValidator, EventTypes
except ImportError:
    # Fallback if validators not available
    class EventValidator:
        def validate_event(self, event_data):
            return True

    class EventTypes:
        USER_CREATED = "user.created.v1"
        USER_UPDATED = "user.updated.v1"
        USER_DISABLED = "user.disabled.v1"

# Import event models from top-level events_core package
try:
    from events_core import UserCreated as UserCreatedEvent
    from events_core import UserUpdated as UserUpdatedEvent
    from events_core import UserDisabled as UserDisabledEvent
    EVENT_MODELS_AVAILABLE = True
except ImportError as e:
    # Will be initialized after logger
    EVENT_MODELS_AVAILABLE = False
    _import_error = e

logger = logging.getLogger(__name__)

# Log import error if models not available
if not EVENT_MODELS_AVAILABLE:
    logger.warning(f"Event models not available: {_import_error}. Using dynamic loading.")


class ConfigurableConsumer:
    """Configurable consumer for Redis Streams events."""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.service_config = config['service']
        self.redis_config = config['redis']
        self.topics = config.get('topics', [])
        self.domain = self.service_config['domain']

        self.redis_client = None
        self.db_manager = None
        self.event_validator = EventValidator()
        self._running = False

        # Extract database URL from environment
        import os
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            raise ValueError("DATABASE_URL environment variable is required")

        # Create simplified db config with just schema
        db_config = {
            'schema': self.service_config['schema'],
            'tables': {}  # No explicit table config - will be auto-created
        }
        self.db_manager = DatabaseManager(database_url, db_config)

        # Auto-discover event handlers based on domain and topics
        self.event_handlers = self._discover_event_handlers()

    def _discover_event_handlers(self) -> Dict[str, str]:
        """Auto-discover event handlers based on domain and topics."""
        handlers = {}

        # For each topic, map the events to domain-specific handlers
        for topic in self.topics:
            if topic == "identity.user.v1":
                handlers.update({
                    "user.created.v1": f"handle_{self.domain}_user_created",
                    "user.updated.v1": f"handle_{self.domain}_user_updated",
                    "user.disabled.v1": f"handle_{self.domain}_user_disabled"
                })
            # Add more topics as needed

        logger.info(f"Auto-discovered handlers for {self.domain} from topics {self.topics}: {list(handlers.keys())}")
        return handlers

    async def initialize(self):
        """Initialize Redis and database connections."""
        # Initialize Redis client
        redis_url = os.getenv('REDIS_URL', 'redis://redis:6379/0')
        self.redis_client = redis.from_url(
            redis_url,
            decode_responses=True,
            health_check_interval=30
        )

        # Test Redis connection
        await self.redis_client.ping()
        logger.info("Redis connection established")

        # Initialize database
        await self.db_manager.initialize()

        # Create consumer group if it doesn't exist
        await self._ensure_consumer_group()

    async def cleanup(self):
        """Cleanup connections."""
        self._running = False

        if self.redis_client:
            await self.redis_client.close()
            logger.info("Redis connection closed")

        if self.db_manager:
            await self.db_manager.cleanup()

    async def _ensure_consumer_group(self):
        """Ensure consumer group exists for all topics."""
        consumer_group = self.config['consumer_group']

        for topic in self.topics:
            try:
                await self.redis_client.xgroup_create(
                    topic,
                    consumer_group,
                    id="$",
                    mkstream=True
                )
                logger.info(f"Created consumer group '{consumer_group}' for topic '{topic}'")
            except redis.ResponseError as e:
                if "BUSYGROUP" in str(e):
                    logger.info(f"Consumer group '{consumer_group}' already exists for topic '{topic}'")
                else:
                    raise

    async def run(self, shutdown_flag: asyncio.Event):
        """Main consumer loop."""
        self._running = True
        consumer_group = self.config['consumer_group']
        consumer_name = f"{self.service_config['name']}-{os.getpid()}"

        logger.info(f"Starting {self.service_config['name']} consumer loop as '{consumer_name}'")

        while not shutdown_flag.is_set() and self._running:
            try:
                # Read events from all topics
                topic_streams = {topic: ">" for topic in self.topics}
                events = await self.redis_client.xreadgroup(
                    consumer_group,
                    consumer_name,
                    topic_streams,
                    count=10,
                    block=1000
                )

                if events:
                    await self._process_batch(events)

            except redis.ConnectionError as e:
                logger.error(f"Redis connection error: {e}")
                await asyncio.sleep(5)  # Wait before retrying
            except Exception as e:
                logger.error(f"Error in consumer loop: {e}", exc_info=True)
                await asyncio.sleep(1)

        logger.info("Consumer loop stopped")

    async def _process_batch(self, events: List[Any]):
        """Process a batch of events from multiple topics."""
        consumer_group = self.config['consumer_group']

        # events format: [(topic_name, [(event_id, fields), ...])]
        for topic_name, topic_events in events:
            for event_id, fields in topic_events:
                try:
                    await self._process_event(event_id, fields)

                    # Acknowledge successful processing
                    await self.redis_client.xack(
                        topic_name,
                        consumer_group,
                        event_id
                    )

                    logger.debug(f"Successfully processed and acknowledged event {event_id}")

                except Exception as e:
                    logger.error(f"Failed to process event {event_id}: {e}", exc_info=True)
                    # Event will remain unacknowledged and can be retried

    async def _process_event(self, event_id: str, fields: Dict[str, str]):
        """Process a single event."""
        # Reconstruct event envelope from Redis stream fields
        try:
            # Parse payload JSON
            payload_str = fields.get("payload", "{}")
            payload_data = json.loads(payload_str)

            # Reconstruct the event envelope
            event_data = {
                "event_id": fields.get("event_id"),
                "event_type": fields.get("event_type"),
                "topic": fields.get("topic"),
                "schema_version": int(fields.get("schema_version", 1)),
                "occurred_at": fields.get("occurred_at"),
                "tenant_id": fields.get("tenant_id"),
                "aggregate_id": fields.get("aggregate_id"),
                "aggregate_type": fields.get("aggregate_type"),
                "payload": payload_data
            }
        except (json.JSONDecodeError, ValueError) as e:
            logger.error(f"Failed to parse event data for {event_id}: {e}")
            return

        # For now, skip complex validation and just parse the data directly
        # TODO: Implement proper event validation with events_core
        envelope_data = {
            "event_id": event_data["event_id"],
            "event_type": event_data["event_type"],
            "topic": event_data["topic"],
            "schema_version": event_data["schema_version"],
            "occurred_at": event_data["occurred_at"],
            "tenant_id": event_data["tenant_id"],
            "aggregate_id": event_data["aggregate_id"],
            "aggregate_type": event_data["aggregate_type"]
        }

        # Create simple envelope and payload objects
        from types import SimpleNamespace
        envelope = SimpleNamespace(**envelope_data)
        payload = SimpleNamespace(**event_data["payload"])

        # Process the event in a database transaction
        session_gen = self.db_manager.get_session()
        session = await session_gen.__anext__()
        try:
            # Check if event already processed (idempotency)
            if await self.db_manager.check_event_processed(session, envelope.event_id):
                logger.info(f"Event {envelope.event_id} already processed, skipping")
                return

            # Process based on event type and configuration
            handler_name = self.event_handlers.get(envelope.event_type)
            if not handler_name:
                logger.warning(f"No handler configured for event type: {envelope.event_type}")
                return

            await self._handle_event(session, envelope, payload, handler_name)

            # Record event as processed
            await self.db_manager.record_event_processed(
                session,
                envelope.event_id,
                datetime.utcnow()
            )

            # Commit transaction
            await session.commit()

            logger.info(f"Processed {envelope.event_type} event for user {payload.user_id}")

        except Exception as e:
            await session.rollback()
            raise e
        finally:
            await session.close()

    async def _handle_event(self, session: AsyncSession, envelope, payload, handler_name: str):
        """Handle event by calling domain-specific handler."""

        # Try to call the domain-specific handler
        if hasattr(self, handler_name):
            handler_method = getattr(self, handler_name)
            await handler_method(session, envelope, payload)
        else:
            # Default handling - just update identity projection for user events
            if envelope.event_type.startswith('user.'):
                status = 'disabled' if envelope.event_type == 'user.disabled.v1' else 'active'

                await self.db_manager.upsert_identity_projection(
                    session,
                    tenant_id=getattr(payload, 'tenant_id', None),
                    user_id=getattr(payload, 'user_id', None),
                    email=getattr(payload, 'email', None),
                    display_name=getattr(payload, 'display_name', None),
                    status=status,
                    updated_at=self._parse_timestamp(envelope, payload)
                )

    def _parse_timestamp(self, envelope, payload):
        """Parse timestamp from event data."""
        if envelope.event_type == EventTypes.USER_CREATED:
            timestamp_str = getattr(payload, 'created_at', envelope.occurred_at)
        elif envelope.event_type == EventTypes.USER_UPDATED:
            timestamp_str = getattr(payload, 'updated_at', envelope.occurred_at)
        elif envelope.event_type == EventTypes.USER_DISABLED:
            timestamp_str = getattr(payload, 'disabled_at', envelope.occurred_at)
        else:
            timestamp_str = envelope.occurred_at

        if timestamp_str:
            return datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        return datetime.utcnow()
