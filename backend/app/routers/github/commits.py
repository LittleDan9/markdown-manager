"""GitHub commit workflow endpoints."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.database import get_db
from app.models import User
from app.schemas.github import GitHubCommitRequest, GitHubCommitResponse
from app.services.github_service import GitHubService
from app.services.github.cache import github_cache_service
from app.crud.github_crud import GitHubCRUD

router = APIRouter()
github_service = GitHubService()


async def _validate_document_and_repository(
    db: AsyncSession,
    document_id: int,
    current_user: User
) -> tuple:
    """Validate document and repository access."""
    from app.crud.document import DocumentCRUD

    document_crud = DocumentCRUD()
    github_crud = GitHubCRUD()

    # Get document and verify ownership
    document = await document_crud.get(db, document_id)
    if not document or document.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # Verify it's a GitHub document
    if not document.github_repository_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document is not linked to GitHub"
        )

    # Get repository and account
    repository = await github_crud.get_repository(db, document.github_repository_id)
    if not repository:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GitHub repository not found"
        )

    account = repository.account
    if not account or account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this repository"
        )

    return document, repository, account


def _determine_target_branch(
    commit_request: GitHubCommitRequest,
    document,
    repository
) -> str:
    """Determine the target branch for the commit."""
    target_branch = commit_request.branch or document.github_branch or repository.default_branch
    create_new_branch = commit_request.create_new_branch and bool(commit_request.new_branch_name)

    if create_new_branch and commit_request.new_branch_name:
        target_branch = commit_request.new_branch_name

    return target_branch


async def _check_for_conflicts(
    commit_request: GitHubCommitRequest,
    document,
    account,
    repository
) -> None:
    """Check for conflicts if not forcing commit."""
    if commit_request.force_commit:
        return

    try:
        # Get current file content from GitHub with caching
        async def fetch_remote_file():
            content, sha = await github_service.get_file_content(
                account.access_token,
                repository.repo_owner,
                repository.repo_name,
                document.github_file_path or "",
                ref=document.github_branch or "main"
            )
            return {"content": content, "sha": sha}

        cached_result = await github_cache_service.get_or_fetch_file_content(
            document.github_repository_id,
            document.github_file_path or "",
            document.github_branch or "main",
            fetch_remote_file,
            force_refresh=False
        )
        
        remote_sha = cached_result["sha"]

        # Check if remote file has changed since last sync
        if remote_sha != document.github_sha:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Remote file has been modified since last sync. Use force_commit=true to override."
            )
    except Exception as e:
        # If we can't get the file, it might not exist, which is okay for new files
        if "not found" not in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error checking remote file status: {str(e)}"
            )


async def _perform_commit(
    commit_request: GitHubCommitRequest,
    document,
    account,
    repository,
    target_branch: str
) -> dict:
    """Perform the actual commit to GitHub."""
    # Create new branch if requested
    if commit_request.create_new_branch and commit_request.new_branch_name:
        print(f"Creating new branch: {commit_request.new_branch_name}")
        # Branch creation will be handled by the commit_file method

    # Determine SHA to use for commit
    sha_to_use = document.github_sha  # Default to document SHA
    print("=== SHA Determination ===")
    print(f"Document GitHub SHA: {document.github_sha}")
    print(f"Force Commit: {commit_request.force_commit}")
    
    if commit_request.force_commit:
        print("Force commit requested - fetching remote SHA")
        try:
            from app.services.github.cache import github_cache_service
            
            async def fetch_remote_file():
                content, sha = await github_service.get_file_content(
                    account.access_token,
                    repository.repo_owner,
                    repository.repo_name,
                    document.github_file_path or "",
                    ref=target_branch
                )
                return {"content": content, "sha": sha}

            cached_result = await github_cache_service.get_or_fetch_file_content(
                document.github_repository_id,
                document.github_file_path or "",
                target_branch,
                fetch_remote_file,
                force_refresh=True  # Force refresh for commit
            )
            
            sha_to_use = cached_result["sha"]
            print(f"Force commit: Using remote SHA {sha_to_use} instead of local SHA {document.github_sha}")
        except Exception as e:
            print(f"Failed to get remote SHA for force commit, using local: {e}")
            # sha_to_use already set to document.github_sha above

    print(f"Committing with SHA: {sha_to_use}")

    # Commit the file
    commit_result = await github_service.commit_file(
        account.access_token,
        repository.repo_owner,
        repository.repo_name,
        document.github_file_path or "",
        document.content,
        commit_request.commit_message,
        branch=target_branch,
        sha=sha_to_use,
        create_branch=commit_request.create_new_branch,
        base_branch=document.github_branch or repository.default_branch if commit_request.create_new_branch else None
    )

    return commit_result


async def _update_document_metadata(
    db: AsyncSession,
    document,
    commit_result: dict,
    target_branch: str,
    content_sha256: str
) -> None:
    """Update document metadata after successful commit."""
    print("=== Updating Document Metadata ===")
    print(f"Commit Result Keys: {list(commit_result.keys())}")
    print(f"Commit Result Content: {commit_result}")
    print(f"Old GitHub SHA: {document.github_sha}")
    
    # Check if commit_result has the expected structure
    if "commit" in commit_result and "sha" in commit_result["commit"]:
        new_github_sha = commit_result["commit"]["sha"]
    elif "sha" in commit_result:
        new_github_sha = commit_result["sha"]
    else:
        print(f"ERROR: No SHA found in commit_result: {commit_result}")
        raise ValueError(f"No SHA found in commit result: {list(commit_result.keys())}")
    
    print(f"New GitHub SHA: {new_github_sha}")
    print(f"Old Local SHA: {document.local_sha}")
    print(f"New Local SHA: {content_sha256}")
    
    document.github_sha = new_github_sha
    # Use the pre-calculated SHA-256 hash for consistency
    document.local_sha = content_sha256
    document.github_sync_status = "synced"
    document.last_github_sync_at = datetime.utcnow()

    # Update branch if it changed
    if target_branch != document.github_branch:
        document.github_branch = target_branch

    print("About to commit database changes:")
    print(f"  Document ID: {document.id}")
    print(f"  New GitHub SHA: {document.github_sha}")
    print(f"  New Local SHA: {document.local_sha}")
    print(f"  Sync Status: {document.github_sync_status}")

    # Invalidate cache for this file since it was updated
    await github_cache_service.invalidate_file_cache(
        document.github_repository_id,
        document.github_file_path,
        target_branch
    )

    await db.commit()
    print("Database changes committed successfully")


@router.post("/documents/{document_id}", response_model=GitHubCommitResponse)
async def commit_document_to_github(
    document_id: int,
    commit_request: GitHubCommitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> GitHubCommitResponse:
    """Commit local document changes to GitHub."""
    print("=== GitHub Commit Request ===")
    print(f"Document ID: {document_id}")
    print(f"Commit Message: {commit_request.commit_message}")
    print(f"Force Commit: {commit_request.force_commit}")
    print(f"User ID: {current_user.id}")
    
    # Validate document and repository access
    document, repository, account = await _validate_document_and_repository(
        db, document_id, current_user
    )

    print("=== Document State ===")
    print(f"Document Name: {document.name}")
    print(f"GitHub Repository: {repository.repo_owner}/{repository.repo_name}")
    print(f"GitHub File Path: {document.github_file_path}")
    print(f"Current GitHub SHA: {document.github_sha}")
    print(f"Current Local SHA: {document.local_sha}")
    print(f"Content Length: {len(document.content) if document.content else 0}")
    
    # Calculate current content SHA-256 for local tracking
    current_content_sha256 = github_service.generate_content_hash(document.content or "")
    print(f"Calculated Content SHA-256: {current_content_sha256}")

    # Determine target branch
    target_branch = _determine_target_branch(commit_request, document, repository)

    # Check for conflicts if not forcing
    await _check_for_conflicts(commit_request, document, account, repository)

    try:
        # Perform the commit
        commit_result = await _perform_commit(
            commit_request, document, account, repository, target_branch
        )

        # Update document metadata with calculated SHA
        await _update_document_metadata(db, document, commit_result, target_branch, current_content_sha256)

        # Extract SHA for response (handle different response structures)
        response_sha = commit_result.get("commit", {}).get("sha") or commit_result.get("sha") or "unknown"
        
        print("=== Commit Success ===")
        print(f"New GitHub SHA: {response_sha}")
        print(f"Updated Local SHA: {current_content_sha256}")
        print(f"Commit URL: {commit_result.get('html_url', commit_result.get('commit', {}).get('html_url', 'N/A'))}")

        return GitHubCommitResponse(
            success=True,
            commit_sha=response_sha,
            commit_url=commit_result.get("html_url", commit_result.get("commit", {}).get("html_url", "")),
            branch=target_branch,
            message="File committed successfully"
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to commit file: {str(e)}"
        )
