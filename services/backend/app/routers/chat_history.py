"""Chat history router — conversation CRUD and title generation."""
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.crud import chat as chat_crud
from app.crud.user_api_key import get_active_key, get_decrypted_api_key
from app.database import get_db
from app.models.user import User
from app.schemas.chat import (
    AddMessageRequest,
    ChatConversationDetail,
    ChatConversationSummary,
    ChatMessageSchema,
    CreateConversationRequest,
    GenerateTitleRequest,
    GenerateTitleResponse,
    UpdateConversationRequest,
)
from app.services.search.providers.factory import get_provider

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/conversations", tags=["chat-history"])


@router.post("/", response_model=ChatConversationDetail, status_code=201)
async def create_conversation(
    request: CreateConversationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new chat conversation."""
    conv = await chat_crud.create_conversation(
        db,
        user_id=current_user.id,
        provider=request.provider,
        scope=request.scope,
        document_id=request.document_id,
    )
    return ChatConversationDetail(
        id=conv.id,
        title=conv.title,
        provider=conv.provider,
        scope=conv.scope,
        document_id=conv.document_id,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        messages=[],
    )


@router.get("/", response_model=list[ChatConversationSummary])
async def list_conversations(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List user's conversations, most recent first."""
    return await chat_crud.get_conversations(db, current_user.id, limit, offset)


@router.get("/{conversation_id}", response_model=ChatConversationDetail)
async def get_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a conversation with all its messages."""
    conv = await chat_crud.get_conversation(db, current_user.id, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


@router.put("/{conversation_id}", response_model=ChatConversationDetail)
async def update_conversation(
    conversation_id: int,
    request: UpdateConversationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a conversation (rename)."""
    conv = await chat_crud.update_conversation(
        db, current_user.id, conversation_id, request.title
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


@router.delete("/{conversation_id}", status_code=204)
async def delete_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a conversation and all its messages."""
    deleted = await chat_crud.delete_conversation(db, current_user.id, conversation_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found")


@router.post(
    "/{conversation_id}/messages",
    response_model=ChatMessageSchema,
    status_code=201,
)
async def add_message(
    conversation_id: int,
    request: AddMessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a message to a conversation."""
    # Verify conversation belongs to user
    conv = await chat_crud.get_conversation(db, current_user.id, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    message = await chat_crud.add_message(
        db,
        conversation_id=conversation_id,
        role=request.role,
        content=request.content,
        metadata_json=request.metadata_json,
    )
    return message


@router.post(
    "/{conversation_id}/generate-title",
    response_model=GenerateTitleResponse,
)
async def generate_title(
    conversation_id: int,
    request: GenerateTitleRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a title for a conversation using the LLM."""
    conv = await chat_crud.get_conversation(db, current_user.id, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Build context from first few messages
    msgs = conv.messages[:4] if conv.messages else []
    if not msgs:
        raise HTTPException(status_code=400, detail="No messages to generate title from")

    context = "\n".join(f"{m.role}: {m.content[:300]}" for m in msgs)
    prompt = (
        f"Generate a concise 3-8 word title for this conversation. "
        f"Return ONLY the title text, nothing else.\n\n{context}"
    )

    # Resolve provider — always prefer Ollama for title generation to conserve
    # external API rate limits (title gen is trivial, doesn't need GPT-5 etc.)
    try:
        llm_provider = await _resolve_provider(db, current_user, "ollama")
    except HTTPException:
        # Ollama unavailable — fall back to the conversation's provider
        provider_name = request.provider or conv.provider or "ollama"
        llm_provider = await _resolve_provider(db, current_user, provider_name)

    # Stream and collect the full title
    title_parts = []
    try:
        async for token in llm_provider.stream(prompt):
            title_parts.append(token)
    except Exception:
        logger.exception("Title generation failed")
        raise HTTPException(status_code=500, detail="Title generation failed")

    title = "".join(title_parts).strip().strip('"\'').strip()
    if not title:
        title = "Untitled conversation"

    # Truncate if too long
    if len(title) > 255:
        title = title[:252] + "…"

    # Save title
    await chat_crud.update_conversation(db, current_user.id, conversation_id, title)

    return GenerateTitleResponse(title=title)


async def _resolve_provider(db: AsyncSession, user: User, provider_name: str):
    """Resolve an LLM provider by name — shared helper."""
    from app.configs.settings import get_settings

    if provider_name in ("openai", "xai", "github"):
        key_row = await get_active_key(db, user.id, provider_name)
        if not key_row:
            raise HTTPException(
                status_code=400,
                detail=f"No active API key configured for provider '{provider_name}'.",
            )
        api_key = get_decrypted_api_key(key_row)
        return get_provider(
            provider_type=provider_name,
            api_key=api_key,
            model=key_row.preferred_model,
            base_url=key_row.base_url,
        )
    else:
        from app.models.site_setting import SiteSetting
        from sqlalchemy import select as _select

        settings = get_settings()
        _db_model = await db.scalar(
            _select(SiteSetting).where(SiteSetting.key == "llm.model")
        )
        _db_url = await db.scalar(
            _select(SiteSetting).where(SiteSetting.key == "llm.url")
        )
        return get_provider(
            provider_type="ollama",
            model=_db_model.value if _db_model else settings.ollama_model,
            base_url=_db_url.value if _db_url else settings.ollama_url,
        )
