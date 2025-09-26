"""
Admin API Router Package

This package contains the admin API organized by functional area:
- users: User management and administration
- icons: Icon pack and icon administration
- github: GitHub storage administration
- system: System-wide configuration and monitoring

Each module handles admin operations for a specific functional area.
"""

from .router import router

__all__ = ["router"]