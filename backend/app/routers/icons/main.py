"""
Main Icon API Router - Combines all icon-related endpoints

This module aggregates all icon API functionality from domain-specific routers:
- Icon pack management
- Icon search and metadata
- Cache management
- Usage statistics

Maintains compatibility with existing API while providing better code organization.
"""

from fastapi import APIRouter

from . import packs, search, cache, statistics

# Create main icon router (no tags to avoid duplication)
router = APIRouter(prefix="/icons")

# Include all domain-specific routers
router.include_router(packs.router)
router.include_router(search.router)
router.include_router(cache.router)
router.include_router(statistics.router)
