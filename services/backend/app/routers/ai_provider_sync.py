"""AI Provider Sync router — remote providers diff & migration for Markdown Manager."""
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs import get_settings
from app.core.auth import get_current_user
from app.database import get_db
from app.models.remote_ai_provider import RemoteAIProvider
from app.models.user import User
from app.services.tm_client import tm_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai-provider-sync", tags=["ai-provider-sync"])


class ImportRequest(BaseModel):
    remote_id: int
    source_app: str


class ExportRequest(BaseModel):
    key_id: int


@router.get("/remote-providers")
async def list_remote_providers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List cached remote AI providers for the current user."""
    result = await db.execute(
        select(RemoteAIProvider)
        .where(RemoteAIProvider.user_id == current_user.id)
        .order_by(RemoteAIProvider.source_app, RemoteAIProvider.provider)
    )
    rows = result.scalars().all()
    return [
        {
            "id": r.id,
            "source_app": r.source_app,
            "remote_id": r.remote_id,
            "provider": r.provider,
            "label": r.label,
            "base_url": r.base_url,
            "preferred_model": r.preferred_model,
            "org_name": r.org_name,
            "is_active": r.is_active,
            "has_key": r.has_key,
            "synced_at": r.synced_at.isoformat() if r.synced_at else None,
        }
        for r in rows
    ]


@router.post("/import")
async def import_from_remote(
    body: ImportRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Import a remote provider's key into Markdown Manager (fetches key via cross-app HTTP)."""
    if body.source_app != "team-manager":
        raise HTTPException(status_code=400, detail="Only team-manager imports are supported")

    try:
        exported = await tm_client.export_provider(current_user.email, body.remote_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    # Import into MM
    from app.crud import user_api_key as crud

    row = await crud.create_key(
        db,
        user_id=current_user.id,
        provider=exported["provider"],
        api_key=exported["api_key"],
        label=exported.get("label", ""),
        base_url=exported.get("base_url"),
        preferred_model=exported.get("preferred_model"),
        org_name=exported.get("org_name"),
    )

    # Publish updated state in background
    background_tasks.add_task(_publish_state, current_user, db)

    return {"id": row.id, "provider": row.provider, "label": row.label}


@router.post("/export")
async def export_to_remote(
    body: ExportRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export a local MM provider key to Team Manager (sends key via cross-app HTTP)."""
    from app.models.user_api_key import UserApiKey, decrypt_api_key

    settings = get_settings()

    result = await db.execute(
        select(UserApiKey).where(
            UserApiKey.id == body.key_id,
            UserApiKey.user_id == current_user.id,
        )
    )
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")

    raw_key = decrypt_api_key(key.api_key_encrypted, settings.secret_key) if key.api_key_encrypted else ""
    if not raw_key:
        raise HTTPException(status_code=400, detail="No API key to export")

    payload = {
        "provider": key.provider,
        "label": key.label or "",
        "api_key": raw_key,
        "base_url": key.base_url or None,
        "preferred_model": key.preferred_model or None,
        "org_name": key.org_name or None,
    }

    try:
        result_data = await tm_client.import_provider(current_user.email, payload)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    return result_data


@router.post("/publish")
async def publish_state(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually trigger publishing of provider state to the event stream."""
    background_tasks.add_task(_publish_state, current_user, db)
    return {"status": "publishing"}


async def _publish_state(user: User, db: AsyncSession):
    try:
        from app.services.ai_provider_events import publish_user_provider_state
        await publish_user_provider_state(user, db)
    except Exception as exc:
        logger.warning("Failed to publish provider state: %s", exc)
