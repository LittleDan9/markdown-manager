"""
Test configuration and fixtures for consumer service base tests.

This module provides configurable test fixtures that can be used with different
service configurations to test the consumer base functionality across all services.
"""
import asyncio
import json
import os
import uuid
from datetime import datetime
from typing import AsyncGenerator, Dict, Any, Optional
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
import redis.asyncio as redis
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.consumer import ConfigurableConsumer
from app.database import DatabaseManager


@pytest.fixture(scope="session", autouse=True)
def setup_test_environment():
    """Set up test environment variables."""
    # Set DATABASE_URL for all tests to use in-memory SQLite
    os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"

    yield

    # Cleanup environment variables after all tests
    os.environ.pop("DATABASE_URL", None)


class TestableConsumer(ConfigurableConsumer):
    """Test consumer with implemented handler methods."""

    async def handle_test_user_created(self, session, envelope, payload):
        """Handle user created event for testing."""
        from datetime import datetime

        # Record event as processed
        await self.db_manager.record_event_processed(session, envelope.event_id, datetime.utcnow())

        # Update identity projection
        await self.db_manager.upsert_identity_projection(
            session,
            tenant_id=getattr(payload, 'tenant_id', None),
            user_id=getattr(payload, 'user_id', None),
            email=getattr(payload, 'email', None),
            display_name=getattr(payload, 'display_name', None),
            status=getattr(payload, 'status', 'active'),
            updated_at=datetime.utcnow()
        )

    async def handle_test_user_updated(self, session, envelope, payload):
        """Handle user updated event for testing."""
        # Record event as processed
        await self.db_manager.record_event_processed(session, envelope.event_id, datetime.utcnow())

        # Update identity projection
        await self.db_manager.upsert_identity_projection(
            session,
            tenant_id=getattr(payload, 'tenant_id', None),
            user_id=getattr(payload, 'user_id', None),
            email=getattr(payload, 'email', None),
            display_name=getattr(payload, 'display_name', None),
            status=getattr(payload, 'status', 'active'),
            updated_at=datetime.utcnow()
        )

    async def handle_test_user_disabled(self, session, envelope, payload):
        """Handle user disabled event for testing."""
        # Record event as processed
        await self.db_manager.record_event_processed(session, envelope.event_id, datetime.utcnow())

        # Update identity projection with disabled status
        await self.db_manager.upsert_identity_projection(
            session,
            tenant_id=getattr(payload, 'tenant_id', None),
            user_id=getattr(payload, 'user_id', None),
            email=getattr(payload, 'email', None),
            display_name=getattr(payload, 'display_name', None),
            status='disabled',
            updated_at=datetime.utcnow()
        )

    async def handle_linting_user_created(self, session, envelope, payload):
        """Handle user created event for linting service."""
        await self.handle_test_user_created(session, envelope, payload)

    async def handle_linting_user_updated(self, session, envelope, payload):
        """Handle user updated event for linting service."""
        await self.handle_test_user_updated(session, envelope, payload)

    async def handle_linting_user_disabled(self, session, envelope, payload):
        """Handle user disabled event for linting service."""
        await self.handle_test_user_disabled(session, envelope, payload)

    async def handle_spell_checking_user_created(self, session, envelope, payload):
        """Handle user created event for spell checking service."""
        await self.handle_test_user_created(session, envelope, payload)

    async def handle_spell_checking_user_updated(self, session, envelope, payload):
        """Handle user updated event for spell checking service."""
        await self.handle_test_user_updated(session, envelope, payload)

    async def handle_spell_checking_user_disabled(self, session, envelope, payload):
        """Handle user disabled event for spell checking service."""
        await self.handle_test_user_disabled(session, envelope, payload)


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def service_config():
    """
    Base service configuration - can be overridden by specific service tests.

    Override this fixture in service-specific test files to test with
    actual service configurations.
    """
    return {
        "service": {
            "name": "test-consumer",
            "domain": "test",
            "schema": "test"
        },
        "redis": {
            "url": "redis://localhost:6379/15"  # Use test database
        },
        "consumer_group": "test_group",
        "topics": ["identity.user.v1"]
    }


@pytest.fixture
def linting_config():
    """Configuration for linting service tests."""
    return {
        "service": {
            "name": "test-lint-consumer",
            "domain": "linting",
            "schema": "test_linting"
        },
        "redis": {
            "url": "redis://localhost:6379/15"
        },
        "consumer_group": "test_lint_group",
        "topics": ["identity.user.v1"]
    }


@pytest.fixture
def spell_checking_config():
    """Configuration for spell-checking service tests."""
    return {
        "service": {
            "name": "test-spell-consumer",
            "domain": "spell_checking",
            "schema": "test_spell_checking"
        },
        "redis": {
            "url": "redis://localhost:6379/15"
        },
        "consumer_group": "test_spell_group",
        "topics": ["identity.user.v1"]
    }


@pytest.fixture
async def redis_client(service_config):
    """Redis client for testing with automatic cleanup."""
    client = redis.from_url(service_config["redis"]["url"])

    # Clean up any existing test data
    try:
        await client.flushdb()
    except Exception:
        pass

    yield client

    # Cleanup
    try:
        await client.flushdb()
        await client.close()
    except Exception:
        pass


@pytest.fixture
async def test_database(service_config):
    """Test database setup with configurable schema names."""
    # Use in-memory SQLite for tests
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)

    schema = service_config["service"]["schema"]

    # Create tables with schema-specific names
    async with engine.begin() as conn:
        # Create event ledger table
        await conn.execute(sa.text(f"""
            CREATE TABLE {schema}_event_ledger (
                event_id VARCHAR(255) PRIMARY KEY,
                received_at TIMESTAMP NOT NULL
            )
        """))

        # Create identity projection table
        await conn.execute(sa.text(f"""
            CREATE TABLE {schema}_identity_projection (
                tenant_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                email VARCHAR(255),
                display_name VARCHAR(255),
                status VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL,
                PRIMARY KEY (tenant_id, user_id)
            )
        """))

    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    yield {"engine": engine, "session_factory": async_session, "schema": schema}

    await engine.dispose()


@pytest.fixture
async def database_manager(test_database, service_config):
    """Database manager instance for testing."""
    # Create database config with correct table structure
    db_config = {
        "schema": service_config["service"]["schema"],
        "tables": {
            "event_ledger": {
                "table_name": f"{service_config['service']['schema']}_event_ledger"
            },
            "identity_projection": {
                "table_name": f"{service_config['service']['schema']}_identity_projection"
            }
        }
    }

    db_manager = DatabaseManager("sqlite+aiosqlite:///:memory:", db_config)
    db_manager.engine = test_database["engine"]
    db_manager.session_factory = test_database["session_factory"]

    yield db_manager


@pytest.fixture
async def consumer(service_config, redis_client, database_manager):
    """Configurable consumer instance for testing."""
    consumer_instance = TestableConsumer(service_config)

    # Replace with test instances
    consumer_instance.redis_client = redis_client
    consumer_instance.db_manager = database_manager

    yield consumer_instance


@pytest.fixture
def sample_user_created_event():
    """Sample user created event for testing."""
    event_id = str(uuid.uuid4())
    tenant_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())

    return {
        "event_id": event_id,
        "event_type": "user.created.v1",
        "topic": "identity.user.v1",
        "schema_version": "1",
        "occurred_at": datetime.utcnow().isoformat() + "Z",
        "tenant_id": tenant_id,
        "aggregate_id": user_id,
        "aggregate_type": "user",
        "payload": json.dumps({
            "user_id": user_id,
            "tenant_id": tenant_id,
            "email": "test@example.com",
            "display_name": "Test User",
            "status": "active"
        })
    }


@pytest.fixture
def sample_user_updated_event():
    """Sample user updated event for testing."""
    event_id = str(uuid.uuid4())
    tenant_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())

    return {
        "event_id": event_id,
        "event_type": "user.updated.v1",
        "topic": "identity.user.v1",
        "schema_version": "1",
        "occurred_at": datetime.utcnow().isoformat() + "Z",
        "tenant_id": tenant_id,
        "aggregate_id": user_id,
        "aggregate_type": "user",
        "payload": json.dumps({
            "user_id": user_id,
            "tenant_id": tenant_id,
            "email": "updated@example.com",
            "display_name": "Updated Test User",
            "status": "active"
        })
    }


@pytest.fixture
def sample_user_disabled_event():
    """Sample user disabled event for testing."""
    event_id = str(uuid.uuid4())
    tenant_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())

    return {
        "event_id": event_id,
        "event_type": "user.disabled.v1",
        "topic": "identity.user.v1",
        "schema_version": "1",
        "occurred_at": datetime.utcnow().isoformat() + "Z",
        "tenant_id": tenant_id,
        "aggregate_id": user_id,
        "aggregate_type": "user",
        "payload": json.dumps({
            "user_id": user_id,
            "tenant_id": tenant_id,
            "email": "disabled@example.com",
            "display_name": "Disabled User",
            "status": "disabled"
        })
    }


async def add_redis_event(redis_client, topic: str, event_data: Dict[str, Any]) -> str:
    """Helper function to add events to Redis streams."""
    stream_data = []
    for key, value in event_data.items():
        stream_data.extend([key, str(value)])

    message_id = await redis_client.xadd(topic, dict(zip(stream_data[::2], stream_data[1::2])))
    return message_id


@pytest.fixture
def add_test_event():
    """Helper fixture to add events to Redis streams."""
    return add_redis_event


# Service-specific fixture combinations for easy testing
@pytest.fixture
async def linting_consumer(linting_config, redis_client, database_manager):
    """Pre-configured linting consumer for service-specific tests."""
    consumer_instance = TestableConsumer(linting_config)
    consumer_instance.redis_client = redis_client
    consumer_instance.db_manager = database_manager
    return consumer_instance


@pytest.fixture
async def spell_checking_consumer(spell_checking_config, redis_client, database_manager):
    """Pre-configured spell-checking consumer for service-specific tests."""
    consumer_instance = TestableConsumer(spell_checking_config)
    consumer_instance.redis_client = redis_client
    consumer_instance.db_manager = database_manager
    return consumer_instance


@pytest.fixture(params=["linting", "spell_checking"])
def multi_service_consumer(request, redis_client, database_manager):
    """Parametrized fixture for testing across multiple service configurations."""
    if request.param == "linting":
        config = {
            "service": {"name": "test-lint-consumer", "domain": "linting", "schema": "test_linting"},
            "redis": {"url": "redis://localhost:6379/15"},
            "consumer_group": "test_lint_group",
            "topics": ["identity.user.v1"]
        }
    else:  # spell_checking
        config = {
            "service": {"name": "test-spell-consumer", "domain": "spell_checking", "schema": "test_spell_checking"},
            "redis": {"url": "redis://localhost:6379/15"},
            "consumer_group": "test_spell_group",
            "topics": ["identity.user.v1"]
        }

    consumer_instance = TestableConsumer(config)
    consumer_instance.redis_client = redis_client
    consumer_instance.db_manager = database_manager
    return consumer_instance