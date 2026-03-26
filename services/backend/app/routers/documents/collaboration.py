"""REST endpoints for managing document collaborators."""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.crud import document as document_crud
from app.crud.document_collaborator import (
    add_collaborator,
    get_collaborators,
    get_shared_with_me,
    get_user_role,
    remove_collaborator,
    update_collaborator_role,
)
from app.database import get_db
from app.models.user import User
from app.routers.notifications import create_notification

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────

class CollaboratorInvite(BaseModel):
    email: EmailStr
    role: str = Field("viewer", pattern="^(editor|viewer)$")


class CollaboratorUpdate(BaseModel):
    role: str = Field(..., pattern="^(editor|viewer)$")


class CollaboratorOut(BaseModel):
    user_id: int
    email: str
    display_name: str
    role: str
    created_at: str


class CollaboratorListResponse(BaseModel):
    collaborators: list[CollaboratorOut]
    is_owner: bool
    has_collaborators: bool


class SharedDocumentOut(BaseModel):
    document_id: int
    document_name: str
    role: str
    owner_name: str
    owner_email: str
    updated_at: Optional[str] = None
    created_at: Optional[str] = None


# ── Helpers ──────────────────────────────────────────────────────

async def _require_owner(db: AsyncSession, document_id: int, user_id: int):
    """Raise 403 unless the user owns the document."""
    doc = await document_crud.document.get(db=db, id=document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.user_id != user_id:
        raise HTTPException(status_code=403, detail="Only the document owner can manage collaborators")
    return doc


# ── Endpoints ────────────────────────────────────────────────────

@router.get("/shared-with-me", response_model=list[SharedDocumentOut])
async def list_shared_with_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List documents shared with the current user."""
    rows = await get_shared_with_me(db, current_user.id)
    return rows


@router.get("/{document_id}/collaborators", response_model=CollaboratorListResponse)
async def list_collaborators(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List collaborators for a document. Owner or any collaborator may view."""
    role = await get_user_role(db, document_id, current_user.id)
    if role is None:
        raise HTTPException(status_code=404, detail="Document not found")

    collabs = await get_collaborators(db, document_id)
    return CollaboratorListResponse(
        collaborators=[
            CollaboratorOut(
                user_id=c.user_id,
                email=c.user.email,
                display_name=c.user.full_name,
                role=c.role,
                created_at=c.created_at.isoformat() if c.created_at else "",
            )
            for c in collabs
        ],
        is_owner=(role == "owner"),
        has_collaborators=len(collabs) > 0,
    )


@router.post(
    "/{document_id}/collaborators",
    response_model=CollaboratorOut,
    status_code=status.HTTP_201_CREATED,
)
async def invite_collaborator(
    document_id: int,
    body: CollaboratorInvite,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Invite a user to collaborate on a document. Owner only."""
    await _require_owner(db, document_id, current_user.id)

    # Resolve the invitee by email
    result = await db.execute(select(User).where(User.email == body.email))
    invitee = result.scalar_one_or_none()
    if not invitee:
        raise HTTPException(status_code=404, detail="User not found")
    if invitee.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot add yourself as a collaborator")

    # Check for existing collaboration
    existing_role = await get_user_role(db, document_id, invitee.id)
    if existing_role and existing_role != "owner":
        raise HTTPException(status_code=409, detail="User is already a collaborator")

    collab = await add_collaborator(
        db, document_id, invitee.id, role=body.role, invited_by=current_user.id
    )
    await db.commit()

    # Notify the invitee
    doc = await document_crud.document.get(db=db, id=document_id)
    doc_name = doc.name if doc else "a document"
    await create_notification(
        db, invitee.id,
        title="Collaboration Invite",
        message=f"{current_user.full_name} invited you to collaborate on \"{doc_name}\" as {body.role}.",
        category="collaboration",
        link=f"/documents/{document_id}",
    )
    await db.commit()

    logger.info(
        "User %d invited %d to document %d as %s",
        current_user.id, invitee.id, document_id, body.role,
    )

    return CollaboratorOut(
        user_id=invitee.id,
        email=invitee.email,
        display_name=invitee.full_name,
        role=collab.role,
        created_at=collab.created_at.isoformat() if collab.created_at else "",
    )


@router.patch("/{document_id}/collaborators/{user_id}", response_model=CollaboratorOut)
async def change_collaborator_role(
    document_id: int,
    user_id: int,
    body: CollaboratorUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change a collaborator's role. Owner only."""
    await _require_owner(db, document_id, current_user.id)

    collab = await update_collaborator_role(db, document_id, user_id, body.role)
    if collab is None:
        raise HTTPException(status_code=404, detail="Collaborator not found")
    await db.commit()

    # Re-fetch with user relationship
    collabs = await get_collaborators(db, document_id)
    updated = next((c for c in collabs if c.user_id == user_id), None)
    if not updated:
        raise HTTPException(status_code=404, detail="Collaborator not found")

    return CollaboratorOut(
        user_id=updated.user_id,
        email=updated.user.email,
        display_name=updated.user.full_name,
        role=updated.role,
        created_at=updated.created_at.isoformat() if updated.created_at else "",
    )


@router.delete(
    "/{document_id}/collaborators/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_collaborator_endpoint(
    document_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a collaborator. Owner can remove anyone; collaborators can remove themselves."""
    role = await get_user_role(db, document_id, current_user.id)
    if role is None:
        raise HTTPException(status_code=404, detail="Document not found")

    # Only the owner or the user themselves can remove
    if role != "owner" and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Only the owner can remove other collaborators")

    removed = await remove_collaborator(db, document_id, user_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Collaborator not found")
    await db.commit()
