"""
Simple test to verify unified architecture integration.
"""

import pytest
from unittest.mock import Mock, AsyncMock, patch
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.unified_document import unified_document_service


class TestUnifiedArchitectureIntegration:
    """Basic integration test for unified architecture."""

    @pytest.mark.asyncio
    async def test_unified_service_exists(self):
        """Test that the unified service is properly instantiated."""
        assert unified_document_service is not None
        assert hasattr(unified_document_service, 'get_document_with_content')
        assert hasattr(unified_document_service, 'update_document_content')

    @pytest.mark.asyncio
    async def test_unified_service_error_handling(self):
        """Test unified service error handling with minimal mocking."""
        mock_db = Mock(spec=AsyncSession)

        # Mock the document CRUD to return None (document not found)
        with patch('app.services.unified_document.document_crud.document') as mock_crud:
            mock_crud.get = AsyncMock(return_value=None)

            # Test document not found error
            with pytest.raises(ValueError, match="Document not found or access denied"):
                await unified_document_service.get_document_with_content(
                    db=mock_db,
                    document_id=999,
                    user_id=1,
                    force_sync=False
                )

    @pytest.mark.asyncio
    async def test_unsupported_repository_type_error(self):
        """Test error handling for unsupported repository type."""
        mock_db = Mock(spec=AsyncSession)

        # Create mock document with unsupported repository type
        mock_document = Mock()
        mock_document.id = 1
        mock_document.user_id = 1
        mock_document.repository_type = "unsupported"

        with patch('app.services.unified_document.document_crud.document') as mock_crud:
            mock_crud.get = AsyncMock(return_value=mock_document)

            with pytest.raises(ValueError, match="Unsupported repository type: unsupported"):
                await unified_document_service.get_document_with_content(
                    db=mock_db,
                    document_id=1,
                    user_id=1,
                    force_sync=False
                )


if __name__ == "__main__":
    pytest.main([__file__])
