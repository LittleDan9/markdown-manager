"""
Backward compatibility import for IconService.
This file maintains the original import path while delegating to the new modular structure.
"""

from .icons import IconService

__all__ = ["IconService"]
