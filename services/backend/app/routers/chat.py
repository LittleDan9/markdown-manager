"""Chat / Q&A router — streams answers from LLM providers using document context."""
import json
import logging

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.settings import get_settings
from app.core.auth import get_current_user
from app.crud.user_api_key import get_active_key, get_decrypted_api_key, get_key_by_id
from app.database import get_db
from app.models.user import User
from app.services.search.embedding_client import EmbeddingClient
from app.services.search.providers.base import LLMProvider
from app.services.search.providers.factory import get_provider
from app.services.search.qa import QAService
from app.services.search.semantic import SemanticSearchService

logger = logging.getLogger(__name__)

from app.routers.chat_history import router as chat_history_router

router = APIRouter(prefix="/chat", tags=["chat"])
router.include_router(chat_history_router)


def _build_qa_service(provider: LLMProvider) -> QAService:
    """Create a QAService wired to the given LLM provider."""
    settings = get_settings()
    client = EmbeddingClient(base_url=settings.embedding_service_url)
    try:
        redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)
    except Exception:
        redis_client = None
    search_service = SemanticSearchService(client, redis_client=redis_client)
    return QAService(search_service=search_service, provider=provider)


def _get_qa_service(model: str | None = None, ollama_url: str | None = None) -> QAService:
    """Legacy helper — builds a QAService backed by Ollama."""
    settings = get_settings()
    provider = get_provider(
        provider_type="ollama",
        model=model or settings.ollama_model,
        base_url=ollama_url or settings.ollama_url,
    )
    return _build_qa_service(provider)


class ChatMessage(BaseModel):
    role: str   # "user" or "assistant"
    content: str


class AskRequest(BaseModel):
    question: str
    document_id: int | None = None   # None = search all docs, int = current doc only
    category_id: int | None = None   # None = all categories, int = limit to this category
    deep_think: bool = False         # True = full doc context (only valid with document_id)
    history: list[ChatMessage] = []  # Previous turns for conversational context
    provider: str | None = None      # "ollama", "openai", "xai"; None = default (Ollama)
    key_id: int | None = None        # Specific API key ID; overrides provider-based lookup
    model: str | None = None         # Override model at chat-time (from model picker)
    selection_context: str | None = None  # Optional editor-selected text to include as context
    strict_context: bool = False     # True = only answer from document content, no general knowledge
    help_mode: bool = False          # True = answer product questions using built-in help docs


@router.post("/ask")
async def ask(
    request: AskRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Ask a question about your documents.

    Streams the answer as plain text tokens using Server-Sent Events.

    - `document_id=null` → searches all user documents (All Docs mode)
    - `document_id=<id>` → uses only that document as context (Current Doc mode)
    - `category_id=<id>` → restricts All Docs search to a specific category
    """
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="question must not be empty")

    # ---- Resolve LLM provider ------------------------------------------------
    requested_provider = request.provider or "ollama"

    if request.key_id is not None:
        # Look up the specific key by ID — supports multi-key per provider
        logger.info("Chat provider resolution: key_id=%s (user=%s)", request.key_id, current_user.id)
        key_row = await get_key_by_id(db, request.key_id, current_user.id)
        if not key_row:
            raise HTTPException(
                status_code=404,
                detail="API key not found or does not belong to you.",
            )
        if not key_row.is_active:
            raise HTTPException(
                status_code=400,
                detail="The selected API key is inactive.",
            )
        requested_provider = key_row.provider
        api_key = get_decrypted_api_key(key_row)
        llm_provider = get_provider(
            provider_type=requested_provider,
            api_key=api_key,
            model=request.model or key_row.preferred_model,
            base_url=key_row.base_url,
            org_name=key_row.org_name,
        )
        qa = _build_qa_service(llm_provider)
    elif requested_provider in ("openai", "xai", "github", "gemini"):
        # Look up the user's stored (encrypted) key for the requested provider
        logger.info(
            "Chat provider resolution: remote provider=%s (user=%s)",
            requested_provider, current_user.id,
        )
        key_row = await get_active_key(db, current_user.id, requested_provider)
        if not key_row:
            raise HTTPException(
                status_code=400,
                detail=f"No active API key configured for provider '{requested_provider}'. "
                       "Add one in User Settings → AI Providers.",
            )
        api_key = get_decrypted_api_key(key_row)
        llm_provider = get_provider(
            provider_type=requested_provider,
            api_key=api_key,
            model=request.model or key_row.preferred_model,
            base_url=key_row.base_url,
            org_name=key_row.org_name,
        )
        qa = _build_qa_service(llm_provider)
    else:
        # Ollama — honour admin overrides from SiteSetting
        logger.info("Chat provider resolution: ollama (user=%s, model=%s)", current_user.id, request.model)
        from app.models.site_setting import SiteSetting
        from sqlalchemy import select as _select
        _db_model = await db.scalar(_select(SiteSetting).where(SiteSetting.key == "llm.model"))
        _db_url = await db.scalar(_select(SiteSetting).where(SiteSetting.key == "llm.url"))
        qa = _get_qa_service(
            model=request.model or (_db_model.value if _db_model else None),
            ollama_url=_db_url.value if _db_url else None,
        )

    # deep_think only meaningful in single-doc mode; ignore for all-docs/help queries
    deep_think = request.deep_think and request.document_id is not None and not request.help_mode
    # category_id only meaningful in all-docs mode; ignore for single-doc/help queries
    category_id = request.category_id if request.document_id is None and not request.help_mode else None

    async def token_stream():
        try:
            async for token in qa.answer_stream(
                db,
                current_user.id,
                request.question,
                document_id=request.document_id,
                category_id=category_id,
                deep_think=deep_think,
                history=request.history,
                selection_context=request.selection_context,
                strict_context=request.strict_context,
                help_mode=request.help_mode,
            ):
                if isinstance(token, dict) and token.get("__metrics__"):
                    metrics_payload = {
                        k: v for k, v in token.items()
                        if k != "__metrics__"
                    }
                    event = {"type": "metrics", "data": metrics_payload}
                    yield f"data: {json.dumps(event)}\n\n"
                elif isinstance(token, dict) and "__sections__" in token:
                    event = {"type": "sections", "data": token["__sections__"]}
                    yield f"data: {json.dumps(event)}\n\n"
                else:
                    # JSON-encode so embedded newlines and special chars survive SSE transport
                    yield f"data: {json.dumps(token)}\n\n"
        except Exception as exc:
            logger.exception("Error during Q&A streaming (provider=%s)", requested_provider)
            # Surface useful detail for known error types
            msg = str(exc) if str(exc) else "An error occurred while generating the answer."
            yield f"data: {json.dumps(f'[ERROR] {msg}')}\n\n"
        finally:
            yield f"data: {json.dumps('[DONE]')}\n\n"
            # Explicitly close the DB session to prevent connection leaks
            # during long-running SSE generators
            await db.close()

    return StreamingResponse(
        token_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable nginx buffering for SSE
        },
    )


@router.get("/health")
async def chat_health():
    """Check availability of embedding and Ollama services."""
    settings = get_settings()
    qa = _get_qa_service()

    embedding_ok = await EmbeddingClient(base_url=settings.embedding_service_url).health_check()
    ollama_ok = await qa.health_check()

    status = "ok" if (embedding_ok and ollama_ok) else "degraded"

    return {
        "status": status,
        "embedding_service": "ok" if embedding_ok else "unavailable",
        "ollama": "ok" if ollama_ok else "unavailable",
    }


@router.get("/models/ollama")
async def list_ollama_models(
    current_user: User = Depends(get_current_user),
):
    """List locally-available Ollama models (no API key required)."""
    settings = get_settings()
    provider = get_provider(
        provider_type="ollama",
        model=settings.ollama_model,
        base_url=settings.ollama_url,
    )
    try:
        models = await provider.list_models()
    except Exception as exc:
        logger.warning("Failed to list Ollama models: %s", exc)
        models = []
    return {"models": models, "provider": "ollama"}
