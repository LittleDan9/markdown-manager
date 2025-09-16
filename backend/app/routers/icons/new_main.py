"""
New RESTful Icon API Router - Replaces the existing icon router with cleaner design

This module provides the new RESTful API structure while maintaining backward compatibility.
"""

from fastapi import APIRouter
from . import restful_main, admin

# Create new main router that combines RESTful endpoints and admin operations
router = APIRouter()

# Include the RESTful API endpoints (public endpoints)
router.include_router(restful_main.router, tags=["Icons"])

# Include admin operations (admin-only endpoints)
router.include_router(admin.router, tags=["Icon Administration"])
