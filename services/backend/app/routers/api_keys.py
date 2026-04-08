"""API key management router — per-user CRUD for third-party LLM provider keys."""
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.crud import user_api_key as crud
from app.database import get_db
from app.models.user import User
from app.schemas.user_api_key import (
    ApiKeyCreate,
    ApiKeyListResponse,
    ApiKeyResponse,
    ApiKeyUpdate,
)
from app.services.search.providers.factory import get_provider

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api-keys", tags=["api-keys"])


@router.get("", response_model=ApiKeyListResponse)
async def list_keys(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all API keys for the current user (keys are never returned)."""
    keys = await crud.get_keys_for_user(db, current_user.id)
    return ApiKeyListResponse(keys=[ApiKeyResponse.model_validate(k) for k in keys])


@router.post("", response_model=ApiKeyResponse, status_code=201)
async def add_key(
    body: ApiKeyCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Store a new encrypted API key for a provider."""
    row = await crud.create_key(
        db,
        user_id=current_user.id,
        provider=body.provider,
        api_key=body.api_key,
        label=body.label,
        base_url=body.base_url,
        preferred_model=body.preferred_model,
    )
    return ApiKeyResponse.model_validate(row)


@router.put("/{key_id}", response_model=ApiKeyResponse)
async def update_key(
    key_id: int,
    body: ApiKeyUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing API key configuration."""
    kwargs: dict = {}
    if body.label is not None:
        kwargs["label"] = body.label
    if body.base_url is not None:
        kwargs["base_url"] = body.base_url
    if body.preferred_model is not None:
        kwargs["preferred_model"] = body.preferred_model
    if body.is_active is not None:
        kwargs["is_active"] = body.is_active
    if body.api_key is not None:
        kwargs["api_key"] = body.api_key

    row = await crud.update_key(db, key_id, current_user.id, **kwargs)
    if row is None:
        raise HTTPException(status_code=404, detail="API key not found")
    return ApiKeyResponse.model_validate(row)


@router.delete("/{key_id}", status_code=204)
async def delete_key(
    key_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an API key."""
    deleted = await crud.delete_key(db, key_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="API key not found")


@router.post("/{key_id}/test")
async def test_key(
    key_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Test an API key by making a lightweight health-check call to the provider."""
    row = await crud.get_key_by_id(db, key_id, current_user.id)
    if row is None:
        raise HTTPException(status_code=404, detail="API key not found")

    api_key = crud.get_decrypted_api_key(row)
    try:
        provider = get_provider(
            provider_type=row.provider,
            api_key=api_key,
            model=row.preferred_model,
            base_url=row.base_url,
        )
        ok = await provider.health_check()
    except Exception as exc:
        logger.warning("API key test failed for key_id=%d: %s", key_id, exc)
        return {"success": False, "error": str(exc)}

    return {"success": ok, "provider": row.provider, "model": provider.model_name}


@router.post("/{key_id}/models")
async def list_models(
    key_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch available models from the provider using the user's API key."""
    row = await crud.get_key_by_id(db, key_id, current_user.id)
    if row is None:
        raise HTTPException(status_code=404, detail="API key not found")

    api_key = crud.get_decrypted_api_key(row)
    try:
        provider = get_provider(
            provider_type=row.provider,
            api_key=api_key,
            model=row.preferred_model,
            base_url=row.base_url,
        )
        models = await provider.list_models()
    except Exception as exc:
        logger.warning("Model listing failed for key_id=%d: %s", key_id, exc)
        return {"models": [], "error": str(exc)}

    return {"models": models, "provider": row.provider}
