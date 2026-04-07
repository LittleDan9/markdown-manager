"""CRUD operations for chat conversations and messages."""
from datetime import datetime

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat import ChatConversation, ChatMessage


async def create_conversation(
    db: AsyncSession,
    user_id: int,
    provider: str | None = None,
    scope: str | None = None,
    document_id: int | None = None,
) -> ChatConversation:
    """Create a new chat conversation."""
    conversation = ChatConversation(
        user_id=user_id,
        provider=provider,
        scope=scope,
        document_id=document_id,
    )
    db.add(conversation)
    await db.commit()
    await db.refresh(conversation)
    return conversation


async def get_conversations(
    db: AsyncSession,
    user_id: int,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    """Get conversation summaries for a user, ordered by most recent."""
    # Subquery for message count
    msg_count = (
        select(func.count(ChatMessage.id))
        .where(ChatMessage.conversation_id == ChatConversation.id)
        .correlate(ChatConversation)
        .scalar_subquery()
    )

    # Subquery for first user message preview
    first_msg = (
        select(ChatMessage.content)
        .where(
            ChatMessage.conversation_id == ChatConversation.id,
            ChatMessage.role == "user",
        )
        .order_by(ChatMessage.created_at)
        .limit(1)
        .correlate(ChatConversation)
        .scalar_subquery()
    )

    stmt = (
        select(
            ChatConversation,
            msg_count.label("message_count"),
            first_msg.label("first_message_preview"),
        )
        .where(ChatConversation.user_id == user_id)
        .order_by(ChatConversation.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )

    result = await db.execute(stmt)
    rows = result.all()

    summaries = []
    for conv, count, preview in rows:
        summaries.append({
            "id": conv.id,
            "title": conv.title,
            "provider": conv.provider,
            "scope": conv.scope,
            "document_id": conv.document_id,
            "created_at": conv.created_at,
            "updated_at": conv.updated_at,
            "message_count": count or 0,
            "first_message_preview": (preview[:100] + "…") if preview and len(preview) > 100 else preview,
        })

    return summaries


async def get_conversation(
    db: AsyncSession,
    user_id: int,
    conversation_id: int,
) -> ChatConversation | None:
    """Get a single conversation with messages, scoped to user."""
    stmt = select(ChatConversation).where(
        ChatConversation.id == conversation_id,
        ChatConversation.user_id == user_id,
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def update_conversation(
    db: AsyncSession,
    user_id: int,
    conversation_id: int,
    title: str,
) -> ChatConversation | None:
    """Update conversation title, scoped to user."""
    conv = await get_conversation(db, user_id, conversation_id)
    if not conv:
        return None
    conv.title = title
    conv.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(conv)
    return conv


async def delete_conversation(
    db: AsyncSession,
    user_id: int,
    conversation_id: int,
) -> bool:
    """Delete a conversation and its messages (cascade), scoped to user."""
    conv = await get_conversation(db, user_id, conversation_id)
    if not conv:
        return False
    await db.delete(conv)
    await db.commit()
    return True


async def add_message(
    db: AsyncSession,
    conversation_id: int,
    role: str,
    content: str,
    metadata_json: str | None = None,
) -> ChatMessage:
    """Add a message to a conversation and touch updated_at."""
    message = ChatMessage(
        conversation_id=conversation_id,
        role=role,
        content=content,
        metadata_json=metadata_json,
    )
    db.add(message)

    # Touch conversation updated_at so it sorts to top
    stmt = select(ChatConversation).where(ChatConversation.id == conversation_id)
    result = await db.execute(stmt)
    conv = result.scalar_one_or_none()
    if conv:
        conv.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(message)
    return message


async def delete_all_conversations(
    db: AsyncSession,
    user_id: int,
) -> int:
    """Delete all conversations for a user. Returns count deleted."""
    stmt = (
        delete(ChatConversation)
        .where(ChatConversation.user_id == user_id)
        .returning(ChatConversation.id)
    )
    result = await db.execute(stmt)
    count = len(result.all())
    await db.commit()
    return count
