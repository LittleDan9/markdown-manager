from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document_recovery import DocumentRecovery
from app.schemas.document_recovery import DocumentRecoveryCreate

# Create recovery doc


async def create_recovery_doc(
    db: AsyncSession, doc: DocumentRecoveryCreate
) -> DocumentRecovery:
    db_doc = DocumentRecovery(**doc.dict())
    db.add(db_doc)
    await db.commit()
    await db.refresh(db_doc)
    return db_doc


# List recovery docs for user


from typing import Sequence


async def get_recovery_docs(
    db: AsyncSession, user_id: int
) -> Sequence[DocumentRecovery]:
    result = await db.execute(
        select(DocumentRecovery).where(DocumentRecovery.user_id == user_id)
    )
    return result.scalars().all()


# Resolve (delete) recovery doc


async def delete_recovery_doc(db: AsyncSession, doc_id: int) -> DocumentRecovery | None:
    result = await db.execute(
        select(DocumentRecovery).where(DocumentRecovery.id == doc_id)
    )
    db_doc = result.scalar_one_or_none()
    if db_doc:
        await db.delete(db_doc)
        await db.commit()
    return db_doc
