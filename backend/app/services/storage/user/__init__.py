"""
User storage services package.

This package provides modular user storage services:
- UserDirectory: Directory management and structure
- UserRepository: Repository initialization and management
- UserDocument: Document CRUD operations
- UserVersion: Git history and version control
- UserStorage: Main coordination service (recommended entry point)
"""

from .storage import UserStorage
from .directory import UserDirectory
from .repository import UserRepository
from .document import UserDocument
from .version import UserVersion

__all__ = [
    'UserStorage',
    'UserDirectory',
    'UserRepository',
    'UserDocument',
    'UserVersion'
]
