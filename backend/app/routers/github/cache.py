"""GitHub cache management endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.github.cache import github_cache_service
from app.services.github.background import github_background_sync
from app.core.github_security import github_security
from app.models.user import User
from app.core.auth import get_current_user

router = APIRouter()


@router.get("/stats")
async def get_cache_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get cache statistics."""
    stats = await github_cache_service.get_cache_stats()
    return stats


@router.post("/clear")
async def clear_cache(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Clear all GitHub cache entries."""
    success = await github_cache_service.clear_all_cache()
    
    if success:
        # Log the action for security
        await github_security.audit_log_action(
            db=db,
            user_id=current_user.id,
            action="cache_clear",
            resource="github_cache",
            details={"initiated_by": "user_request"}
        )
        
        return {"message": "Cache cleared successfully", "success": True}
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to clear cache"
        )


@router.post("/refresh-repositories/{account_id}")
async def refresh_repositories_cache(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Force refresh repositories cache for a specific account."""
    try:
        await github_cache_service.invalidate_repository_cache(account_id)
        
        # Log the action
        await github_security.audit_log_action(
            db=db,
            user_id=current_user.id,
            action="cache_refresh",
            resource=f"repositories:account:{account_id}",
            details={"type": "repositories", "account_id": account_id}
        )
        
        return {"message": "Repository cache refreshed", "account_id": account_id}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to refresh cache: {str(e)}"
        )


@router.get("/sync-status")
async def get_sync_status(
    current_user: User = Depends(get_current_user)
):
    """Get background sync service status."""
    status_info = github_background_sync.get_sync_status()
    return status_info


@router.post("/sync/start")
async def start_background_sync(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Start the background sync service."""
    try:
        await github_background_sync.start()
        
        # Log the action
        await github_security.audit_log_action(
            db=db,
            user_id=current_user.id,
            action="sync_start",
            resource="background_sync",
            details={"service": "github_background_sync"}
        )
        
        return {"message": "Background sync started", "running": True}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start sync: {str(e)}"
        )


@router.post("/sync/stop")
async def stop_background_sync(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Stop the background sync service."""
    try:
        github_background_sync.stop()
        
        # Log the action
        await github_security.audit_log_action(
            db=db,
            user_id=current_user.id,
            action="sync_stop",
            resource="background_sync",
            details={"service": "github_background_sync"}
        )
        
        return {"message": "Background sync stopped", "running": False}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to stop sync: {str(e)}"
        )


@router.post("/sync/force-all")
async def force_sync_all_documents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Force sync all GitHub documents immediately."""
    try:
        stats = await github_background_sync.force_sync_all_documents()
        
        # Log the action
        await github_security.audit_log_action(
            db=db,
            user_id=current_user.id,
            action="force_sync_all",
            resource="all_documents",
            details={"stats": stats}
        )
        
        return {
            "message": "Force sync completed",
            "stats": stats
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to force sync: {str(e)}"
        )
