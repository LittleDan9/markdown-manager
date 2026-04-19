"""
Attachment Storage Service for managing document file attachments.

Handles file upload, validation, storage, and retrieval with
user-scoped directory organization and virus scanning.
"""
import hashlib
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any

import aiofiles

from app.configs.settings import get_settings
from app.services.virus_scan_service import virus_scan_service

logger = logging.getLogger(__name__)
settings = get_settings()


# Browser-renderable MIME types allowed for upload
ALLOWED_MIME_TYPES: Dict[str, list[str]] = {
    "application/pdf": [".pdf"],
    "text/plain": [".txt", ".log"],
    "text/csv": [".csv"],
}

# Maximum file size: 20 MB
MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024


class AttachmentStorageService:
    """Service for managing document attachment storage."""

    def __init__(self):
        self.storage_root = Path(settings.markdown_storage_root)
        self.storage_root.mkdir(parents=True, exist_ok=True)

    def get_user_attachment_directory(self, user_id: int) -> Path:
        """Get the attachment directory for a user."""
        return self.storage_root / str(user_id) / "attachments"

    def _validate_mime_type(self, filename: str, content_type: str | None) -> str:
        """
        Validate that the file's MIME type is allowed.

        Returns the validated MIME type.
        Raises ValueError if not allowed.
        """
        extension = Path(filename).suffix.lower()

        # Check by extension
        for mime, extensions in ALLOWED_MIME_TYPES.items():
            if extension in extensions:
                return mime

        # Check by content type header
        if content_type and content_type in ALLOWED_MIME_TYPES:
            return content_type

        allowed_extensions = []
        for exts in ALLOWED_MIME_TYPES.values():
            allowed_extensions.extend(exts)
        raise ValueError(
            f"Unsupported file type '{extension}'. "
            f"Allowed types: {', '.join(sorted(allowed_extensions))}"
        )

    def _calculate_content_hash(self, content: bytes) -> str:
        """Calculate SHA-256 hash of file content."""
        return hashlib.sha256(content).hexdigest()

    def _generate_stored_filename(self, original_filename: str, content_hash: str) -> str:
        """Generate a unique stored filename using content hash and timestamp."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        extension = Path(original_filename).suffix.lower()
        base_name = Path(original_filename).stem[:50]
        # Sanitize filename
        safe_name = "".join(c for c in base_name if c.isalnum() or c in "._-")
        return f"{timestamp}_{content_hash[:8]}_{safe_name}{extension}"

    async def store_attachment(
        self,
        user_id: int,
        file_data: bytes,
        filename: str,
        content_type: str | None = None,
    ) -> Dict[str, Any]:
        """
        Store an attachment file with validation and virus scanning.

        Args:
            user_id: Owner user ID.
            file_data: Raw file bytes.
            filename: Original filename.
            content_type: MIME content type header.

        Returns:
            Dict with stored_filename, mime_type, file_size_bytes, content_hash.

        Raises:
            ValueError: If MIME type is invalid or file too large.
            ConnectionError: If ClamAV is unreachable.
            PermissionError: If virus detected.
        """
        # 1. Validate MIME type
        mime_type = self._validate_mime_type(filename, content_type)

        # 2. Validate file size
        if len(file_data) > MAX_FILE_SIZE_BYTES:
            raise ValueError(
                f"File too large ({len(file_data)} bytes). "
                f"Maximum size is {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB."
            )

        # 3. Calculate content hash
        content_hash = self._calculate_content_hash(file_data)

        # 4. Generate stored filename
        stored_filename = self._generate_stored_filename(filename, content_hash)

        # 5. Create user attachment directory
        user_dir = self.get_user_attachment_directory(user_id)
        user_dir.mkdir(parents=True, exist_ok=True)

        # 6. Virus scan (stream-based, no shared volume needed)
        scan_result = virus_scan_service.scan_stream(file_data)

        if scan_result.status == "infected":
            raise PermissionError(
                f"Virus detected: {scan_result.detail}. File rejected."
            )

        if scan_result.status == "error":
            logger.warning(
                "Virus scan returned error for %s: %s", filename, scan_result.detail
            )
            # Still allow if scan errored (not a connection failure)
            # Connection failures raise ConnectionError from scan_stream

        # 7. Write to final location
        final_path = user_dir / stored_filename

        try:
            async with aiofiles.open(final_path, "wb") as f:
                await f.write(file_data)

            return {
                "stored_filename": stored_filename,
                "mime_type": mime_type,
                "file_size_bytes": len(file_data),
                "content_hash": content_hash,
                "scan_status": scan_result.status,
                "scan_result": scan_result.detail,
            }

        except Exception:
            final_path.unlink(missing_ok=True)
            raise

    def get_attachment_path(self, user_id: int, stored_filename: str) -> Path:
        """Get the filesystem path for an attachment."""
        return self.get_user_attachment_directory(user_id) / stored_filename

    def delete_attachment_file(self, user_id: int, stored_filename: str) -> bool:
        """Delete an attachment file from disk."""
        path = self.get_attachment_path(user_id, stored_filename)
        if path.exists():
            path.unlink()
            logger.info("Deleted attachment file: %s", path)
            return True
        logger.warning("Attachment file not found for deletion: %s", path)
        return False
