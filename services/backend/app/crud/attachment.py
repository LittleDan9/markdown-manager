"""CRUD operations for attachments."""
from typing import List, Optional

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attachment import Attachment


class AttachmentCRUD:
    """Repository for attachment database operations."""

    async def create(
        self,
        db: AsyncSession,
        *,
        user_id: int,
        document_id: int,
        original_filename: str,
        stored_filename: str,
        mime_type: str,
        file_size_bytes: int,
        content_hash: str,
        scan_status: str = "pending",
        scan_result: Optional[str] = None,
    ) -> Attachment:
        """Create a new attachment record."""
        attachment = Attachment(
            user_id=user_id,
            document_id=document_id,
            original_filename=original_filename,
            stored_filename=stored_filename,
            mime_type=mime_type,
            file_size_bytes=file_size_bytes,
            content_hash=content_hash,
            scan_status=scan_status,
            scan_result=scan_result,
        )
        db.add(attachment)
        await db.commit()
        await db.refresh(attachment)
        return attachment

    async def get(
        self, db: AsyncSession, attachment_id: int, user_id: int
    ) -> Optional[Attachment]:
        """Get an attachment by ID with ownership check."""
        result = await db.execute(
            select(Attachment).where(
                Attachment.id == attachment_id,
                Attachment.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_by_id(
        self, db: AsyncSession, attachment_id: int
    ) -> Optional[Attachment]:
        """Get an attachment by ID without ownership check (for public serving)."""
        result = await db.execute(
            select(Attachment).where(Attachment.id == attachment_id)
        )
        return result.scalar_one_or_none()

    async def get_by_document(
        self, db: AsyncSession, document_id: int, user_id: int
    ) -> List[Attachment]:
        """Get all attachments for a document."""
        result = await db.execute(
            select(Attachment)
            .where(
                Attachment.document_id == document_id,
                Attachment.user_id == user_id,
            )
            .order_by(Attachment.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_by_user(
        self,
        db: AsyncSession,
        user_id: int,
        *,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[List[Attachment], int]:
        """Get all attachments for a user (library view) with pagination."""
        # Count query
        count_result = await db.execute(
            select(func.count()).select_from(Attachment).where(
                Attachment.user_id == user_id
            )
        )
        total = count_result.scalar_one()

        # Data query
        result = await db.execute(
            select(Attachment)
            .where(Attachment.user_id == user_id)
            .order_by(Attachment.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        items = list(result.scalars().all())
        return items, total

    async def delete(
        self, db: AsyncSession, attachment_id: int, user_id: int
    ) -> Optional[Attachment]:
        """Delete an attachment by ID with ownership check. Returns the deleted record for cleanup."""
        attachment = await self.get(db, attachment_id, user_id)
        if attachment is None:
            return None
        await db.delete(attachment)
        await db.commit()
        return attachment

    async def get_user_total_size(self, db: AsyncSession, user_id: int) -> int:
        """Get total attachment storage used by a user in bytes."""
        result = await db.execute(
            select(func.coalesce(func.sum(Attachment.file_size_bytes), 0)).where(
                Attachment.user_id == user_id
            )
        )
        return result.scalar_one()

    async def get_user_attachment_count(self, db: AsyncSession, user_id: int) -> int:
        """Get total number of attachments for a user."""
        result = await db.execute(
            select(func.count()).select_from(Attachment).where(
                Attachment.user_id == user_id
            )
        )
        return result.scalar_one()

    async def delete_by_document(
        self, db: AsyncSession, document_id: int
    ) -> List[Attachment]:
        """Get all attachments for a document (for cleanup before deletion)."""
        result = await db.execute(
            select(Attachment).where(Attachment.document_id == document_id)
        )
        attachments = list(result.scalars().all())
        if attachments:
            await db.execute(
                delete(Attachment).where(Attachment.document_id == document_id)
            )
            await db.commit()
        return attachments


attachment_crud = AttachmentCRUD()
