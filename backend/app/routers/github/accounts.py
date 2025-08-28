"""GitHub accounts management endpoints."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.database import get_db
from app.models import User
from app.schemas.github import GitHubAccount
from app.crud.github_crud import GitHubCRUD

router = APIRouter()


@router.get("/", response_model=List[GitHubAccount])
async def list_github_accounts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[GitHubAccount]:
    """List user's GitHub accounts with repository counts."""
    github_crud = GitHubCRUD()

    accounts = await github_crud.get_user_accounts(db, current_user.id)

    # Add repository count to each account
    enhanced_accounts = []
    for account in accounts:
        account_dict = {
            "id": account.id,
            "github_id": account.github_id,
            "username": account.username,
            "display_name": account.display_name,
            "email": account.email,
            "avatar_url": account.avatar_url,
            "is_active": account.is_active,
            "user_id": account.user_id,
            "created_at": account.created_at,
            "updated_at": account.updated_at,
            "last_sync": account.last_sync,
            "repository_count": len(account.repositories) if account.repositories else 0
        }
        enhanced_accounts.append(GitHubAccount(**account_dict))

    return enhanced_accounts


@router.delete("/{account_id}")
async def disconnect_github_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Disconnect a GitHub account."""
    github_crud = GitHubCRUD()

    account = await github_crud.get_account(db, account_id)
    if not account or account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GitHub account not found"
        )

    await github_crud.delete_account(db, account_id)
    return {"message": "GitHub account disconnected successfully"}
