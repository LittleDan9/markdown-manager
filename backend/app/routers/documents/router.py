"""Main documents router that aggregates all document sub-routers."""
from fastapi import APIRouter

from . import categories, crud, current, sharing

router = APIRouter()

# Include all document sub-routers
# NOTE: Order matters! More specific routes must come before generic ones
router.include_router(current.router, tags=["documents"])  # /current before /{document_id}
router.include_router(categories.router, tags=["documents"])
router.include_router(sharing.router, tags=["documents"])
router.include_router(crud.router, tags=["documents"])  # /{document_id} must come last
