"""GitHub Admin endpoints for administrative operations."""
import logging
from pathlib import Path
from typing import Tuple, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserResponse

logger = logging.getLogger(__name__)
router = APIRouter()


def cleanup_empty_directories(path: Path, root_path: Path) -> Tuple[int, int]:
    """
    Safely clean up empty directories and orphaned git repositories.
    Returns tuple of (directories_cleaned, repositories_cleaned).
    """
    directories_cleaned = 0
    repositories_cleaned = 0

    try:
        if not path.exists() or path == root_path:
            return directories_cleaned, repositories_cleaned

        # Check if this is a git repository
        git_dir = path / ".git"
        is_git_repo = git_dir.exists()

        if is_git_repo:
            # Check if repository has any non-git files/directories
            has_working_files = False
            for item in path.iterdir():
                if item.name != ".git":
                    if item.is_file():
                        has_working_files = True
                        break
                    elif item.is_dir() and any(item.rglob("*")):
                        has_working_files = True
                        break

            # If no working files, this is an orphaned repository
            if not has_working_files:
                logger.info(f"Cleaning orphaned repository: {path}")
                import shutil
                shutil.rmtree(path)
                repositories_cleaned += 1
                return directories_cleaned, repositories_cleaned

        # If directory is empty (no files or subdirectories), remove it
        try:
            if not any(path.iterdir()):
                path.rmdir()
                directories_cleaned += 1
                logger.info(f"Cleaned empty directory: {path}")
        except OSError:
            # Directory might not be empty, skip
            pass

        # Recursively clean parent directories if they become empty
        parent = path.parent
        if parent != root_path and parent.exists():
            parent_cleaned, parent_repos = cleanup_empty_directories(parent, root_path)
            directories_cleaned += parent_cleaned
            repositories_cleaned += parent_repos

    except Exception as e:
        logger.error(f"Error cleaning directory {path}: {e}")

    return directories_cleaned, repositories_cleaned


async def get_orphaned_repositories(user_id: int, db_session) -> list:
    """
    Find repositories on filesystem that have no corresponding documents in database.
    Uses the same logic as storage stats to count both git repositories and logical repositories.
    """
    from app.models.document import Document
    from app.services.storage.filesystem import Filesystem

    orphaned_repos = []

    try:
        filesystem_service = Filesystem()
        user_dir = filesystem_service.get_user_directory(user_id)

        if not user_dir.exists():
            return orphaned_repos

        # Get all document file paths from database
        docs_result = await db_session.execute(
            select(Document.file_path, Document.repository_type)
            .filter(Document.user_id == user_id)
            .filter(Document.file_path.isnot(None))
        )
        document_repos = set()
        for file_path, repo_type in docs_result.fetchall():
            if file_path:
                # Extract repository identifier from path
                path_parts = file_path.split("/")
                if repo_type == "local" and len(path_parts) >= 2:
                    # local/{category}
                    repo_id = f"local/{path_parts[1]}"
                    document_repos.add(repo_id)
                elif repo_type == "github" and len(path_parts) >= 3:
                    # github/{account_id}/{repo_name}
                    repo_id = f"github/{path_parts[1]}/{path_parts[2]}"
                    document_repos.add(repo_id)

        # Find all repositories on filesystem using same logic as storage stats
        filesystem_repos = {}  # repo_id -> (path, type, has_git)

        # First, count actual .git repositories
        for item in user_dir.rglob("*"):
            if item.is_dir() and (item / ".git").exists():
                relative_path = item.relative_to(user_dir)
                path_parts = relative_path.parts

                if len(path_parts) >= 2 and path_parts[0] == "local":
                    # Local repository: /local/{category}
                    repo_id = f"local/{path_parts[1]}"
                    filesystem_repos[repo_id] = (str(item), "local", True)
                elif len(path_parts) >= 3 and path_parts[0] == "github":
                    # GitHub repository: /github/{account_id}/{repo_name}
                    repo_id = f"github/{path_parts[1]}/{path_parts[2]}"
                    filesystem_repos[repo_id] = (str(item), "github", True)

        # Also count logical repositories by scanning for any files in directory structure
        # This matches the logic used in storage stats calculation
        for item in user_dir.rglob("*"):
            if item.is_file():
                relative_path = item.relative_to(user_dir)
                path_parts = relative_path.parts

                if len(path_parts) >= 2 and path_parts[0] == "local":
                    # Local repository: /local/{category}/...
                    repo_id = f"local/{path_parts[1]}"
                    if repo_id not in filesystem_repos:
                        # Logical repository (has files but no .git)
                        category_dir = user_dir / "local" / path_parts[1]
                        filesystem_repos[repo_id] = (str(category_dir), "local", False)
                elif len(path_parts) >= 3 and path_parts[0] == "github":
                    # GitHub repository: /github/{account_id}/{repo_name}/...
                    repo_id = f"github/{path_parts[1]}/{path_parts[2]}"
                    if repo_id not in filesystem_repos:
                        # Logical repository (has files but no .git)
                        repo_dir = user_dir / "github" / path_parts[1] / path_parts[2]
                        filesystem_repos[repo_id] = (str(repo_dir), "github", False)

        # Find orphaned repositories (exist on filesystem but not in database)
        for repo_id, (repo_path, repo_type, has_git) in filesystem_repos.items():
            if repo_id not in document_repos:
                orphaned_repos.append({
                    "repository_id": repo_id,
                    "repository_path": repo_path,
                    "repository_type": repo_type,
                    "has_git": has_git,
                    "reason": "Repository exists on filesystem but has no documents in database"
                })

    except Exception as e:
        logger.error(f"Error finding orphaned repositories for user {user_id}: {e}")

    return orphaned_repos


@router.get("/orphaned-documents")
async def get_orphaned_documents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Find orphaned documents in two categories:
    1. GitHub documents with invalid/missing GitHub accounts
    2. Documents with database records but missing filesystem files
    """
    from app.models.document import Document
    from app.models.github_models import GitHubAccount
    from app.services.storage.user import UserStorage

    orphaned_docs = []

    # Check 1: GitHub documents with invalid accounts
    github_documents = await db.execute(
        select(Document).filter(
            Document.user_id == current_user.id,
            Document.repository_type == "github",
            Document.github_repository_id.isnot(None)
        )
    )
    github_docs = github_documents.scalars().all()

    for doc in github_docs:
        # Check if GitHub account exists and is valid
        github_account = await db.execute(
            select(GitHubAccount).filter(
                GitHubAccount.user_id == current_user.id,
                GitHubAccount.is_active.is_(True)
            )
        )
        account = github_account.scalar_one_or_none()

        if not account:
            orphaned_docs.append({
                "id": doc.id,
                "name": doc.name,
                "file_path": doc.file_path,
                "repository_type": doc.repository_type,
                "github_repository_id": doc.github_repository_id,
                "created_at": doc.created_at.isoformat(),
                "updated_at": doc.updated_at.isoformat(),
                "reason": "GitHub account missing or inactive"
            })

    # Check 2: Documents with missing filesystem files
    all_documents = await db.execute(
        select(Document).filter(Document.user_id == current_user.id)
    )
    all_docs = all_documents.scalars().all()

    storage_service = UserStorage()

    for doc in all_docs:
        if doc.file_path:  # Only check documents that should have filesystem files
            # Try to read the file to see if it exists
            content = await storage_service.read_document(
                user_id=current_user.id,
                file_path=doc.file_path
            )

            if content is None:  # File doesn't exist or can't be read
                orphaned_docs.append({
                    "id": doc.id,
                    "name": doc.name,
                    "file_path": doc.file_path,
                    "repository_type": doc.repository_type,
                    "github_repository_id": doc.github_repository_id,
                    "created_at": doc.created_at.isoformat(),
                    "updated_at": doc.updated_at.isoformat(),
                    "reason": "Filesystem file missing or unreadable"
                })

    return orphaned_docs


# Admin endpoints for managing any user's storage
@router.get("/users", response_model=List[UserResponse])
async def get_all_users(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Admin endpoint: Get list of all users for user selection.
    """
    # TODO: Add admin role check when available
    # For now, allow any authenticated user to get basic user list

    try:
        result = await db.execute(
            select(User).order_by(User.created_at.desc())
        )
        users = result.scalars().all()

        # Convert to response format with basic user info
        user_responses = []
        for user in users:
            user_responses.append(UserResponse(
                id=user.id,
                email=user.email,
                first_name=user.first_name,
                last_name=user.last_name,
                display_name=user.display_name,
                bio=user.bio,
                is_active=user.is_active,
                is_verified=user.is_verified,
                is_admin=user.is_admin,
                mfa_enabled=user.mfa_enabled,
                created_at=user.created_at,
                updated_at=user.updated_at,
                full_name=user.full_name,
                sync_preview_scroll_enabled=user.sync_preview_scroll_enabled,
                autosave_enabled=user.autosave_enabled,
                editor_width_percentage=user.editor_width_percentage,
                current_doc_id=user.current_doc_id,
                current_document=None  # Don't load documents for user list
            ))

        return user_responses

    except Exception as e:
        logger.error(f"Error fetching users: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch users")


@router.get("/users/{user_id}/storage-stats")
async def get_user_storage_stats(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Admin endpoint: Get storage statistics for any user.
    Requires admin privileges.
    """
    # TODO: Add admin permission check
    # if not current_user.is_admin:
    #     raise HTTPException(status_code=403, detail="Admin access required")

    from app.models.document import Document
    from app.services.storage.filesystem import Filesystem
    import os

    # Get document statistics
    docs_query = await db.execute(
        select(Document).filter(Document.user_id == user_id)
    )
    documents = docs_query.scalars().all()

    stats = {
        "user_id": user_id,
        "total_documents": len(documents),
        "local_documents": len([d for d in documents if d.repository_type == "local"]),
        "github_documents": len([d for d in documents if d.repository_type == "github"]),
        "documents_with_files": 0,
        "orphaned_documents": 0,
        "storage_size_bytes": 0,
        "directories_count": 0,
        "repositories_count": 0
    }

    try:
        filesystem_service = Filesystem()
        user_dir = filesystem_service.get_user_directory(user_id)

        if user_dir.exists():
            # Calculate storage size
            for root, dirs, files in os.walk(user_dir):
                for file in files:
                    file_path = Path(root) / file
                    if file_path.exists():
                        stats["storage_size_bytes"] += file_path.stat().st_size

            # Count directories and repositories more accurately
            local_repos = set()
            github_repos = set()

            # First, count actual .git repositories
            for item in user_dir.rglob("*"):
                if item.is_dir():
                    stats["directories_count"] += 1

                    # Check if this is a git repository
                    if (item / ".git").exists():
                        # Determine repository type based on path structure
                        relative_path = item.relative_to(user_dir)
                        path_parts = relative_path.parts

                        if len(path_parts) >= 2 and path_parts[0] == "local":
                            # Local repository: /local/{category}
                            category = path_parts[1]
                            local_repos.add(category)
                        elif len(path_parts) >= 3 and path_parts[0] == "github":
                            # GitHub repository: /github/{account_id}/{repo_name}
                            account_id = path_parts[1]
                            repo_name = path_parts[2]
                            github_repos.add(f"{account_id}/{repo_name}")

            # Also count logical repositories based on document file paths
            # This accounts for repositories that may not have .git but have documents
            for doc in documents:
                if doc.file_path:
                    if doc.repository_type == "local":
                        # Extract category from local file path: local/{category}/...
                        path_parts = doc.file_path.split("/")
                        if len(path_parts) >= 2:
                            category = path_parts[1]
                            local_repos.add(category)
                    elif doc.repository_type == "github":
                        # Extract repo info from GitHub file path: github/{account_id}/{repo_name}/...
                        path_parts = doc.file_path.split("/")
                        if len(path_parts) >= 3:
                            account_id = path_parts[1]
                            repo_name = path_parts[2]
                            github_repos.add(f"{account_id}/{repo_name}")

            stats["repositories_count"] = len(local_repos) + len(github_repos)
            stats["local_repositories"] = len(local_repos)
            stats["github_repositories"] = len(github_repos)

        # Check which documents have actual files
        from app.services.storage.user import UserStorage
        storage_service = UserStorage()

        for doc in documents:
            if doc.file_path:
                content = await storage_service.read_document(user_id, doc.file_path)
                if content is not None:
                    stats["documents_with_files"] += 1
                else:
                    stats["orphaned_documents"] += 1

    except Exception as e:
        logger.error(f"Error calculating storage stats for user {user_id}: {e}")

    return stats


@router.get("/users/{user_id}/orphaned-repositories")
async def get_user_orphaned_repositories(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Admin endpoint: Get orphaned repositories for a specific user.
    Returns repositories that exist on filesystem but have no documents in database.
    """
    # TODO: Add admin permission check
    # if not current_user.is_admin:
    #     raise HTTPException(status_code=403, detail="Admin access required")

    try:
        orphaned_repos = await get_orphaned_repositories(user_id, db)
        logger.info(f"Found {len(orphaned_repos)} orphaned repositories for user {user_id}")
        return orphaned_repos
    except Exception as e:
        logger.error(f"Error getting orphaned repositories for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get orphaned repositories")


@router.delete("/users/{user_id}/orphaned-repositories")
async def cleanup_user_orphaned_repositories(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Admin endpoint: Clean up orphaned repositories for a specific user.
    Removes repositories that exist on filesystem but have no documents in database.
    """
    # TODO: Add admin permission check
    # if not current_user.is_admin:
    #     raise HTTPException(status_code=403, detail="Admin access required")

    try:
        from app.services.storage.filesystem import Filesystem

        # Get orphaned repositories before cleanup
        orphaned_repos = await get_orphaned_repositories(user_id, db)

        if not orphaned_repos:
            return {
                "message": "No orphaned repositories found",
                "deleted_repositories": 0
            }

        filesystem_service = Filesystem()
        user_dir = filesystem_service.get_user_directory(user_id)
        deleted_repositories = 0

        # Clean up each orphaned repository
        for repo in orphaned_repos:
            repo_path = Path(repo["repository_path"])
            if repo_path.exists():
                try:
                    logger.info(f"Removing orphaned repository: {repo_path}")
                    import shutil
                    shutil.rmtree(repo_path)
                    deleted_repositories += 1
                except Exception as e:
                    logger.error(f"Failed to remove repository {repo_path}: {e}")

        # Clean up any empty directories left behind
        directories_cleaned, _ = cleanup_empty_directories(user_dir, user_dir)

        logger.info(f"Cleaned up {deleted_repositories} orphaned repositories and {directories_cleaned} empty directories for user {user_id}")

        return {
            "message": f"Successfully cleaned up {deleted_repositories} orphaned repositories",
            "deleted_repositories": deleted_repositories,
            "cleaned_directories": directories_cleaned
        }

    except Exception as e:
        logger.error(f"Error cleaning up orphaned repositories for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to cleanup orphaned repositories")


@router.get("/orphaned-repositories")
async def get_my_orphaned_repositories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    User endpoint: Get current user's orphaned repositories.
    """
    try:
        orphaned_repos = await get_orphaned_repositories(current_user.id, db)
        logger.info(f"Found {len(orphaned_repos)} orphaned repositories for current user")
        return orphaned_repos
    except Exception as e:
        logger.error(f"Error getting orphaned repositories for current user: {e}")
        raise HTTPException(status_code=500, detail="Failed to get orphaned repositories")


@router.delete("/orphaned-repositories")
async def cleanup_my_orphaned_repositories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    User endpoint: Clean up current user's orphaned repositories.
    """
    try:
        from app.services.storage.filesystem import Filesystem

        # Get orphaned repositories before cleanup
        orphaned_repos = await get_orphaned_repositories(current_user.id, db)

        if not orphaned_repos:
            return {
                "message": "No orphaned repositories found",
                "deleted_repositories": 0
            }

        filesystem_service = Filesystem()
        user_dir = filesystem_service.get_user_directory(current_user.id)
        deleted_repositories = 0

        # Clean up each orphaned repository
        for repo in orphaned_repos:
            repo_path = Path(repo["repository_path"])
            if repo_path.exists():
                try:
                    logger.info(f"Removing orphaned repository: {repo_path}")
                    import shutil
                    shutil.rmtree(repo_path)
                    deleted_repositories += 1
                except Exception as e:
                    logger.error(f"Failed to remove repository {repo_path}: {e}")

        # Clean up any empty directories left behind
        directories_cleaned, _ = cleanup_empty_directories(user_dir, user_dir)

        logger.info(f"Cleaned up {deleted_repositories} orphaned repositories and {directories_cleaned} empty directories for current user")

        return {
            "message": f"Successfully cleaned up {deleted_repositories} orphaned repositories",
            "deleted_repositories": deleted_repositories,
            "cleaned_directories": directories_cleaned
        }

    except Exception as e:
        logger.error(f"Error cleaning up orphaned repositories for current user: {e}")
        raise HTTPException(status_code=500, detail="Failed to cleanup orphaned repositories")


@router.get("/users/{user_id}/orphaned-documents")
async def get_user_orphaned_documents(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Admin endpoint: Get orphaned documents for any user.
    Requires admin privileges.
    """
    # TODO: Add admin permission check
    # if not current_user.is_admin:
    #     raise HTTPException(status_code=403, detail="Admin access required")

    # Reuse the existing orphan detection logic but for specified user
    from app.models.document import Document
    from app.models.github_models import GitHubAccount
    from app.services.storage.user import UserStorage

    orphaned_docs = []

    # Check GitHub documents with invalid accounts
    github_documents = await db.execute(
        select(Document).filter(
            Document.user_id == user_id,
            Document.repository_type == "github",
            Document.github_repository_id.isnot(None)
        )
    )
    github_docs = github_documents.scalars().all()

    for doc in github_docs:
        github_account = await db.execute(
            select(GitHubAccount).filter(
                GitHubAccount.user_id == user_id,
                GitHubAccount.is_active.is_(True)
            )
        )
        account = github_account.scalar_one_or_none()

        if not account:
            orphaned_docs.append({
                "id": doc.id,
                "name": doc.name,
                "file_path": doc.file_path,
                "repository_type": doc.repository_type,
                "github_repository_id": doc.github_repository_id,
                "created_at": doc.created_at.isoformat(),
                "updated_at": doc.updated_at.isoformat(),
                "reason": "GitHub account missing or inactive"
            })

    # Check documents with missing filesystem files
    all_documents = await db.execute(
        select(Document).filter(Document.user_id == user_id)
    )
    all_docs = all_documents.scalars().all()

    storage_service = UserStorage()

    for doc in all_docs:
        if doc.file_path:
            content = await storage_service.read_document(user_id, doc.file_path)

            if content is None:
                orphaned_docs.append({
                    "id": doc.id,
                    "name": doc.name,
                    "file_path": doc.file_path,
                    "repository_type": doc.repository_type,
                    "github_repository_id": doc.github_repository_id,
                    "created_at": doc.created_at.isoformat(),
                    "updated_at": doc.updated_at.isoformat(),
                    "reason": "Filesystem file missing or unreadable"
                })

    return orphaned_docs


@router.delete("/users/{user_id}/orphaned-documents")
async def cleanup_user_orphaned_documents(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Admin endpoint: Clean up orphaned documents for any user.
    Requires admin privileges.
    """
    # TODO: Add admin permission check
    # if not current_user.is_admin:
    #     raise HTTPException(status_code=403, detail="Admin access required")

    return await perform_orphan_cleanup(user_id, db)


# User endpoints for managing their own storage
@router.delete("/user/orphaned-documents")
async def cleanup_my_orphaned_documents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    User endpoint: Clean up the current user's orphaned documents.
    Can be moved to user settings panel.
    """
    return await perform_orphan_cleanup(current_user.id, db)


@router.get("/user/storage-stats")
async def get_my_storage_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    User endpoint: Get the current user's storage statistics.
    Can be moved to user settings panel.
    """
    # Reuse admin stats logic but for current user
    return await get_user_storage_stats(current_user.id, current_user, db)


def verify_sync_consistency(user_id: int, documents: list, user_storage) -> Tuple[str, int]:
    """
    Verify filesystem consistency after cleanup.

    Returns:
        Tuple[str, int]: (sync_status, sync_errors_count)
    """
    sync_errors = 0
    for doc in documents:
        if doc.file_path and doc.repository_type == "local":
            try:
                # Check if file exists, if not this indicates an inconsistency
                content = user_storage.read_document(user_id, doc.file_path)
                if content is None:
                    logger.warning(f"Post-cleanup inconsistency: Document {doc.id} has no file at {doc.file_path}")
                    sync_errors += 1
            except Exception as e:
                logger.error(f"Error checking document {doc.id} during post-cleanup sync: {e}")
                sync_errors += 1

    if sync_errors == 0:
        return "verified_consistent", 0
    else:
        return f"found_{sync_errors}_inconsistencies", sync_errors


async def perform_orphan_cleanup(user_id: int, db: AsyncSession) -> dict:
    """
    Perform orphan cleanup for a specific user.

    Args:
        user_id: ID of the user to clean up
        db: Database session

    Returns:
        dict: Cleanup results with statistics
    """
    from app.models.document import Document
    from app.models.github_models import GitHubAccount
    from app.services.storage.user import UserStorage
    from app.crud.document import DocumentCRUD
    from sqlalchemy import delete

    orphaned_docs = []  # Keep for future enhancement if needed
    github_orphan_ids = []
    filesystem_orphan_ids = []
    deleted_count = 0

    # Check 1: GitHub documents with invalid accounts
    github_documents = await db.execute(
        select(Document).filter(
            Document.user_id == user_id,
            Document.repository_type == "github",
            Document.github_repository_id.isnot(None)
        )
    )
    github_docs = github_documents.scalars().all()

    for doc in github_docs:
        # Check if GitHub account exists and is valid
        github_account = await db.execute(
            select(GitHubAccount).filter(
                GitHubAccount.user_id == user_id,
                GitHubAccount.is_active.is_(True)
            )
        )
        account = github_account.scalar_one_or_none()

        if not account:
            github_orphan_ids.append(doc.id)

    # Check 2: Documents with missing filesystem files
    all_documents = await db.execute(
        select(Document).filter(Document.user_id == user_id)
    )
    all_docs = all_documents.scalars().all()

    storage_service = UserStorage()

    for doc in all_docs:
        if doc.file_path:  # Only check documents that should have filesystem files
            content = await storage_service.read_document(
                user_id=user_id,
                file_path=doc.file_path
            )

            if content is None:  # File doesn't exist or can't be read
                filesystem_orphan_ids.append(doc.id)

    # Combine all orphan IDs and delete them
    all_orphan_ids = list(set(github_orphan_ids + filesystem_orphan_ids))

    if all_orphan_ids:
        result = await db.execute(
            delete(Document).filter(
                Document.id.in_(all_orphan_ids),
                Document.user_id == user_id
            )
        )
        deleted_count = result.rowcount
        await db.commit()

    # Clean up empty directories and repositories
    cleaned_directories = 0
    cleaned_repositories = 0

    if deleted_count > 0:
        try:
            from app.services.storage.filesystem import Filesystem
            filesystem_service = Filesystem()
            user_dir = filesystem_service.get_user_directory(user_id)

            # Clean up empty directories in local and github subdirectories
            for subdir in ['local', 'github']:
                subdir_path = user_dir / subdir
                if subdir_path.exists():
                    dirs_cleaned, repos_cleaned = cleanup_empty_directories(subdir_path, user_dir)
                    cleaned_directories += dirs_cleaned
                    cleaned_repositories += repos_cleaned

        except Exception as e:
            logger.error(f"Error during filesystem cleanup: {e}")

    # Verify sync consistency
    sync_status = "not_needed"
    if deleted_count > 0:
        try:
            document_crud = DocumentCRUD()
            remaining_docs = await document_crud.get_by_user(db, user_id)
            sync_status, sync_errors = verify_sync_consistency(user_id, remaining_docs, storage_service)

        except Exception as e:
            logger.error(f"Error during post-cleanup sync verification: {e}")
            sync_status = "sync_error"

    return {
        "deleted_count": deleted_count,
        "github_orphans": len(github_orphan_ids),
        "filesystem_orphans": len(filesystem_orphan_ids),
        "total_orphans": len(all_orphan_ids),
        "cleaned_directories": cleaned_directories,
        "cleaned_repositories": cleaned_repositories,
        "sync_status": sync_status
    }
