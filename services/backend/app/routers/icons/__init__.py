"""
Modular Icon API Router Package

This package contains the icon API organized into focused, maintainable modules:
- packs: Icon pack management (CRUD operations)
- search: Icon search and metadata retrieval
- cache: Cache management and performance
- statistics: Usage analytics and reporting

Each module handles a specific domain with clean separation of concerns.
"""

from .router import router

__all__ = ["router"]
