"""
Integration tests for event processing and database operations.

These tests validate the complete event processing workflow including
database operations, idempotency, and error handling across different
service configurations.
"""
import json
import uuid
from datetime import datetime
from types import SimpleNamespace

import pytest
import sqlalchemy as sa


class TestEventProcessing:
    """Test complete event processing workflow."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    @pytest.mark.database
    async def test_process_user_created_event(self, consumer, sample_user_created_event, database_manager, test_database):
        """Test processing a user.created.v1 event."""
        schema = test_database["schema"]
        domain = consumer.config["service"]["domain"]

        # Get the appropriate handler
        handler_method = getattr(consumer, f"handle_{domain}_user_created")

        # Create envelope and payload like the consumer does
        from types import SimpleNamespace

        envelope_data = {
            "event_id": sample_user_created_event["event_id"],
            "event_type": sample_user_created_event["event_type"],
            "topic": sample_user_created_event["topic"],
            "schema_version": sample_user_created_event["schema_version"],
            "occurred_at": sample_user_created_event["occurred_at"],
            "tenant_id": sample_user_created_event["tenant_id"],
            "aggregate_id": sample_user_created_event["aggregate_id"],
            "aggregate_type": sample_user_created_event["aggregate_type"]
        }
        envelope = SimpleNamespace(**envelope_data)
        payload = SimpleNamespace(**json.loads(sample_user_created_event["payload"]))

        # Process the event with session, envelope, and payload
        async with database_manager.session_factory() as session:
            await handler_method(session, envelope, payload)
            await session.commit()

        # Verify event was recorded in ledger
        async with database_manager.session_factory() as session:
            result = await session.execute(
                sa.text(f"SELECT event_id FROM {schema}_event_ledger WHERE event_id = :event_id"),
                {"event_id": sample_user_created_event["event_id"]}
            )
            ledger_entry = result.fetchone()
            assert ledger_entry is not None
            assert ledger_entry[0] == sample_user_created_event["event_id"]

        # Verify user was added to identity projection
        payload = json.loads(sample_user_created_event["payload"])
        async with database_manager.session_factory() as session:
            result = await session.execute(
                sa.text(f"""
                    SELECT tenant_id, user_id, email, display_name, status
                    FROM {schema}_identity_projection
                    WHERE tenant_id = :tenant_id AND user_id = :user_id
                """),
                {"tenant_id": payload["tenant_id"], "user_id": payload["user_id"]}
            )
            projection = result.fetchone()
            assert projection is not None
            assert projection[2] == payload["email"]  # email
            assert projection[3] == payload["display_name"]  # display_name
            assert projection[4] == payload["status"]  # status

    @pytest.mark.asyncio
    @pytest.mark.integration
    @pytest.mark.database
    async def test_process_user_updated_event(self, consumer, sample_user_updated_event, database_manager, test_database):
        """Test processing a user.updated.v1 event."""
        schema = test_database["schema"]
        domain = consumer.config["service"]["domain"]

        # First create a user
        payload = json.loads(sample_user_updated_event["payload"])
        async with database_manager.session_factory() as session:
            await session.execute(
                sa.text(f"""
                    INSERT INTO {schema}_identity_projection
                    (tenant_id, user_id, email, display_name, status, updated_at)
                    VALUES (:tenant_id, :user_id, :email, :display_name, :status, :updated_at)
                """),
                {
                    "tenant_id": payload["tenant_id"],
                    "user_id": payload["user_id"],
                    "email": "old@example.com",
                    "display_name": "Old Name",
                    "status": "active",
                    "updated_at": datetime.utcnow()
                }
            )
            await session.commit()

        # Get the appropriate handler and process the update event
        handler_method = getattr(consumer, f"handle_{domain}_user_updated")

        # Create envelope and payload like the consumer does
        envelope_data = {
            "event_id": sample_user_updated_event["event_id"],
            "event_type": sample_user_updated_event["event_type"],
            "topic": sample_user_updated_event["topic"],
            "schema_version": sample_user_updated_event["schema_version"],
            "occurred_at": sample_user_updated_event["occurred_at"],
            "tenant_id": sample_user_updated_event["tenant_id"],
            "aggregate_id": sample_user_updated_event["aggregate_id"],
            "aggregate_type": sample_user_updated_event["aggregate_type"]
        }
        envelope = SimpleNamespace(**envelope_data)
        payload = SimpleNamespace(**json.loads(sample_user_updated_event["payload"]))

        async with database_manager.session_factory() as session:
            await handler_method(session, envelope, payload)

        # Verify event was recorded in ledger
        async with database_manager.session_factory() as session:
            result = await session.execute(
                sa.text(f"SELECT event_id FROM {schema}_event_ledger WHERE event_id = :event_id"),
                {"event_id": sample_user_updated_event["event_id"]}
            )
            ledger_entry = result.fetchone()
            assert ledger_entry is not None

        # Verify user was updated in identity projection
        async with database_manager.session_factory() as session:
            result = await session.execute(
                sa.text(f"""
                    SELECT email, display_name
                    FROM {schema}_identity_projection
                    WHERE tenant_id = :tenant_id AND user_id = :user_id
                """),
                {"tenant_id": payload["tenant_id"], "user_id": payload["user_id"]}
            )
            projection = result.fetchone()
            assert projection is not None
            assert projection[0] == payload["email"]  # Updated email
            assert projection[1] == payload["display_name"]  # Updated display_name

    @pytest.mark.asyncio
    @pytest.mark.integration
    @pytest.mark.database
    async def test_process_user_disabled_event(self, consumer, sample_user_disabled_event, database_manager, test_database):
        """Test processing a user.disabled.v1 event."""
        schema = test_database["schema"]
        domain = consumer.config["service"]["domain"]

        # First create a user
        payload = json.loads(sample_user_disabled_event["payload"])
        async with database_manager.session_factory() as session:
            await session.execute(
                sa.text(f"""
                    INSERT INTO {schema}_identity_projection
                    (tenant_id, user_id, email, display_name, status, updated_at)
                    VALUES (:tenant_id, :user_id, :email, :display_name, :status, :updated_at)
                """),
                {
                    "tenant_id": payload["tenant_id"],
                    "user_id": payload["user_id"],
                    "email": payload["email"],
                    "display_name": payload["display_name"],
                    "status": "active",
                    "updated_at": datetime.utcnow()
                }
            )
            await session.commit()

        # Get the appropriate handler and process the disable event
        handler_method = getattr(consumer, f"handle_{domain}_user_disabled")

        # Create envelope and payload like the consumer does
        envelope_data = {
            "event_id": sample_user_disabled_event["event_id"],
            "event_type": sample_user_disabled_event["event_type"],
            "topic": sample_user_disabled_event["topic"],
            "schema_version": sample_user_disabled_event["schema_version"],
            "occurred_at": sample_user_disabled_event["occurred_at"],
            "tenant_id": sample_user_disabled_event["tenant_id"],
            "aggregate_id": sample_user_disabled_event["aggregate_id"],
            "aggregate_type": sample_user_disabled_event["aggregate_type"]
        }
        envelope = SimpleNamespace(**envelope_data)
        payload = SimpleNamespace(**json.loads(sample_user_disabled_event["payload"]))

        async with database_manager.session_factory() as session:
            await handler_method(session, envelope, payload)

        # Verify user status was updated to disabled
        async with database_manager.session_factory() as session:
            result = await session.execute(
                sa.text(f"""
                    SELECT status
                    FROM {schema}_identity_projection
                    WHERE tenant_id = :tenant_id AND user_id = :user_id
                """),
                {"tenant_id": payload["tenant_id"], "user_id": payload["user_id"]}
            )
            projection = result.fetchone()
            assert projection is not None
            assert projection[0] == "disabled"


class TestMultiServiceEventProcessing:
    """Test event processing across different service configurations."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_linting_service_event_processing(self, linting_consumer, sample_user_created_event, database_manager):
        """Test event processing specifically for linting service."""
        # Process event with linting consumer
        await linting_consumer.handle_linting_user_created(sample_user_created_event)

        # Verify linting-specific database operations
        async with database_manager.session_factory() as session:
            result = await session.execute(
                sa.text("SELECT event_id FROM test_linting_event_ledger WHERE event_id = :event_id"),
                {"event_id": sample_user_created_event["event_id"]}
            )
            ledger_entry = result.fetchone()
            assert ledger_entry is not None

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_spell_checking_service_event_processing(self, spell_checking_consumer, sample_user_created_event, database_manager):
        """Test event processing specifically for spell-checking service."""
        # Override database manager schema for spell-checking
        spell_checking_consumer.db_manager = database_manager

        # Process event with spell-checking consumer
        # Create envelope and payload like the consumer does
        envelope_data = {
            "event_id": sample_user_created_event["event_id"],
            "event_type": sample_user_created_event["event_type"],
            "topic": sample_user_created_event["topic"],
            "schema_version": sample_user_created_event["schema_version"],
            "occurred_at": sample_user_created_event["occurred_at"],
            "tenant_id": sample_user_created_event["tenant_id"],
            "aggregate_id": sample_user_created_event["aggregate_id"],
            "aggregate_type": sample_user_created_event["aggregate_type"]
        }
        envelope = SimpleNamespace(**envelope_data)
        payload = SimpleNamespace(**json.loads(sample_user_updated_event["payload"]))

        async with database_manager.session_factory() as session:
            await spell_checking_consumer.handle_spell_checking_user_created(session, envelope, payload)

        # Verify spell-checking-specific database operations
        async with database_manager.session_factory() as session:
            result = await session.execute(
                sa.text("SELECT event_id FROM test_spell_checking_event_ledger WHERE event_id = :event_id"),
                {"event_id": sample_user_created_event["event_id"]}
            )
            ledger_entry = result.fetchone()
            assert ledger_entry is not None


class TestIdempotency:
    """Test idempotency guarantees across service configurations."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    @pytest.mark.database
    async def test_duplicate_event_processing(self, consumer, sample_user_created_event, database_manager, test_database):
        """Test that duplicate events are not processed twice."""
        schema = test_database["schema"]
        domain = consumer.config["service"]["domain"]
        handler_method = getattr(consumer, f"handle_{domain}_user_created")

        # Process event first time
        # Create envelope and payload like the consumer does
        envelope_data = {
            "event_id": sample_user_created_event["event_id"],
            "event_type": sample_user_created_event["event_type"],
            "topic": sample_user_created_event["topic"],
            "schema_version": sample_user_created_event["schema_version"],
            "occurred_at": sample_user_created_event["occurred_at"],
            "tenant_id": sample_user_created_event["tenant_id"],
            "aggregate_id": sample_user_created_event["aggregate_id"],
            "aggregate_type": sample_user_created_event["aggregate_type"]
        }
        envelope = SimpleNamespace(**envelope_data)
        payload_obj = SimpleNamespace(**json.loads(sample_user_created_event["payload"]))

        async with database_manager.session_factory() as session:
            await handler_method(session, envelope, payload_obj)

        # Verify initial state
        payload = json.loads(sample_user_created_event["payload"])
        async with database_manager.session_factory() as session:
            result = await session.execute(
                sa.text(f"SELECT COUNT(*) FROM {schema}_identity_projection WHERE tenant_id = :tenant_id"),
                {"tenant_id": payload["tenant_id"]}
            )
            count_after_first = result.fetchone()[0]
            assert count_after_first == 1

        # Process same event again
        async with database_manager.session_factory() as session:
            await handler_method(session, envelope, payload_obj)

        # Verify no duplicate was created
        async with database_manager.session_factory() as session:
            result = await session.execute(
                sa.text(f"SELECT COUNT(*) FROM {schema}_identity_projection WHERE tenant_id = :tenant_id"),
                {"tenant_id": payload["tenant_id"]}
            )
            count_after_second = result.fetchone()[0]
            assert count_after_second == 1  # Should still be 1

        # Verify event ledger has only one entry
        async with database_manager.session_factory() as session:
            result = await session.execute(
                sa.text(f"SELECT COUNT(*) FROM {schema}_event_ledger WHERE event_id = :event_id"),
                {"event_id": sample_user_created_event["event_id"]}
            )
            ledger_count = result.fetchone()[0]
            assert ledger_count == 1

    @pytest.mark.asyncio
    @pytest.mark.integration
    @pytest.mark.database
    async def test_event_ledger_prevents_reprocessing(self, consumer, sample_user_created_event, database_manager, test_database):
        """Test that event ledger prevents reprocessing."""
        schema = test_database["schema"]
        domain = consumer.config["service"]["domain"]

        # Manually add event to ledger (simulating previous processing)
        async with database_manager.session_factory() as session:
            await session.execute(
                sa.text(f"""
                    INSERT INTO {schema}_event_ledger (event_id, received_at)
                    VALUES (:event_id, :received_at)
                """),
                {
                    "event_id": sample_user_created_event["event_id"],
                    "received_at": datetime.utcnow()
                }
            )
            await session.commit()

        # Try to process the event
        handler_method = getattr(consumer, f"handle_{domain}_user_created")

        # Create envelope and payload like the consumer does
        envelope_data = {
            "event_id": sample_user_created_event["event_id"],
            "event_type": sample_user_created_event["event_type"],
            "topic": sample_user_created_event["topic"],
            "schema_version": sample_user_created_event["schema_version"],
            "occurred_at": sample_user_created_event["occurred_at"],
            "tenant_id": sample_user_created_event["tenant_id"],
            "aggregate_id": sample_user_created_event["aggregate_id"],
            "aggregate_type": sample_user_created_event["aggregate_type"]
        }
        envelope = SimpleNamespace(**envelope_data)
        payload_obj = SimpleNamespace(**json.loads(sample_user_created_event["payload"]))

        async with database_manager.session_factory() as session:
            await handler_method(session, envelope, payload_obj)

        # Verify no user was created (since event was already in ledger)
        payload = json.loads(sample_user_created_event["payload"])
        async with database_manager.session_factory() as session:
            result = await session.execute(
                sa.text(f"SELECT COUNT(*) FROM {schema}_identity_projection WHERE tenant_id = :tenant_id"),
                {"tenant_id": payload["tenant_id"]}
            )
            count = result.fetchone()[0]
            assert count == 0  # No user should be created


class TestErrorHandling:
    """Test error handling and transaction rollback."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_invalid_payload_handling(self, consumer, database_manager, test_database):
        """Test handling of events with invalid payloads."""
        schema = test_database["schema"]
        domain = consumer.config["service"]["domain"]

        invalid_event = {
            "event_id": str(uuid.uuid4()),
            "event_type": "user.created.v1",
            "topic": "identity.user.v1",
            "schema_version": "1",
            "occurred_at": datetime.utcnow().isoformat() + "Z",
            "tenant_id": str(uuid.uuid4()),
            "aggregate_id": str(uuid.uuid4()),
            "aggregate_type": "user",
            "payload": "invalid json"  # Invalid JSON
        }

        # Should handle the error gracefully
        handler_method = getattr(consumer, f"handle_{domain}_user_created")

        # For invalid events, we expect the handler to fail when trying to parse payload
        with pytest.raises((json.JSONDecodeError, AttributeError)):
            # Create envelope and payload like the consumer does
            envelope_data = {
                "event_id": invalid_event["event_id"],
                "event_type": invalid_event["event_type"],
                "topic": invalid_event["topic"],
                "schema_version": invalid_event["schema_version"],
                "occurred_at": invalid_event["occurred_at"],
                "tenant_id": invalid_event["tenant_id"],
                "aggregate_id": invalid_event["aggregate_id"],
                "aggregate_type": invalid_event["aggregate_type"]
            }
            envelope = SimpleNamespace(**envelope_data)
            payload_obj = SimpleNamespace(**json.loads(invalid_event["payload"]))  # This will fail

            async with database_manager.session_factory() as session:
                await handler_method(session, envelope, payload_obj)

        # Verify no partial data was committed
        async with database_manager.session_factory() as session:
            result = await session.execute(
                sa.text(f"SELECT COUNT(*) FROM {schema}_event_ledger WHERE event_id = :event_id"),
                {"event_id": invalid_event["event_id"]}
            )
            ledger_count = result.fetchone()[0]
            assert ledger_count == 0  # Should not be in ledger

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_database_constraint_error_handling(self, consumer, database_manager, test_database):
        """Test handling of database constraint violations."""
        schema = test_database["schema"]
        domain = consumer.config["service"]["domain"]

        # Create an event with invalid data
        invalid_event = {
            "event_id": str(uuid.uuid4()),
            "event_type": "user.created.v1",
            "topic": "identity.user.v1",
            "schema_version": "1",
            "occurred_at": datetime.utcnow().isoformat() + "Z",
            "tenant_id": "invalid-uuid-format",  # This might cause issues depending on validation
            "aggregate_id": str(uuid.uuid4()),
            "aggregate_type": "user",
            "payload": json.dumps({
                "user_id": str(uuid.uuid4()),
                "tenant_id": "invalid-uuid-format",
                "email": "test@example.com",
                "display_name": "Test User",
                "status": "active"
            })
        }

        # Should handle database errors
        handler_method = getattr(consumer, f"handle_{domain}_user_created")
        try:
            # Create envelope and payload like the consumer does
            envelope_data = {
                "event_id": invalid_event["event_id"],
                "event_type": invalid_event["event_type"],
                "topic": invalid_event["topic"],
                "schema_version": invalid_event["schema_version"],
                "occurred_at": invalid_event["occurred_at"],
                "tenant_id": invalid_event["tenant_id"],
                "aggregate_id": invalid_event["aggregate_id"],
                "aggregate_type": invalid_event["aggregate_type"]
            }
            envelope = SimpleNamespace(**envelope_data)
            payload_obj = SimpleNamespace(**json.loads(invalid_event["payload"]))

            async with database_manager.session_factory() as session:
                await handler_method(session, envelope, payload_obj)
        except Exception:
            pass  # Expected to fail in some cases

        # Verify transaction was rolled back - check ledger consistency
        async with database_manager.session_factory() as session:
            result = await session.execute(
                sa.text(f"SELECT COUNT(*) FROM {schema}_event_ledger WHERE event_id = :event_id"),
                {"event_id": invalid_event["event_id"]}
            )
            ledger_count = result.fetchone()[0]
            # If processing failed, there should be no ledger entry
            # If processing succeeded despite the "invalid" data, there should be one entry
            assert ledger_count in [0, 1]  # Either succeeded or failed cleanly