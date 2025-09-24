"""Main GitHub router that aggregates all GitHub sub-routers."""
from fastapi import APIRouter

from . import (
    accounts, admin, auth, cache, commits, files, repositories,
    repository_selection, sync, pull_requests, import_enhanced, save_to_github, git_operations
)

router = APIRouter()

# Include all GitHub sub-routers
router.include_router(auth.router, prefix="/auth", tags=["github-auth"])
router.include_router(accounts.router, prefix="/accounts", tags=["github-accounts"])
router.include_router(repositories.router, prefix="/repositories", tags=["github-repositories"])
router.include_router(repository_selection.router, prefix="/repository-selection", tags=["github-repository-selection"])
router.include_router(files.router, prefix="/files", tags=["github-files"])
router.include_router(sync.router, prefix="/sync", tags=["github-sync"])
router.include_router(commits.router, prefix="/commits", tags=["github-commits"])
router.include_router(pull_requests.router, prefix="/pull-requests", tags=["github-pull-requests"])
router.include_router(cache.router, prefix="/cache", tags=["github-cache"])
router.include_router(import_enhanced.router, tags=["github-import-enhanced"])
router.include_router(save_to_github.router, prefix="/save", tags=["github-save"])
router.include_router(git_operations.router, prefix="/git", tags=["git-operations"])
router.include_router(admin.router, prefix="/admin", tags=["github-admin"])
