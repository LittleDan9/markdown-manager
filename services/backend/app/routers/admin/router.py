"""
Main Admin API Router - Combines all admin functionality by functional area

This router organizes admin operations by functional area:
- /admin/users/ - User management and administration
- /admin/icons/ - Icon pack and icon administration
- /admin/github/ - GitHub storage administration
- /admin/system/ - System-wide configuration and monitoring (future)

Provides a consistent admin API structure with proper authentication.
"""

from fastapi import APIRouter

from . import users, icons, github

# Create main admin router with prefix
router = APIRouter(prefix="/admin")

# Include functional area routers
router.include_router(users.router, prefix="/users", tags=["Admin - Users"])
router.include_router(icons.router, prefix="/icons", tags=["Admin - Icons"])
router.include_router(github.router, prefix="/github", tags=["Admin - GitHub"])