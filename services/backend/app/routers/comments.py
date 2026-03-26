"""Document comments / annotations endpoints."""
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import get_current_user
from app.database import get_db
from app.models.comment import Comment
from app.models.document import Document
from app.models.user import User
from app.routers.notifications import create_notification

logger = logging.getLogger(__name__)
router = APIRouter(tags=["comments"])


# ---------- Schemas ----------

class CommentCreate(BaseModel):
    content: str
    line_number: Optional[int] = None
    parent_id: Optional[int] = None


class CommentUpdate(BaseModel):
    content: Optional[str] = None
    status: Optional[str] = None  # open, resolved


class CommentAuthor(BaseModel):
    id: int
    display_name: str

    model_config = {"from_attributes": True}


class CommentOut(BaseModel):
    id: int
    document_id: int
    user_id: int
    author: Optional[CommentAuthor] = None
    content: str
    line_number: Optional[int] = None
    parent_id: Optional[int] = None
    status: str
    created_at: datetime
    updated_at: datetime
    replies: list["CommentOut"] = []

    model_config = {"from_attributes": True}


class CommentListResponse(BaseModel):
    comments: list[CommentOut]
    total: int


# ---------- Endpoints ----------

@router.get("/documents/{document_id}/comments", response_model=CommentListResponse)
async def list_comments(
    document_id: int,
    line_number: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List comments for a document. Optionally filter by line or status."""
    query = (
        select(Comment)
        .where(Comment.document_id == document_id, Comment.parent_id == None)  # noqa: E711 — top-level only
        .options(selectinload(Comment.replies))
    )

    if line_number is not None:
        query = query.where(Comment.line_number == line_number)
    if status_filter:
        query = query.where(Comment.status == status_filter)

    query = query.order_by(Comment.line_number.asc().nullslast(), Comment.created_at.asc())

    result = await db.execute(query)
    comments = result.scalars().unique().all()

    # Build author info
    out = []
    for c in comments:
        out.append(await _to_comment_out(c, db))

    # Count total (including replies)
    count_q = select(func.count()).select_from(Comment).where(Comment.document_id == document_id)
    total = (await db.execute(count_q)).scalar() or 0

    return CommentListResponse(comments=out, total=total)


@router.post("/documents/{document_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
async def create_comment(
    document_id: int,
    body: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new comment on a document."""
    comment = Comment(
        document_id=document_id,
        user_id=current_user.id,
        content=body.content,
        line_number=body.line_number,
        parent_id=body.parent_id,
    )
    db.add(comment)
    await db.flush()

    # Notify: reply → parent author, top-level → document owner
    if body.parent_id:
        parent_result = await db.execute(select(Comment).where(Comment.id == body.parent_id))
        parent_comment = parent_result.scalar_one_or_none()
        if parent_comment and parent_comment.user_id != current_user.id:
            await create_notification(
                db, parent_comment.user_id,
                "Reply to your comment",
                f"{current_user.full_name} replied to your comment",
                category="comment",
                link=f"/documents/{document_id}",
            )
    else:
        doc_result = await db.execute(select(Document).where(Document.id == document_id))
        doc = doc_result.scalar_one_or_none()
        if doc and doc.user_id != current_user.id:
            await create_notification(
                db, doc.user_id,
                "New comment on your document",
                f"{current_user.full_name} commented on \"{doc.name}\"",
                category="comment",
                link=f"/documents/{document_id}",
            )

    await db.commit()
    await db.refresh(comment)
    return await _to_comment_out(comment, db)


@router.patch("/comments/{comment_id}", response_model=CommentOut)
async def update_comment(
    comment_id: int,
    body: CommentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a comment's content or status. Only the author can edit content."""
    result = await db.execute(select(Comment).where(Comment.id == comment_id))
    comment = result.scalar_one_or_none()

    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    if body.content is not None:
        if comment.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the author can edit content")
        comment.content = body.content

    if body.status is not None:
        if body.status not in ("open", "resolved"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Status must be 'open' or 'resolved'")
        comment.status = body.status

        # Notify comment author when their comment is resolved (by someone else)
        if body.status == "resolved" and comment.user_id != current_user.id:
            await create_notification(
                db, comment.user_id,
                "Comment resolved",
                f"{current_user.full_name} resolved your comment",
                category="comment",
                link=f"/documents/{comment.document_id}",
            )

    await db.commit()
    await db.refresh(comment)
    return await _to_comment_out(comment, db)


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a comment. Only the author or an admin can delete."""
    result = await db.execute(select(Comment).where(Comment.id == comment_id))
    comment = result.scalar_one_or_none()

    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    if comment.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this comment")

    await db.delete(comment)
    await db.commit()


# ---------- Helpers ----------

async def _to_comment_out(comment: Comment, db: AsyncSession) -> CommentOut:
    """Convert a Comment model instance to CommentOut, loading author info."""
    # Load author (user)
    from app.models.user import User as UserModel
    user_result = await db.execute(select(UserModel).where(UserModel.id == comment.user_id))
    user = user_result.scalar_one_or_none()

    author = None
    if user:
        author = CommentAuthor(id=user.id, display_name=user.full_name)

    replies_out = []
    if hasattr(comment, 'replies') and comment.replies:
        for r in comment.replies:
            replies_out.append(await _to_comment_out(r, db))

    return CommentOut(
        id=comment.id,
        document_id=comment.document_id,
        user_id=comment.user_id,
        author=author,
        content=comment.content,
        line_number=comment.line_number,
        parent_id=comment.parent_id,
        status=comment.status,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
        replies=replies_out,
    )
