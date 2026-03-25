"""
Attachment Management API Router.

Provides endpoints for attachment upload, retrieval, management,
and deletion with user-scoped storage, virus scanning, and quota enforcement.
"""
import logging
from typing import Dict, Any

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    UploadFile,
    File,
    Form,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.crud.attachment import attachment_crud
from app.database import get_db
from app.models.user import User
from app.schemas.attachment import (
    AttachmentListResponse,
    AttachmentQuotaInfo,
    AttachmentResponse,
)
from app.services.attachment_quota_service import check_quota, get_quota_usage
from app.services.storage.attachment_storage_service import AttachmentStorageService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/attachments", tags=["Attachments"])


async def get_attachment_service() -> AttachmentStorageService:
    """Dependency to get AttachmentStorageService instance."""
    return AttachmentStorageService()


def _build_attachment_response(attachment) -> AttachmentResponse:
    """Build an AttachmentResponse from an Attachment model instance."""
    return AttachmentResponse(
        id=attachment.id,
        document_id=attachment.document_id,
        user_id=attachment.user_id,
        original_filename=attachment.original_filename,
        mime_type=attachment.mime_type,
        file_size_bytes=attachment.file_size_bytes,
        scan_status=attachment.scan_status,
        scan_result=attachment.scan_result,
        download_url=f"/api/attachments/{attachment.id}/download",
        view_url=f"/api/attachments/{attachment.id}/view",
        created_at=attachment.created_at,
        updated_at=attachment.updated_at,
    )


# ──────────────────────────────────────────────────────────────────────────
# Upload
# ──────────────────────────────────────────────────────────────────────────

@router.post("/upload", summary="Upload a file attachment")
async def upload_attachment(
    file: UploadFile = File(..., description="File to upload"),
    document_id: int = Form(..., description="Document to attach the file to"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    attachment_service: AttachmentStorageService = Depends(get_attachment_service),
) -> Dict[str, Any]:
    """
    Upload a file attachment to a document.

    Validates MIME type, enforces size limit and user quota,
    performs virus scan, then stores the file and creates a DB record.
    """
    try:
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No file provided",
            )

        # Read file content
        content = await file.read()

        # Check quota before processing
        quota_check = await check_quota(db, current_user.id, len(content))
        if not quota_check.allowed:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=quota_check.message,
            )

        # Store file (validates MIME, size, scans for viruses)
        stored = await attachment_service.store_attachment(
            user_id=current_user.id,
            file_data=content,
            filename=file.filename,
            content_type=file.content_type,
        )

        # Create DB record
        attachment = await attachment_crud.create(
            db,
            user_id=current_user.id,
            document_id=document_id,
            original_filename=file.filename,
            stored_filename=stored["stored_filename"],
            mime_type=stored["mime_type"],
            file_size_bytes=stored["file_size_bytes"],
            content_hash=stored["content_hash"],
            scan_status=stored["scan_status"],
            scan_result=stored.get("scan_result"),
        )

        logger.info(
            "Attachment uploaded: %s for document %d by user %d",
            file.filename,
            document_id,
            current_user.id,
        )

        return {
            "success": True,
            "message": "Attachment uploaded successfully",
            "attachment": _build_attachment_response(attachment).model_dump(),
        }

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except ConnectionError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Virus scanning service is unavailable. Upload rejected.",
        )
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except Exception as e:
        logger.error("Failed to upload attachment for user %d: %s", current_user.id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload attachment",
        )


# ──────────────────────────────────────────────────────────────────────────
# Listing
# ──────────────────────────────────────────────────────────────────────────

@router.get("/document/{document_id}", summary="List attachments for a document")
async def list_document_attachments(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AttachmentListResponse:
    """Get all attachments for a specific document."""
    items = await attachment_crud.get_by_document(db, document_id, current_user.id)
    return AttachmentListResponse(
        items=[_build_attachment_response(a) for a in items],
        total=len(items),
    )


@router.get("/library", summary="List all user attachments")
async def list_user_attachments(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AttachmentListResponse:
    """Get all attachments for the current user (library view) with quota info."""
    offset = (page - 1) * page_size
    items, total = await attachment_crud.get_by_user(
        db, current_user.id, offset=offset, limit=page_size
    )

    usage = await get_quota_usage(db, current_user.id)

    return AttachmentListResponse(
        items=[_build_attachment_response(a) for a in items],
        total=total,
        quota=AttachmentQuotaInfo(
            used_bytes=usage.used_bytes,
            quota_bytes=usage.quota_bytes,
            remaining_bytes=usage.remaining_bytes,
            percentage_used=usage.percentage_used,
        ),
    )


# ──────────────────────────────────────────────────────────────────────────
# Serving / Download
# ──────────────────────────────────────────────────────────────────────────

@router.get("/{attachment_id}/download", summary="Download an attachment")
async def download_attachment(
    attachment_id: int,
    db: AsyncSession = Depends(get_db),
    attachment_service: AttachmentStorageService = Depends(get_attachment_service),
) -> FileResponse:
    """Download an attachment file (Content-Disposition: attachment). Public like images."""
    attachment = await attachment_crud.get_by_id(db, attachment_id)
    if attachment is None:
        raise HTTPException(status_code=404, detail="Attachment not found")

    file_path = attachment_service.get_attachment_path(
        attachment.user_id, attachment.stored_filename
    )
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Attachment file not found on disk")

    return FileResponse(
        path=str(file_path),
        filename=attachment.original_filename,
        media_type=attachment.mime_type,
        headers={"Content-Disposition": f'attachment; filename="{attachment.original_filename}"'},
    )


@router.get("/{attachment_id}/view", summary="View an attachment in browser")
async def view_attachment(
    attachment_id: int,
    db: AsyncSession = Depends(get_db),
    attachment_service: AttachmentStorageService = Depends(get_attachment_service),
) -> FileResponse:
    """Serve an attachment for inline viewing (Content-Disposition: inline). Public like images."""
    attachment = await attachment_crud.get_by_id(db, attachment_id)
    if attachment is None:
        raise HTTPException(status_code=404, detail="Attachment not found")

    file_path = attachment_service.get_attachment_path(
        attachment.user_id, attachment.stored_filename
    )
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Attachment file not found on disk")

    return FileResponse(
        path=str(file_path),
        media_type=attachment.mime_type,
        headers={"Content-Disposition": f'inline; filename="{attachment.original_filename}"'},
    )


# ──────────────────────────────────────────────────────────────────────────
# Metadata & Delete
# ──────────────────────────────────────────────────────────────────────────

@router.get("/{attachment_id}", summary="Get attachment metadata")
async def get_attachment(
    attachment_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AttachmentResponse:
    """Get metadata for a single attachment."""
    attachment = await attachment_crud.get(db, attachment_id, current_user.id)
    if attachment is None:
        raise HTTPException(status_code=404, detail="Attachment not found")

    return _build_attachment_response(attachment)


@router.delete("/{attachment_id}", summary="Delete an attachment")
async def delete_attachment(
    attachment_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    attachment_service: AttachmentStorageService = Depends(get_attachment_service),
) -> Dict[str, Any]:
    """Delete an attachment (DB record and file on disk)."""
    attachment = await attachment_crud.delete(db, attachment_id, current_user.id)
    if attachment is None:
        raise HTTPException(status_code=404, detail="Attachment not found")

    # Clean up file on disk
    attachment_service.delete_attachment_file(
        attachment.user_id, attachment.stored_filename
    )

    logger.info(
        "Attachment deleted: %s (id=%d) by user %d",
        attachment.original_filename,
        attachment.id,
        current_user.id,
    )

    return {"success": True, "message": "Attachment deleted successfully"}
