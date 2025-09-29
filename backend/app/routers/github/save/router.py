"""Main router for GitHub save operations."""
from fastapi import APIRouter

from .repositories import router as repositories_router
from .documents import router as documents_router

router = APIRouter()

# Include sub-routers
router.include_router(repositories_router, tags=["github-save-repositories"])
router.include_router(documents_router, tags=["github-save-documents"])