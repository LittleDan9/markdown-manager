"""Dictionary outbox service for event-driven dictionary synchronization.

Wraps dictionary CRUD operations with outbox event emission in a single
transaction, ensuring dictionary changes are atomically published to
the event stream for consumption by spell-check service projections.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.custom_dictionary import CustomDictionary
from app.schemas.custom_dictionary import CustomDictionaryCreate
from app.services.outbox_service import OutboxService
from app.crud import custom_dictionary as dict_crud

DICTIONARY_TOPIC = "dictionary.word.v1"
DEFAULT_TENANT = "00000000-0000-0000-0000-000000000000"


async def _get_identity_user_id(db: AsyncSession, user_id: int) -> Optional[str]:
    """Look up identity_user_id from identity.users via users table."""
    result = await db.execute(
        text("SELECT identity_user_id FROM users WHERE id = :uid"),
        {"uid": user_id},
    )
    row = result.first()
    return str(row[0]) if row and row[0] else None


class DictionaryOutboxService:
    """Dictionary operations with transactional outbox events."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.outbox = OutboxService(db)

    async def _resolve_identity_user_id(self, user_id: int) -> Optional[str]:
        return await _get_identity_user_id(self.db, user_id)

    async def add_word(
        self,
        word_data: CustomDictionaryCreate,
        user_id: int,
        identity_user_id: Optional[str] = None,
    ) -> CustomDictionary:
        """Add a word and emit DictionaryWordAdded event."""
        if identity_user_id is None:
            identity_user_id = await _get_identity_user_id(self.db, user_id)

        db_word = CustomDictionary(
            user_id=user_id,
            word=word_data.word,
            notes=word_data.notes,
            category_id=word_data.category_id,
            folder_path=word_data.folder_path,
        )
        self.db.add(db_word)
        await self.db.flush()

        if identity_user_id:
            await self._emit_word_added(
                identity_user_id, db_word.word,
                category_id=word_data.category_id,
                folder_path=word_data.folder_path,
            )

        await self.db.commit()
        await self.db.refresh(db_word)
        return db_word

    async def bulk_add_words(
        self,
        words: list[str],
        user_id: int,
        identity_user_id: Optional[str] = None,
        category_id: Optional[int] = None,
        folder_path: Optional[str] = None,
    ) -> list[CustomDictionary]:
        """Bulk add words and emit events for each."""
        if identity_user_id is None:
            identity_user_id = await _get_identity_user_id(self.db, user_id)

        from sqlalchemy import select
        normalized_words = list(set(w.lower().strip() for w in words if w.strip()))

        query = select(CustomDictionary.word).where(
            CustomDictionary.user_id == user_id,
            CustomDictionary.word.in_(normalized_words),
        )
        if folder_path is not None:
            query = query.where(CustomDictionary.folder_path == folder_path)
        elif category_id is not None:
            query = query.where(CustomDictionary.category_id == category_id)
        else:
            query = query.where(
                CustomDictionary.category_id.is_(None),
                CustomDictionary.folder_path.is_(None),
            )

        result = await self.db.execute(query)
        existing = set(result.scalars().all())
        new_words = [w for w in normalized_words if w not in existing]

        if not new_words:
            return []

        db_words = [
            CustomDictionary(
                user_id=user_id, word=w,
                category_id=category_id, folder_path=folder_path,
            )
            for w in new_words
        ]
        self.db.add_all(db_words)
        await self.db.flush()

        if identity_user_id:
            for w in new_words:
                await self._emit_word_added(
                    identity_user_id, w,
                    category_id=category_id,
                    folder_path=folder_path,
                )

        await self.db.commit()
        for dw in db_words:
            await self.db.refresh(dw)
        return db_words

    async def remove_word_by_id(
        self,
        word_id: int,
        user_id: int,
        identity_user_id: Optional[str] = None,
    ) -> bool:
        """Remove word by ID and emit DictionaryWordRemoved event."""
        if identity_user_id is None:
            identity_user_id = await _get_identity_user_id(self.db, user_id)

        from sqlalchemy import select
        result = await self.db.execute(
            select(CustomDictionary).where(
                CustomDictionary.id == word_id,
                CustomDictionary.user_id == user_id,
            )
        )
        db_word = result.scalar_one_or_none()
        if not db_word:
            return False

        word_text = db_word.word
        cat_id = db_word.category_id
        fpath = db_word.folder_path

        await self.db.delete(db_word)
        await self.db.flush()

        if identity_user_id:
            await self._emit_word_removed(
                identity_user_id, word_text,
                category_id=cat_id, folder_path=fpath,
            )

        await self.db.commit()
        return True

    async def remove_word_by_text(
        self,
        word: str,
        user_id: int,
        identity_user_id: Optional[str] = None,
        category_id: Optional[int] = None,
        folder_path: Optional[str] = None,
    ) -> bool:
        """Remove word by text and emit DictionaryWordRemoved event."""
        if identity_user_id is None:
            identity_user_id = await _get_identity_user_id(self.db, user_id)

        from sqlalchemy import select
        query = select(CustomDictionary).where(
            CustomDictionary.word == word.lower(),
            CustomDictionary.user_id == user_id,
        )
        if folder_path is not None:
            query = query.where(CustomDictionary.folder_path == folder_path)
        elif category_id is not None:
            query = query.where(CustomDictionary.category_id == category_id)
        else:
            query = query.where(
                CustomDictionary.category_id.is_(None),
                CustomDictionary.folder_path.is_(None),
            )

        result = await self.db.execute(query)
        db_word = result.scalar_one_or_none()
        if not db_word:
            return False

        await self.db.delete(db_word)
        await self.db.flush()

        if identity_user_id:
            await self._emit_word_removed(
                identity_user_id, word.lower(),
                category_id=category_id, folder_path=folder_path,
            )

        await self.db.commit()
        return True

    def _scope_type(self, category_id, folder_path):
        if folder_path:
            return "folder"
        if category_id:
            return "category"
        return "user"

    async def _emit_word_added(self, identity_user_id, word, category_id=None, folder_path=None):
        await self.outbox.add_event(
            event_type="DictionaryWordAdded",
            aggregate_id=identity_user_id,
            aggregate_type="dictionary",
            payload={
                "user_id": identity_user_id,
                "tenant_id": DEFAULT_TENANT,
                "word": word,
                "scope_type": self._scope_type(category_id, folder_path),
                "scope_id": str(category_id) if category_id else None,
                "folder_path": folder_path,
                "occurred_at": datetime.now(timezone.utc).isoformat(),
            },
            topic=DICTIONARY_TOPIC,
        )

    async def _emit_word_removed(self, identity_user_id, word, category_id=None, folder_path=None):
        await self.outbox.add_event(
            event_type="DictionaryWordRemoved",
            aggregate_id=identity_user_id,
            aggregate_type="dictionary",
            payload={
                "user_id": identity_user_id,
                "tenant_id": DEFAULT_TENANT,
                "word": word,
                "scope_type": self._scope_type(category_id, folder_path),
                "scope_id": str(category_id) if category_id else None,
                "folder_path": folder_path,
                "occurred_at": datetime.now(timezone.utc).isoformat(),
            },
            topic=DICTIONARY_TOPIC,
        )
