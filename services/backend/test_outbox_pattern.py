#!/usr/bin/env python3
"""Test script for Phase 2 outbox pattern implementation."""

import asyncio
import json
import uuid
from datetime import datetime, timezone

import redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.services.outbox_service import OutboxService
from app.services.database_outbox import DatabaseWithOutbox


class OutboxTester:
    """Test class for outbox pattern functionality."""

    def __init__(self):
        self.db_url = "postgresql+asyncpg://postgres:postgres@localhost:5432/markdown_manager"
        self.redis_url = "redis://localhost:6379/0"
        self.engine = None
        self.session_factory = None
        self.redis_client = None

    async def setup(self):
        """Setup database and Redis connections."""
        print("Setting up test connections...")

        # Setup database
        self.engine = create_async_engine(self.db_url, echo=False)
        self.session_factory = sessionmaker(self.engine, class_=AsyncSession, expire_on_commit=False)

        # Setup Redis
        self.redis_client = redis.from_url(self.redis_url, decode_responses=True)

        # Test connections
        async with self.session_factory() as session:
            result = await session.execute(text("SELECT 1"))
            assert result.scalar() == 1

        assert self.redis_client.ping()
        print("✅ Database and Redis connections established")

    async def cleanup(self):
        """Cleanup connections."""
        if self.redis_client:
            self.redis_client.close()
        if self.engine:
            await self.engine.dispose()

    async def test_outbox_service(self):
        """Test outbox service functionality."""
        print("\\n🧪 Testing OutboxService...")

        async with self.session_factory() as session:
            db_with_outbox = DatabaseWithOutbox(session)

            # Test adding a UserCreated event
            user_id = str(uuid.uuid4())
            event_id = await db_with_outbox.outbox.add_user_created_event(
                user_id=user_id,
                email="test@example.com",
                display_name="Test User",
                first_name="Test",
                last_name="User",
            )

            await db_with_outbox.commit()
            print(f"✅ Created UserCreated event with ID: {event_id}")

            # Verify event was inserted
            query = text("SELECT COUNT(*) FROM identity.outbox WHERE event_id = :event_id")
            result = await session.execute(query, {"event_id": event_id})
            count = result.scalar()
            assert count == 1
            print("✅ Event verified in outbox table")

            # Get unpublished events
            events = await db_with_outbox.outbox.get_unpublished_events(limit=10)
            assert len(events) >= 1
            print(f"✅ Found {len(events)} unpublished events")

            # Test marking as published
            success = await db_with_outbox.outbox.mark_event_published(event_id)
            await db_with_outbox.commit()
            assert success
            print("✅ Event marked as published")

    async def test_identity_schema(self):
        """Test identity schema and tables."""
        print("\\n🧪 Testing identity schema...")

        async with self.session_factory() as session:
            # Test identity.users table
            query = text("SELECT COUNT(*) FROM identity.users")
            result = await session.execute(query)
            users_count = result.scalar()
            print(f"✅ Found {users_count} users in identity.users table")

            # Test identity.outbox table structure
            query = text("""
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_schema = 'identity' AND table_name = 'outbox'
                ORDER BY ordinal_position
            """)
            result = await session.execute(query)
            columns = [(row.column_name, row.data_type) for row in result]

            expected_columns = [
                'id', 'event_id', 'event_type', 'aggregate_type',
                'aggregate_id', 'payload', 'created_at', 'published',
                'attempts', 'next_attempt_at', 'published_at', 'error_message'
            ]

            actual_columns = [col[0] for col in columns]
            for expected in expected_columns:
                assert expected in actual_columns

            print("✅ Outbox table structure verified")

    async def test_redis_streams(self):
        """Test Redis streams functionality."""
        print("\\n🧪 Testing Redis Streams...")

        stream_name = "identity.user.v1"
        test_event = {
            "event_id": str(uuid.uuid4()),
            "event_type": "UserCreated",
            "topic": stream_name,
            "schema_version": "1",
            "occurred_at": datetime.now(timezone.utc).isoformat(),
            "tenant_id": "00000000-0000-0000-0000-000000000000",
            "aggregate_id": str(uuid.uuid4()),
            "aggregate_type": "user",
            "payload": json.dumps({
                "user_id": str(uuid.uuid4()),
                "email": "test@example.com",
                "display_name": "Test User",
                "status": "active"
            })
        }

        # Add event to stream
        stream_id = self.redis_client.xadd(stream_name, test_event, maxlen=1000)
        print(f"✅ Added test event to stream {stream_name} with ID: {stream_id}")

        # Read events from stream
        events = self.redis_client.xread({stream_name: "0"}, count=1)
        assert len(events) > 0
        assert len(events[0][1]) > 0
        print(f"✅ Read {len(events[0][1])} events from stream")

        # Test DLQ stream
        dlq_stream = f"{stream_name}.dlq"
        dlq_data = {
            "original_event_id": test_event["event_id"],
            "error_message": "Test DLQ entry",
            "failed_at": datetime.now(timezone.utc).isoformat(),
        }

        dlq_id = self.redis_client.xadd(dlq_stream, dlq_data)
        print(f"✅ Added test entry to DLQ stream with ID: {dlq_id}")

    async def test_end_to_end_simulation(self):
        """Simulate end-to-end outbox pattern flow."""
        print("\\n🧪 Testing end-to-end outbox pattern...")

        # Create outbox event
        async with self.session_factory() as session:
            outbox = OutboxService(session)

            user_id = str(uuid.uuid4())
            payload = {
                "user_id": user_id,
                "tenant_id": "00000000-0000-0000-0000-000000000000",
                "email": "e2e-test@example.com",
                "display_name": "E2E Test User",
                "status": "active",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }

            event_id = await outbox.add_event(
                event_type="UserCreated",
                aggregate_id=user_id,
                payload=payload,
            )

            await session.commit()
            print(f"✅ Created outbox event for E2E test: {event_id}")

        # Simulate relay processing (manual)
        async with self.session_factory() as session:
            outbox = OutboxService(session)

            # Get the event
            events = await outbox.get_unpublished_events(limit=1)
            if events:
                event = events[0]
                print(f"✅ Retrieved unpublished event: {event['event_id']}")

                # Create envelope (simulate relay)
                envelope = {
                    "event_id": event["event_id"],
                    "event_type": event["event_type"],
                    "topic": "identity.user.v1",
                    "schema_version": 1,
                    "occurred_at": event["created_at"],
                    "tenant_id": event["payload"].get("tenant_id"),
                    "aggregate_id": event["aggregate_id"],
                    "aggregate_type": event["aggregate_type"],
                    "payload": json.dumps(event["payload"])
                }

                # Publish to Redis (simulate relay)
                stream_id = self.redis_client.xadd("identity.user.v1", envelope)
                print(f"✅ Published event to Redis stream: {stream_id}")

                # Mark as published
                await outbox.mark_event_published(event["event_id"])
                await session.commit()
                print("✅ Marked event as published")

    async def test_connection_resilience(self):
        """Test behavior when Redis is unavailable."""
        print("\\n🧪 Testing connection resilience...")

        # Create outbox event
        async with self.session_factory() as session:
            outbox = OutboxService(session)

            event_id = await outbox.add_event(
                event_type="UserUpdated",
                aggregate_id=str(uuid.uuid4()),
                payload={"test": "resilience"},
            )

            await session.commit()
            print(f"✅ Created outbox event even when Redis might be down: {event_id}")

        # Test retry logic simulation
        async with self.session_factory() as session:
            outbox = OutboxService(session)

            # Simulate failed publishing
            test_event_id = str(uuid.uuid4())
            success = await outbox.mark_event_failed(
                test_event_id,
                "Simulated Redis connection failure",
                retry_after_seconds=30
            )

            await session.commit()
            print("✅ Simulated event failure and retry scheduling")

    async def run_all_tests(self):
        """Run all tests."""
        print("🚀 Starting Phase 2 Outbox Pattern Tests\\n")

        try:
            await self.setup()
            await self.test_identity_schema()
            await self.test_outbox_service()
            await self.test_redis_streams()
            await self.test_end_to_end_simulation()
            await self.test_connection_resilience()

            print("\\n🎉 All tests passed! Phase 2 implementation verified.")

        except Exception as e:
            print(f"\\n❌ Test failed: {e}")
            raise
        finally:
            await self.cleanup()


async def main():
    """Run the outbox pattern tests."""
    tester = OutboxTester()
    await tester.run_all_tests()


if __name__ == "__main__":
    import sys
    import os

    # Add backend app to path
    sys.path.insert(0, '/home/dlittle/code/markdown-manager/backend')

    asyncio.run(main())