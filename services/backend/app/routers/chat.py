"""Chat / Q&A router — streams answers from Ollama using document context."""
import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.settings import get_settings
from app.core.auth import get_current_user
from app.database import get_db
from app.models.user import User
from app.services.search.embedding_client import EmbeddingClient
from app.services.search.qa import QAService
from app.services.search.semantic import SemanticSearchService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


def _get_qa_service(model: str | None = None, ollama_url: str | None = None) -> QAService:
    settings = get_settings()
    client = EmbeddingClient(base_url=settings.embedding_service_url)
    search_service = SemanticSearchService(client)
    return QAService(
        search_service=search_service,
        ollama_url=ollama_url or settings.ollama_url,
        model=model or settings.ollama_model,
    )


class AskRequest(BaseModel):
    question: str
    document_id: int | None = None  # None = search all docs, int = current doc only
    deep_think: bool = False        # True = full doc context (only valid with document_id)


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
    """
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="question must not be empty")

    # Read LLM config from DB (admin overrides), fall back to env defaults
    from app.models.site_setting import SiteSetting
    from sqlalchemy import select as _select
    _db_model = await db.scalar(_select(SiteSetting).where(SiteSetting.key == "llm.model"))
    _db_url = await db.scalar(_select(SiteSetting).where(SiteSetting.key == "llm.url"))
    qa = _get_qa_service(
        model=_db_model.value if _db_model else None,
        ollama_url=_db_url.value if _db_url else None,
    )

    # deep_think only meaningful in single-doc mode; ignore for all-docs queries
    deep_think = request.deep_think and request.document_id is not None

    async def token_stream():
        try:
            async for token in qa.answer_stream(
                db,
                current_user.id,
                request.question,
                document_id=request.document_id,
                deep_think=deep_think,
            ):
                # JSON-encode so embedded newlines and special chars survive SSE transport
                yield f"data: {json.dumps(token)}\n\n"
        except Exception:
            logger.exception("Error during Q&A streaming")
            yield f"data: {json.dumps('[ERROR] An error occurred while generating the answer.')}\n\n"
        finally:
            yield f"data: {json.dumps('[DONE]')}\n\n"

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
