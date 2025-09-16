"""Tests for core exception classes."""
from fastapi import HTTPException

from app.core.exceptions import (
    FolderException,
    FolderNotFound,
    InvalidFolderPath,
    DuplicateDocumentInFolder,
    DocumentNotFound,
    UnauthorizedDocumentAccess,
)


class TestFolderException:
    """Test the base FolderException class."""

    def test_folder_exception_inheritance(self):
        """Test FolderException inherits from HTTPException."""
        assert issubclass(FolderException, HTTPException)

    def test_folder_exception_creation(self):
        """Test creating a basic FolderException."""
        exception = FolderException(status_code=400, detail="Test folder error")
        assert exception.status_code == 400
        assert exception.detail == "Test folder error"


class TestFolderNotFound:
    """Test the FolderNotFound exception."""

    def test_folder_not_found_creation(self):
        """Test FolderNotFound with folder path."""
        folder_path = "/test/folder"
        exception = FolderNotFound(folder_path)

        assert exception.status_code == 404
        assert exception.detail == f"Folder '{folder_path}' not found"
        assert isinstance(exception, FolderException)
        assert isinstance(exception, HTTPException)

    def test_folder_not_found_empty_path(self):
        """Test FolderNotFound with empty folder path."""
        folder_path = ""
        exception = FolderNotFound(folder_path)

        assert exception.status_code == 404
        assert exception.detail == "Folder '' not found"

    def test_folder_not_found_root_path(self):
        """Test FolderNotFound with root folder path."""
        folder_path = "/"
        exception = FolderNotFound(folder_path)

        assert exception.status_code == 404
        assert exception.detail == "Folder '/' not found"

    def test_folder_not_found_complex_path(self):
        """Test FolderNotFound with complex folder path."""
        folder_path = "/projects/work/documents/archive"
        exception = FolderNotFound(folder_path)

        assert exception.status_code == 404
        assert exception.detail == f"Folder '{folder_path}' not found"


class TestInvalidFolderPath:
    """Test the InvalidFolderPath exception."""

    def test_invalid_folder_path_creation(self):
        """Test InvalidFolderPath with default reason."""
        folder_path = "invalid//path"
        exception = InvalidFolderPath(folder_path)

        assert exception.status_code == 400
        assert exception.detail == f"Invalid folder path '{folder_path}': Invalid path format"
        assert isinstance(exception, FolderException)

    def test_invalid_folder_path_custom_reason(self):
        """Test InvalidFolderPath with custom reason."""
        folder_path = "../../../etc"
        reason = "Path traversal attempt"
        exception = InvalidFolderPath(folder_path, reason)

        assert exception.status_code == 400
        assert exception.detail == f"Invalid folder path '{folder_path}': {reason}"

    def test_invalid_folder_path_special_characters(self):
        """Test InvalidFolderPath with special characters."""
        folder_path = "/folder<>:\"|?*"
        reason = "Contains illegal characters"
        exception = InvalidFolderPath(folder_path, reason)

        assert exception.status_code == 400
        assert exception.detail == f"Invalid folder path '{folder_path}': {reason}"

    def test_invalid_folder_path_empty_reason(self):
        """Test InvalidFolderPath with empty reason."""
        folder_path = "bad_path"
        reason = ""
        exception = InvalidFolderPath(folder_path, reason)

        assert exception.status_code == 400
        assert exception.detail == f"Invalid folder path '{folder_path}': "


class TestDuplicateDocumentInFolder:
    """Test the DuplicateDocumentInFolder exception."""

    def test_duplicate_document_creation(self):
        """Test DuplicateDocumentInFolder with document name and folder path."""
        name = "test_document.md"
        folder_path = "/projects"
        exception = DuplicateDocumentInFolder(name, folder_path)

        assert exception.status_code == 409
        assert exception.detail == f"Document '{name}' already exists in folder '{folder_path}'"
        assert isinstance(exception, FolderException)

    def test_duplicate_document_root_folder(self):
        """Test DuplicateDocumentInFolder in root folder."""
        name = "readme.md"
        folder_path = "/"
        exception = DuplicateDocumentInFolder(name, folder_path)

        assert exception.status_code == 409
        assert exception.detail == f"Document '{name}' already exists in folder '{folder_path}'"

    def test_duplicate_document_special_characters(self):
        """Test DuplicateDocumentInFolder with special characters in name."""
        name = "file with spaces & symbols.md"
        folder_path = "/my-folder"
        exception = DuplicateDocumentInFolder(name, folder_path)

        assert exception.status_code == 409
        assert exception.detail == f"Document '{name}' already exists in folder '{folder_path}'"

    def test_duplicate_document_empty_name(self):
        """Test DuplicateDocumentInFolder with empty document name."""
        name = ""
        folder_path = "/test"
        exception = DuplicateDocumentInFolder(name, folder_path)

        assert exception.status_code == 409
        assert exception.detail == f"Document '{name}' already exists in folder '{folder_path}'"


class TestDocumentNotFound:
    """Test the DocumentNotFound exception."""

    def test_document_not_found_creation(self):
        """Test DocumentNotFound with document ID."""
        document_id = 123
        exception = DocumentNotFound(document_id)

        assert exception.status_code == 404
        assert exception.detail == f"Document with ID {document_id} not found"
        assert isinstance(exception, HTTPException)

    def test_document_not_found_zero_id(self):
        """Test DocumentNotFound with zero ID."""
        document_id = 0
        exception = DocumentNotFound(document_id)

        assert exception.status_code == 404
        assert exception.detail == f"Document with ID {document_id} not found"

    def test_document_not_found_negative_id(self):
        """Test DocumentNotFound with negative ID."""
        document_id = -1
        exception = DocumentNotFound(document_id)

        assert exception.status_code == 404
        assert exception.detail == f"Document with ID {document_id} not found"

    def test_document_not_found_large_id(self):
        """Test DocumentNotFound with large ID."""
        document_id = 999999999
        exception = DocumentNotFound(document_id)

        assert exception.status_code == 404
        assert exception.detail == f"Document with ID {document_id} not found"


class TestUnauthorizedDocumentAccess:
    """Test the UnauthorizedDocumentAccess exception."""

    def test_unauthorized_access_creation(self):
        """Test UnauthorizedDocumentAccess with document ID."""
        document_id = 456
        exception = UnauthorizedDocumentAccess(document_id)

        assert exception.status_code == 403
        assert exception.detail == f"Access denied to document {document_id}"
        assert isinstance(exception, HTTPException)

    def test_unauthorized_access_zero_id(self):
        """Test UnauthorizedDocumentAccess with zero ID."""
        document_id = 0
        exception = UnauthorizedDocumentAccess(document_id)

        assert exception.status_code == 403
        assert exception.detail == f"Access denied to document {document_id}"

    def test_unauthorized_access_negative_id(self):
        """Test UnauthorizedDocumentAccess with negative ID."""
        document_id = -5
        exception = UnauthorizedDocumentAccess(document_id)

        assert exception.status_code == 403
        assert exception.detail == f"Access denied to document {document_id}"

    def test_unauthorized_access_large_id(self):
        """Test UnauthorizedDocumentAccess with large ID."""
        document_id = 987654321
        exception = UnauthorizedDocumentAccess(document_id)

        assert exception.status_code == 403
        assert exception.detail == f"Access denied to document {document_id}"


class TestExceptionIntegration:
    """Test exception interactions and edge cases."""

    def test_all_exceptions_are_http_exceptions(self):
        """Test that all custom exceptions inherit from HTTPException."""
        exceptions = [
            FolderException(status_code=400, detail="test"),
            FolderNotFound("/test"),
            InvalidFolderPath("/invalid"),
            DuplicateDocumentInFolder("test.md", "/folder"),
            DocumentNotFound(1),
            UnauthorizedDocumentAccess(1),
        ]

        for exception in exceptions:
            assert isinstance(exception, HTTPException)

    def test_folder_exceptions_hierarchy(self):
        """Test that folder exceptions have proper inheritance."""
        folder_exceptions = [
            FolderNotFound("/test"),
            InvalidFolderPath("/invalid"),
            DuplicateDocumentInFolder("test.md", "/folder"),
        ]

        for exception in folder_exceptions:
            assert isinstance(exception, FolderException)
            assert isinstance(exception, HTTPException)

    def test_exception_str_representation(self):
        """Test string representation of exceptions."""
        exceptions = [
            DocumentNotFound(123),
            UnauthorizedDocumentAccess(456),
            FolderNotFound("/test/path"),
        ]

        for exception in exceptions:
            # HTTPException should have a meaningful string representation
            str_repr = str(exception)
            assert isinstance(str_repr, str)
            assert len(str_repr) > 0

    def test_exception_status_codes(self):
        """Test that exceptions have correct HTTP status codes."""
        test_cases = [
            (DocumentNotFound(1), 404),
            (UnauthorizedDocumentAccess(1), 403),
            (FolderNotFound("/test"), 404),
            (InvalidFolderPath("/test"), 400),
            (DuplicateDocumentInFolder("test.md", "/folder"), 409),
        ]

        for exception, expected_code in test_cases:
            assert exception.status_code == expected_code

    def test_exception_details_not_empty(self):
        """Test that all exceptions have non-empty detail messages."""
        exceptions = [
            DocumentNotFound(1),
            UnauthorizedDocumentAccess(1),
            FolderNotFound("/test"),
            InvalidFolderPath("/test"),
            DuplicateDocumentInFolder("test.md", "/folder"),
        ]

        for exception in exceptions:
            assert exception.detail
            assert len(exception.detail.strip()) > 0
            assert isinstance(exception.detail, str)