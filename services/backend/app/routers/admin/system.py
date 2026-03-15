"""Admin system router — LLM config, reindexing, and site-wide statistics."""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import Integer as sa_Integer, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_admin_user
from app.database import get_db
from app.models.document import Document
from app.models.document_embedding import DocumentEmbedding
from app.models.site_setting import SiteSetting
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Admin - System"])

# ── Settings key constants ────────────────────────────────────────────────────
_KEY_LLM_MODEL = "llm.model"
_KEY_LLM_URL = "llm.url"


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class LLMConfig(BaseModel):
    model: str
    url: str
    available_models: list[str] = []
    source: str = "env"  # "env" | "db"


class LLMUpdateRequest(BaseModel):
    model: Optional[str] = None
    url: Optional[str] = None


class ReindexRequest(BaseModel):
    user_id: Optional[int] = None  # None = all users


class ReindexResponse(BaseModel):
    indexed: int
    skipped: int
    failed: int
    users_processed: int


class SiteStats(BaseModel):
    total_users: int
    active_users: int
    total_documents: int
    total_embeddings: int
    embeddings_with_summary: int
    embeddings_missing: int
    llm_model: str
    llm_url: str
    generated_at: datetime


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_setting(db: AsyncSession, key: str) -> str | None:
    row = await db.scalar(select(SiteSetting).where(SiteSetting.key == key))
    return row.value if row else None


async def _set_setting(db: AsyncSession, key: str, value: str, description: str = "") -> None:
    row = await db.scalar(select(SiteSetting).where(SiteSetting.key == key))
    if row:
        row.value = value
    else:
        db.add(SiteSetting(key=key, value=value, description=description))
    await db.commit()


def _default_ollama_url() -> str:
    from app.configs.settings import get_settings
    return get_settings().ollama_url


def _default_ollama_model() -> str:
    from app.configs.settings import get_settings
    return get_settings().ollama_model


async def _effective_llm_config(db: AsyncSession) -> tuple[str, str, str]:
    """Return (model, url, source) — DB overrides env."""
    db_model = await _get_setting(db, _KEY_LLM_MODEL)
    db_url = await _get_setting(db, _KEY_LLM_URL)
    model = db_model or _default_ollama_model()
    url = db_url or _default_ollama_url()
    source = "db" if (db_model or db_url) else "env"
    return model, url, source


async def _list_ollama_models(url: str) -> list[str]:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{url.rstrip('/')}/api/tags")
            if r.status_code == 200:
                data = r.json()
                return [m["name"] for m in data.get("models", [])]
    except Exception:
        pass
    return []


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=SiteStats)
async def get_site_stats(
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Site-wide statistics dashboard."""
    total_users = await db.scalar(select(func.count(User.id))) or 0
    active_users = await db.scalar(
        select(func.count(User.id)).where(User.is_active.is_(True))
    ) or 0
    total_documents = await db.scalar(select(func.count(Document.id))) or 0
    total_embeddings = await db.scalar(select(func.count(DocumentEmbedding.id))) or 0
    embeddings_with_summary = await db.scalar(
        select(func.count(DocumentEmbedding.id)).where(
            DocumentEmbedding.summary.is_not(None),
            DocumentEmbedding.summary != "",
        )
    ) or 0

    model, url, _ = await _effective_llm_config(db)

    return SiteStats(
        total_users=total_users,
        active_users=active_users,
        total_documents=total_documents,
        total_embeddings=total_embeddings,
        embeddings_with_summary=embeddings_with_summary,
        embeddings_missing=total_documents - total_embeddings,
        llm_model=model,
        llm_url=url,
        generated_at=datetime.utcnow(),
    )


@router.get("/llm", response_model=LLMConfig)
async def get_llm_config(
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Get current LLM configuration and list of available models from Ollama."""
    model, url, source = await _effective_llm_config(db)
    available = await _list_ollama_models(url)
    return LLMConfig(model=model, url=url, available_models=available, source=source)


@router.put("/llm", response_model=LLMConfig)
async def update_llm_config(
    request: LLMUpdateRequest,
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Update the active LLM model and/or URL.

    Persisted to the `site_settings` table — takes effect immediately for all
    subsequent chat requests without restarting the backend.
    """
    if request.model is not None:
        await _set_setting(db, _KEY_LLM_MODEL, request.model, "Active Ollama model name")
    if request.url is not None:
        await _set_setting(db, _KEY_LLM_URL, request.url.rstrip("/"), "Ollama API base URL")

    model, url, source = await _effective_llm_config(db)
    available = await _list_ollama_models(url)
    return LLMConfig(model=model, url=url, available_models=available, source=source)


@router.delete("/llm")
async def reset_llm_config(
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Reset LLM config to environment defaults (removes DB overrides)."""
    for key in (_KEY_LLM_MODEL, _KEY_LLM_URL):
        row = await db.scalar(select(SiteSetting).where(SiteSetting.key == key))
        if row:
            await db.delete(row)
    await db.commit()
    model, url, source = await _effective_llm_config(db)
    return {"model": model, "url": url, "source": source, "message": "Reset to environment defaults"}


@router.post("/reindex", response_model=ReindexResponse)
async def site_reindex(
    request: ReindexRequest,
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Re-index document embeddings.

    - `user_id=null` — re-index ALL users (site-wide).
    - `user_id=<id>` — re-index a specific user only.

    Documents whose content hash hasn't changed are skipped.
    """
    from app.configs.settings import get_settings
    from app.services.search.embedding_client import EmbeddingClient
    from app.services.search.semantic import SemanticSearchService

    settings = get_settings()
    client = EmbeddingClient(base_url=settings.embedding_service_url)
    search = SemanticSearchService(client)

    if request.user_id is not None:
        # Single-user reindex
        user = await db.scalar(select(User).where(User.id == request.user_id))
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        counts = await search.bulk_reindex(db, request.user_id)
        return ReindexResponse(users_processed=1, **counts)

    # Site-wide reindex
    users = (await db.execute(select(User).where(User.is_active.is_(True)))).scalars().all()
    totals = {"indexed": 0, "skipped": 0, "failed": 0}
    for user in users:
        try:
            counts = await search.bulk_reindex(db, user.id)
            for k in totals:
                totals[k] += counts[k]
        except Exception:
            logger.exception("Reindex failed for user %s", user.id)
            totals["failed"] += 1

    return ReindexResponse(users_processed=len(users), **totals)


@router.get("/reindex/status")
async def get_reindex_status(
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Per-user embedding coverage — helps identify users needing reindex."""
    rows = await db.execute(
        select(
            User.id,
            User.email,
            func.count(Document.id).label("doc_count"),
            func.count(DocumentEmbedding.id).label("emb_count"),
            func.sum(
                func.cast(
                    DocumentEmbedding.summary.is_not(None) & (DocumentEmbedding.summary != ""),
                    sa_Integer,
                )
            ).label("summary_count"),
        )
        .outerjoin(Document, Document.user_id == User.id)
        .outerjoin(DocumentEmbedding, DocumentEmbedding.document_id == Document.id)
        .where(User.is_active.is_(True))
        .group_by(User.id, User.email)
        .order_by(User.email)
    )
    data = rows.all()
    return [
        {
            "user_id": r.id,
            "email": r.email,
            "documents": r.doc_count or 0,
            "embeddings": r.emb_count or 0,
            "summaries": r.summary_count or 0,
            "coverage_pct": round(100 * (r.emb_count or 0) / r.doc_count, 1)
            if r.doc_count else 100.0,
        }
        for r in data
    ]
