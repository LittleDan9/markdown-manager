"""
Backward compatibility import for GitHubService.
This file maintains the original import path while delegating to the new modular structure.
"""

from .github import GitHubService

__all__ = ["GitHubService"]
