"""
Integration tests for Redis stream consumption.

These tests validate Redis integration including stream consumption,
consumer group management, and multi-topic handling across different
service configurations.
"""
import asyncio
import json
import uuid
from datetime import datetime

import pytest


class TestRedisIntegration:
    """Test Redis stream consumption and processing."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    @pytest.mark.redis
    async def test_redis_consumer_group_creation(self, consumer, redis_client):
        """Test that consumer group is created properly."""
        topic = consumer.config["topics"][0]
        consumer_group = consumer.config["consumer_group"]

        # Ensure stream exists by adding a dummy message
        await redis_client.xadd(topic, {"dummy": "data"})

        # Create consumer group
        try:
            await redis_client.xgroup_create(topic, consumer_group, id="0", mkstream=True)
        except Exception as e:
            if "BUSYGROUP" not in str(e):  # Group already exists
                raise

        # Verify group exists
        groups = await redis_client.xinfo_groups(topic)
        group_names = [group["name"] for group in groups]
        assert consumer_group.encode() in group_names

    @pytest.mark.asyncio
    @pytest.mark.integration
    @pytest.mark.redis
    async def test_redis_event_consumption(self, consumer, redis_client, add_test_event, sample_user_created_event):
        """Test consuming events from Redis streams."""
        topic = consumer.config["topics"][0]

        # Add test event to stream
        message_id = await add_test_event(redis_client, topic, sample_user_created_event)

        # Create consumer group
        consumer_group = consumer.config["consumer_group"]
        try:
            await redis_client.xgroup_create(topic, consumer_group, id="0", mkstream=True)
        except Exception as e:
            if "BUSYGROUP" not in str(e):
                raise

        # Read events from consumer group
        events = await redis_client.xreadgroup(
            consumer_group,
            "test-consumer",
            {topic: ">"},
            count=1,
            block=1000
        )

        assert len(events) == 1
        assert len(events[0][1]) == 1  # One message

        stream_name, messages = events[0]
        message_id_returned, fields = messages[0]

        # Verify event data
        assert fields[b"event_id"].decode() == sample_user_created_event["event_id"]
        assert fields[b"event_type"].decode() == sample_user_created_event["event_type"]

    @pytest.mark.asyncio
    @pytest.mark.integration
    @pytest.mark.redis
    async def test_redis_batch_consumption(self, consumer, redis_client, add_test_event):
        """Test batch consumption of multiple events."""
        topic = consumer.config["topics"][0]
        consumer_group = consumer.config["consumer_group"]

        # Add multiple test events
        events = []
        for i in range(3):
            event = {
                "event_id": str(uuid.uuid4()),
                "event_type": "user.created.v1",
                "topic": topic,
                "schema_version": "1",
                "occurred_at": datetime.utcnow().isoformat() + "Z",
                "tenant_id": str(uuid.uuid4()),
                "aggregate_id": str(uuid.uuid4()),
                "aggregate_type": "user",
                "payload": json.dumps({
                    "user_id": str(uuid.uuid4()),
                    "tenant_id": str(uuid.uuid4()),
                    "email": f"test{i}@example.com",
                    "display_name": f"Test User {i}",
                    "status": "active"
                })
            }
            await add_test_event(redis_client, topic, event)
            events.append(event)

        # Create consumer group
        try:
            await redis_client.xgroup_create(topic, consumer_group, id="0", mkstream=True)
        except Exception as e:
            if "BUSYGROUP" not in str(e):
                raise

        # Read events in batch
        consumed_events = await redis_client.xreadgroup(
            consumer_group,
            "test-consumer",
            {topic: ">"},
            count=5,  # Request more than available
            block=1000
        )

        assert len(consumed_events) == 1  # One stream
        stream_name, messages = consumed_events[0]
        assert len(messages) == 3  # Three messages

        # Verify all events were consumed
        consumed_event_ids = {msg[1][b"event_id"].decode() for msg in messages}
        expected_event_ids = {event["event_id"] for event in events}
        assert consumed_event_ids == expected_event_ids

    @pytest.mark.asyncio
    @pytest.mark.integration
    @pytest.mark.redis
    async def test_redis_acknowledgment(self, consumer, redis_client, add_test_event, sample_user_created_event):
        """Test Redis message acknowledgment."""
        topic = consumer.config["topics"][0]
        consumer_group = consumer.config["consumer_group"]
        consumer_name = "test-consumer"

        # Add test event
        message_id = await add_test_event(redis_client, topic, sample_user_created_event)

        # Create consumer group
        try:
            await redis_client.xgroup_create(topic, consumer_group, id="0", mkstream=True)
        except Exception as e:
            if "BUSYGROUP" not in str(e):
                raise

        # Consume event
        events = await redis_client.xreadgroup(
            consumer_group,
            consumer_name,
            {topic: ">"},
            count=1,
            block=1000
        )

        stream_name, messages = events[0]
        message_id_consumed, fields = messages[0]

        # Check pending messages before acknowledgment
        pending_before = await redis_client.xpending(topic, consumer_group)
        assert pending_before["pending"] == 1

        # Acknowledge the message
        ack_count = await redis_client.xack(topic, consumer_group, message_id_consumed)
        assert ack_count == 1

        # Check pending messages after acknowledgment
        pending_after = await redis_client.xpending(topic, consumer_group)
        assert pending_after["pending"] == 0


class TestMultiServiceRedisIntegration:
    """Test Redis integration across different service configurations."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    @pytest.mark.redis
    async def test_linting_service_redis_consumption(self, linting_consumer, redis_client, add_test_event, sample_user_created_event):
        """Test Redis consumption specifically for linting service."""
        topic = "identity.user.v1"
        consumer_group = linting_consumer.config["consumer_group"]

        # Add test event
        await add_test_event(redis_client, topic, sample_user_created_event)

        # Create consumer group
        try:
            await redis_client.xgroup_create(topic, consumer_group, id="0", mkstream=True)
        except Exception as e:
            if "BUSYGROUP" not in str(e):
                raise

        # Consume event
        events = await redis_client.xreadgroup(
            consumer_group,
            "linting-test-consumer",
            {topic: ">"},
            count=1,
            block=1000
        )

        assert len(events) == 1
        stream_name, messages = events[0]
        assert len(messages) == 1

        # Verify linting consumer group was used
        assert stream_name.decode() == topic

    @pytest.mark.asyncio
    @pytest.mark.integration
    @pytest.mark.redis
    async def test_spell_checking_service_redis_consumption(self, spell_checking_consumer, redis_client, add_test_event, sample_user_created_event):
        """Test Redis consumption specifically for spell-checking service."""
        topic = "identity.user.v1"
        consumer_group = spell_checking_consumer.config["consumer_group"]

        # Add test event
        await add_test_event(redis_client, topic, sample_user_created_event)

        # Create consumer group
        try:
            await redis_client.xgroup_create(topic, consumer_group, id="0", mkstream=True)
        except Exception as e:
            if "BUSYGROUP" not in str(e):
                raise

        # Consume event
        events = await redis_client.xreadgroup(
            consumer_group,
            "spell-test-consumer",
            {topic: ">"},
            count=1,
            block=1000
        )

        assert len(events) == 1
        stream_name, messages = events[0]
        assert len(messages) == 1

        # Verify spell-checking consumer group was used
        assert stream_name.decode() == topic

    @pytest.mark.asyncio
    @pytest.mark.integration
    @pytest.mark.redis
    async def test_service_isolation_different_consumer_groups(self, linting_consumer, spell_checking_consumer, redis_client, add_test_event, sample_user_created_event):
        """Test that different services use different consumer groups."""
        topic = "identity.user.v1"

        # Add test event
        await add_test_event(redis_client, topic, sample_user_created_event)

        # Create consumer groups for both services
        lint_group = linting_consumer.config["consumer_group"]
        spell_group = spell_checking_consumer.config["consumer_group"]

        # Ensure groups are different
        assert lint_group != spell_group

        # Create both consumer groups
        for group in [lint_group, spell_group]:
            try:
                await redis_client.xgroup_create(topic, group, id="0", mkstream=True)
            except Exception as e:
                if "BUSYGROUP" not in str(e):
                    raise

        # Verify both groups exist and are different
        groups = await redis_client.xinfo_groups(topic)
        group_names = [group["name"].decode() for group in groups]

        assert lint_group in group_names
        assert spell_group in group_names
        assert len(set(group_names)) >= 2  # At least 2 unique groups


class TestMultiTopicConsumption:
    """Test consumption from multiple Redis topics."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    @pytest.mark.redis
    async def test_multi_topic_configuration(self, service_config, redis_client):
        """Test consumer with multiple topics configured."""
        # Add additional topics to config
        multi_topic_config = service_config.copy()
        multi_topic_config["topics"] = [
            "identity.user.v1",
            "document.content.v1",
            "folder.structure.v1"
        ]

        from app.consumer import ConfigurableConsumer
        consumer_instance = ConfigurableConsumer(multi_topic_config)
        consumer_instance.redis_client = redis_client

        # Verify all topics are configured
        assert len(consumer_instance.config["topics"]) == 3
        assert "identity.user.v1" in consumer_instance.config["topics"]
        assert "document.content.v1" in consumer_instance.config["topics"]
        assert "folder.structure.v1" in consumer_instance.config["topics"]

    @pytest.mark.asyncio
    @pytest.mark.integration
    @pytest.mark.redis
    async def test_consume_from_multiple_topics(self, service_config, redis_client, add_test_event):
        """Test consuming events from multiple topics."""
        # Configure multiple topics
        multi_topic_config = service_config.copy()
        multi_topic_config["topics"] = ["identity.user.v1", "document.content.v1"]

        from app.consumer import ConfigurableConsumer
        consumer_instance = ConfigurableConsumer(multi_topic_config)
        consumer_instance.redis_client = redis_client

        # Add events to different topics
        user_event = {
            "event_id": str(uuid.uuid4()),
            "event_type": "user.created.v1",
            "topic": "identity.user.v1",
            "payload": json.dumps({"user_id": str(uuid.uuid4())})
        }

        doc_event = {
            "event_id": str(uuid.uuid4()),
            "event_type": "document.created.v1",
            "topic": "document.content.v1",
            "payload": json.dumps({"document_id": str(uuid.uuid4())})
        }

        await add_test_event(redis_client, "identity.user.v1", user_event)
        await add_test_event(redis_client, "document.content.v1", doc_event)

        # Create consumer groups for both topics
        consumer_group = consumer_instance.config["consumer_group"]
        for topic in multi_topic_config["topics"]:
            try:
                await redis_client.xgroup_create(topic, consumer_group, id="0", mkstream=True)
            except Exception as e:
                if "BUSYGROUP" not in str(e):
                    raise

        # Consume from both topics
        topic_streams = {topic: ">" for topic in multi_topic_config["topics"]}
        events = await redis_client.xreadgroup(
            consumer_group,
            "test-consumer",
            topic_streams,
            count=10,
            block=1000
        )

        # Should get events from both topics
        assert len(events) == 2  # Two streams

        # Verify events from both topics
        consumed_topics = {stream[0].decode() for stream in events}
        assert "identity.user.v1" in consumed_topics
        assert "document.content.v1" in consumed_topics


class TestRedisErrorHandling:
    """Test Redis connection and error handling."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    @pytest.mark.redis
    async def test_redis_connection_error_handling(self, service_config):
        """Test handling of Redis connection errors."""
        # Create consumer with invalid Redis URL
        invalid_config = service_config.copy()
        invalid_config["redis"]["url"] = "redis://nonexistent:6379/0"

        from app.consumer import ConfigurableConsumer
        consumer_instance = None
        try:
            consumer_instance = ConfigurableConsumer(invalid_config)

            # This should raise a connection error
            with pytest.raises(Exception):  # Could be ConnectionError or similar
                await consumer_instance._ensure_consumer_groups_exist()
        finally:
            if consumer_instance and hasattr(consumer_instance, 'redis_client'):
                try:
                    await consumer_instance.redis_client.close()
                except:
                    pass

    @pytest.mark.asyncio
    @pytest.mark.integration
    @pytest.mark.redis
    async def test_redis_timeout_handling(self, consumer, redis_client):
        """Test handling of Redis timeout scenarios."""
        topic = consumer.config["topics"][0]
        consumer_group = consumer.config["consumer_group"]

        # Create consumer group
        try:
            await redis_client.xgroup_create(topic, consumer_group, id="0", mkstream=True)
        except Exception as e:
            if "BUSYGROUP" not in str(e):
                raise

        # Try to read with very short timeout (should timeout immediately if no data)
        events = await redis_client.xreadgroup(
            consumer_group,
            "test-consumer",
            {topic: ">"},
            count=1,
            block=1  # 1ms timeout
        )

        # Should return empty list when timeout occurs
        assert events is None or len(events) == 0