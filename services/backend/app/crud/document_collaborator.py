"""CRUD operations for document collaborators."""
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.document_collaborator import DocumentCollaborator
from app.models.document import Document
from app.models.user import User


async def add_collaborator(
    db: AsyncSession,
    document_id: int,
    user_id: int,
    role: str = "viewer",
    invited_by: int | None = None,
) -> DocumentCollaborator:
    """Grant a user access to a document. Raises on duplicate."""
    collab = DocumentCollaborator(
        document_id=document_id,
        user_id=user_id,
        role=role,
        invited_by=invited_by,
    )
    db.add(collab)
    await db.flush()
    return collab


async def remove_collaborator(db: AsyncSession, document_id: int, user_id: int) -> bool:
    """Revoke a user's access. Returns True if a row was deleted."""
    result = await db.execute(
        delete(DocumentCollaborator).where(
            DocumentCollaborator.document_id == document_id,
            DocumentCollaborator.user_id == user_id,
        )
    )
    return result.rowcount > 0


async def get_collaborators(db: AsyncSession, document_id: int) -> list[DocumentCollaborator]:
    """List all collaborators for a document."""
    result = await db.execute(
        select(DocumentCollaborator)
        .options(selectinload(DocumentCollaborator.user))
        .where(DocumentCollaborator.document_id == document_id)
        .order_by(DocumentCollaborator.created_at)
    )
    return list(result.scalars().all())


async def get_user_role(db: AsyncSession, document_id: int, user_id: int) -> str | None:
    """Return the user's role for a document, or None if not a collaborator.

    Checks ownership first (returns 'owner'), then the collaborators table.
    """
    # Check ownership
    doc_result = await db.execute(
        select(Document.user_id).where(Document.id == document_id)
    )
    owner_id = doc_result.scalar_one_or_none()
    if owner_id is None:
        return None
    if owner_id == user_id:
        return "owner"

    # Check collaborators table
    result = await db.execute(
        select(DocumentCollaborator.role).where(
            DocumentCollaborator.document_id == document_id,
            DocumentCollaborator.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def update_collaborator_role(
    db: AsyncSession, document_id: int, user_id: int, role: str
) -> DocumentCollaborator | None:
    """Update a collaborator's role. Returns the updated row or None."""
    result = await db.execute(
        select(DocumentCollaborator).where(
            DocumentCollaborator.document_id == document_id,
            DocumentCollaborator.user_id == user_id,
        )
    )
    collab = result.scalar_one_or_none()
    if collab is None:
        return None
    collab.role = role
    await db.flush()
    return collab


async def get_shared_with_me(db: AsyncSession, user_id: int) -> list[dict]:
    """Return documents shared with a user (not owned), with role and owner info."""
    result = await db.execute(
        select(DocumentCollaborator, Document, User)
        .join(Document, DocumentCollaborator.document_id == Document.id)
        .join(User, Document.user_id == User.id)
        .where(DocumentCollaborator.user_id == user_id)
        .order_by(Document.updated_at.desc())
    )
    rows = result.all()
    return [
        {
            "document_id": collab.document_id,
            "document_name": doc.name,
            "role": collab.role,
            "owner_name": owner.full_name,
            "owner_email": owner.email,
            "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
            "created_at": collab.created_at.isoformat() if collab.created_at else None,
        }
        for collab, doc, owner in rows
    ]


async def has_document_collaborators(db: AsyncSession, document_id: int) -> bool:
    """Check if a document has any collaborators (used to decide collab mode)."""
    result = await db.execute(
        select(DocumentCollaborator.id)
        .where(DocumentCollaborator.document_id == document_id)
        .limit(1)
    )
    return result.scalar_one_or_none() is not None
