"""Custom exception classes for the application."""
from fastapi import HTTPException


class FolderException(HTTPException):
    """Base exception for folder operations."""
    pass


class FolderNotFound(FolderException):
    """Exception raised when a folder is not found."""

    def __init__(self, folder_path: str):
        super().__init__(
            status_code=404,
            detail=f"Folder '{folder_path}' not found"
        )


class InvalidFolderPath(FolderException):
    """Exception raised when a folder path is invalid."""

    def __init__(self, folder_path: str, reason: str = "Invalid path format"):
        super().__init__(
            status_code=400,
            detail=f"Invalid folder path '{folder_path}': {reason}"
        )


class DuplicateDocumentInFolder(FolderException):
    """Exception raised when trying to create a duplicate document in a folder."""

    def __init__(self, name: str, folder_path: str):
        super().__init__(
            status_code=409,
            detail=f"Document '{name}' already exists in folder '{folder_path}'"
        )


class DocumentNotFound(HTTPException):
    """Exception raised when a document is not found."""

    def __init__(self, document_id: int):
        super().__init__(
            status_code=404,
            detail=f"Document with ID {document_id} not found"
        )


class UnauthorizedDocumentAccess(HTTPException):
    """Exception raised when trying to access a document without permission."""

    def __init__(self, document_id: int):
        super().__init__(
            status_code=403,
            detail=f"Access denied to document {document_id}"
        )
