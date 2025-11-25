"""Configurable database manager."""

import json
import logging
from datetime import datetime
from typing import AsyncGenerator, Dict, Any, Optional
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

logger = logging.getLogger(__name__)


class DatabaseManager:
    """Configurable database connection and operations manager."""

    def __init__(self, database_url: str, config: Dict[str, Any]):
        self.database_url = database_url
        self.config = config
        self.schema = config['schema']
        self.tables = config['tables']
        self.engine = None
        self.session_factory = None

    async def initialize(self):
        """Initialize database connection and create tables if needed."""
        self.engine = create_async_engine(
            self.database_url,
            echo=False,
            pool_size=5,
            max_overflow=10,
            pool_pre_ping=True
        )

        self.session_factory = async_sessionmaker(
            self.engine,
            class_=AsyncSession,
            expire_on_commit=False
        )

        # Test connection
        async with self.engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
            logger.info("Database connection established")

        # Ensure schema and tables exist
        await self._ensure_schema()

    async def cleanup(self):
        """Cleanup database connections."""
        if self.engine:
            await self.engine.dispose()
            logger.info("Database connections closed")

    async def get_session(self) -> AsyncGenerator[AsyncSession, None]:
        """Get database session."""
        async with self.session_factory() as session:
            yield session

    async def _ensure_schema(self):
        """Ensure database schema and tables exist based on configuration."""
        async with self.engine.begin() as conn:
            # Create schema
            await conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {self.schema}"))

            # Create standard consumer tables
            await self._create_standard_tables(conn)

            # Create tables based on configuration
            for table_name, table_config in self.tables.items():
                await self._create_table(conn, table_name, table_config)

            logger.info(f"Database schema '{self.schema}' and tables ensured")

    async def _create_standard_tables(self, conn):
        """Create standard tables needed by all consumers."""
        # Event ledger for idempotency
        await conn.execute(text(f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.event_ledger (
                event_id VARCHAR(255) PRIMARY KEY,
                received_at TIMESTAMP NOT NULL
            )
        """))

        # Identity projection for user data
        await conn.execute(text(f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.identity_projection (
                tenant_id UUID NOT NULL,
                user_id UUID NOT NULL,
                email VARCHAR(255),
                display_name VARCHAR(255),
                status VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL,
                PRIMARY KEY (tenant_id, user_id)
            )
        """))

    async def _create_table(self, conn, table_name: str, table_config: Dict[str, Any]):
        """Create a table based on configuration."""
        columns = []
        primary_key = table_config.get('primary_key', [])

        for col_name, col_def in table_config['columns'].items():
            columns.append(f"{col_name} {col_def}")

        # Add primary key constraint if specified
        if primary_key:
            pk_cols = ', '.join(primary_key)
            if 'PRIMARY KEY' not in ' '.join(columns):
                columns.append(f"PRIMARY KEY ({pk_cols})")

        columns_sql = ',\n                    '.join(columns)

        create_sql = f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.{table_name} (
                {columns_sql}
            )
        """

        await conn.execute(text(create_sql))

    async def check_event_processed(self, session: AsyncSession, event_id: str) -> bool:
        """Check if an event has already been processed."""
        table_config = self.tables.get('event_ledger', {})
        table_name = (table_config.get('table_name', f'{self.schema}.event_ledger')
                     if isinstance(table_config, dict) else f'{self.schema}.event_ledger')
        result = await session.execute(
            text(f"SELECT 1 FROM {table_name} WHERE event_id = :event_id"),
            {"event_id": event_id}
        )
        return result.first() is not None

    async def record_event_processed(
        self, session: AsyncSession, event_id: str, received_at: datetime
    ):
        """Record that an event has been processed."""
        table_config = self.tables.get('event_ledger', {})
        table_name = (table_config.get('table_name', f'{self.schema}.event_ledger')
                     if isinstance(table_config, dict) else f'{self.schema}.event_ledger')
        await session.execute(
            text(f"""
                INSERT INTO {table_name} (event_id, received_at)
                VALUES (:event_id, :received_at)
            """),
            {"event_id": event_id, "received_at": received_at}
        )

    async def upsert_identity_projection(
        self,
        session: AsyncSession,
        tenant_id: UUID,
        user_id: UUID,
        email: Optional[str],
        display_name: Optional[str],
        status: str,
        updated_at: datetime
    ):
        """Upsert user identity projection."""
        columns = ["tenant_id", "user_id", "status", "updated_at"]
        values = [":tenant_id", ":user_id", ":status", ":updated_at"]
        params = {
            "tenant_id": tenant_id,
            "user_id": user_id,
            "status": status,
            "updated_at": updated_at
        }

        # Add optional columns if they exist in the table config
        table_config = self.tables.get('identity_projection', {})
        table_columns = table_config.get('columns', {})

        if 'email' in table_columns and email is not None:
            columns.append("email")
            values.append(":email")
            params["email"] = email

        if 'display_name' in table_columns and display_name is not None:
            columns.append("display_name")
            values.append(":display_name")
            params["display_name"] = display_name

        columns_sql = ', '.join(columns)
        values_sql = ', '.join(values)

        # Build UPDATE SET clause for conflict resolution
        update_sets = []
        for col in columns:
            if col not in ["tenant_id", "user_id"]:  # Skip primary key columns
                update_sets.append(f"{col} = EXCLUDED.{col}")
        update_sql = ', '.join(update_sets)

        table_config = self.tables.get('identity_projection', {})
        table_name = table_config.get('table_name', f'{self.schema}.identity_projection') if isinstance(table_config, dict) else f'{self.schema}.identity_projection'
        await session.execute(
            text(f"""
                INSERT INTO {table_name} ({columns_sql})
                VALUES ({values_sql})
                ON CONFLICT (tenant_id, user_id)
                DO UPDATE SET {update_sql}
            """),
            params
        )

    async def create_default_user_prefs(
        self,
        session: AsyncSession,
        tenant_id: UUID,
        user_id: UUID,
        preferences: Dict[str, Any]
    ):
        """Create default user preferences (for linting service)."""
        if 'user_prefs' not in self.tables:
            return  # Table not configured for this service

        await session.execute(
            text(f"""
                INSERT INTO {self.schema}.user_prefs (tenant_id, user_id, rules, version, updated_at)
                VALUES (:tenant_id, :user_id, :rules, 1, now())
                ON CONFLICT (tenant_id, user_id) DO NOTHING
            """),
            {
                "tenant_id": tenant_id,
                "user_id": user_id,
                "rules": json.dumps(preferences.get('rules', {}))
            }
        )

    async def create_default_user_dict(
        self,
        session: AsyncSession,
        tenant_id: UUID,
        user_id: UUID,
        dictionary: Dict[str, Any]
    ):
        """Create default user dictionary (for spell-check service)."""
        if 'user_dict' not in self.tables:
            return  # Table not configured for this service

        await session.execute(
            text(f"""
                INSERT INTO {self.schema}.user_dict (tenant_id, user_id, words, version, updated_at)
                VALUES (:tenant_id, :user_id, :words, 1, now())
                ON CONFLICT (tenant_id, user_id) DO NOTHING
            """),
            {
                "tenant_id": tenant_id,
                "user_id": user_id,
                "words": json.dumps(dictionary.get('words', []))
            }
        )
