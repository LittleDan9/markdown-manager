"""
Image Management API Router.

Provides endpoints for image upload, retrieval, management, and optimization
with user-scoped storage and proper authentication.
"""

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File,
    status,
    Form
)
from fastapi.responses import StreamingResponse
from typing import List, Dict, Any
import io
import logging

from app.core.auth import get_current_user, get_current_user_optional
from app.models.user import User
from app.services.storage.image_storage_service import ImageStorageService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/images", tags=["Images"])


async def get_image_service() -> ImageStorageService:
    """Dependency to get ImageStorageService instance."""
    return ImageStorageService()


@router.post("/upload", summary="Upload an image", description="Upload and optimize an image file")
async def upload_image(
    file: UploadFile = File(..., description="Image file to upload"),
    optimize_for_pdf: bool = Form(default=True, description="Optimize image for PDF rendering"),
    create_thumbnail: bool = Form(default=True, description="Create thumbnail"),
    current_user: User = Depends(get_current_user),
    image_service: ImageStorageService = Depends(get_image_service)
) -> Dict[str, Any]:
    """
    Upload an image file with optimization options.
    
    The image will be stored in the user's image directory with automatic
    optimization for PDF rendering and thumbnail generation.
    """
    try:
        # Validate file
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No file provided"
            )

        # Check if file type is supported
        if not ImageStorageService.is_supported_image(file.filename, file.content_type):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported image format. Supported formats: {list(ImageStorageService.SUPPORTED_FORMATS.keys())}"
            )

        # Check file size (max 10MB)
        max_size = 10 * 1024 * 1024  # 10MB
        content = await file.read()
        if len(content) > max_size:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Image file too large. Maximum size is 10MB."
            )

        # Store the image
        metadata = await image_service.store_image(
            user_id=current_user.id,
            image_data=content,
            filename=file.filename,
            optimize_for_pdf=optimize_for_pdf,
            create_thumbnail=create_thumbnail
        )

        logger.info(f"Image uploaded successfully for user {current_user.id}: {metadata['filename']}")
        return {
            "success": True,
            "message": "Image uploaded successfully",
            "image": metadata
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload image for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload image"
        )


@router.post("/upload-multiple", summary="Upload multiple images", description="Upload and optimize multiple image files")
async def upload_multiple_images(
    files: List[UploadFile] = File(..., description="Image files to upload"),
    optimize_for_pdf: bool = Form(default=True, description="Optimize images for PDF rendering"),
    create_thumbnail: bool = Form(default=True, description="Create thumbnails"),
    current_user: User = Depends(get_current_user),
    image_service: ImageStorageService = Depends(get_image_service)
) -> Dict[str, Any]:
    """
    Upload multiple image files with batch processing.
    
    Returns success and error information for each file.
    """
    try:
        if len(files) > 20:  # Limit batch size
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Too many files. Maximum 20 files per batch."
            )

        results = []
        total_size = 0
        max_total_size = 50 * 1024 * 1024  # 50MB total
        max_file_size = 10 * 1024 * 1024  # 10MB per file

        for file in files:
            try:
                if not file.filename:
                    results.append({
                        "filename": "unknown",
                        "success": False,
                        "error": "No filename provided"
                    })
                    continue

                # Check file type
                if not ImageStorageService.is_supported_image(file.filename, file.content_type):
                    results.append({
                        "filename": file.filename,
                        "success": False,
                        "error": "Unsupported image format"
                    })
                    continue

                # Read and check file size
                content = await file.read()
                if len(content) > max_file_size:
                    results.append({
                        "filename": file.filename,
                        "success": False,
                        "error": "File too large (max 10MB)"
                    })
                    continue

                total_size += len(content)
                if total_size > max_total_size:
                    results.append({
                        "filename": file.filename,
                        "success": False,
                        "error": "Total batch size too large (max 50MB)"
                    })
                    continue

                # Store the image
                metadata = await image_service.store_image(
                    user_id=current_user.id,
                    image_data=content,
                    filename=file.filename,
                    optimize_for_pdf=optimize_for_pdf,
                    create_thumbnail=create_thumbnail
                )

                results.append({
                    "filename": file.filename,
                    "success": True,
                    "image": metadata
                })

            except Exception as e:
                logger.error(f"Failed to process file {file.filename}: {e}")
                results.append({
                    "filename": file.filename,
                    "success": False,
                    "error": str(e)
                })

        successful_uploads = sum(1 for r in results if r["success"])
        failed_uploads = len(results) - successful_uploads

        return {
            "total_files": len(files),
            "successful_uploads": successful_uploads,
            "failed_uploads": failed_uploads,
            "results": results
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload multiple images for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload images"
        )


@router.get("/list", summary="List user images", description="Get a list of all images for the current user")
async def list_images(
    current_user: User = Depends(get_current_user),
    image_service: ImageStorageService = Depends(get_image_service)
) -> Dict[str, Any]:
    """
    Get a list of all images for the current user with metadata.
    """
    try:
        images = await image_service.list_user_images(current_user.id)
        stats = await image_service.get_storage_stats(current_user.id)

        return {
            "images": images,
            "statistics": stats
        }

    except Exception as e:
        logger.error(f"Failed to list images for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list images"
        )


@router.get("/{user_id}/{filename}", summary="Get image", description="Retrieve an image file")
async def get_image(
    user_id: int,
    filename: str,
    image_service: ImageStorageService = Depends(get_image_service)
) -> StreamingResponse:
    """
    Retrieve an image file.
    
    Returns the image as a streaming response with appropriate content type.
    """
    try:
        # Get image data
        image_data = await image_service.retrieve_image(user_id, filename)
        
        if not image_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Image not found"
            )

        # Determine content type from filename
        extension = filename.split('.')[-1].lower()
        content_type_map = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'bmp': 'image/bmp',
            'tiff': 'image/tiff',
            'tif': 'image/tiff'
        }
        content_type = content_type_map.get(extension, 'image/jpeg')

        # Return image as streaming response
        return StreamingResponse(
            io.BytesIO(image_data),
            media_type=content_type,
            headers={
                "Content-Disposition": f"inline; filename={filename}",
                "Cache-Control": "public, max-age=3600"  # Cache for 1 hour
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve image {filename} for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve image"
        )


@router.get("/thumbnails/{user_id}/{filename}", summary="Get thumbnail", description="Retrieve a thumbnail image")
async def get_thumbnail(
    user_id: int,
    filename: str,
    image_service: ImageStorageService = Depends(get_image_service)
) -> StreamingResponse:
    """
    Retrieve a thumbnail image.
    
    Returns the thumbnail as a streaming response.
    """
    try:
        # Construct thumbnail filename from original filename
        from pathlib import Path
        thumbnail_filename = f"thumb_{Path(filename).stem}.jpg"
        
        # Get thumbnail data
        thumbnail_data = await image_service.retrieve_thumbnail(user_id, thumbnail_filename)
        
        if not thumbnail_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Thumbnail not found"
            )

        # Return thumbnail as streaming response (always JPEG)
        return StreamingResponse(
            io.BytesIO(thumbnail_data),
            media_type="image/jpeg",
            headers={
                "Content-Disposition": f"inline; filename=thumb_{filename}",
                "Cache-Control": "public, max-age=7200"  # Cache for 2 hours
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve thumbnail {filename} for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve thumbnail"
        )


@router.get("/{filename}/metadata", summary="Get image metadata", description="Get metadata for a specific image")
async def get_image_metadata(
    filename: str,
    current_user: User = Depends(get_current_user),
    image_service: ImageStorageService = Depends(get_image_service)
) -> Dict[str, Any]:
    """
    Get metadata for a specific image.
    """
    try:
        metadata = await image_service.get_image_metadata(current_user.id, filename)
        return {"image": metadata}

    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found"
        )
    except Exception as e:
        logger.error(f"Failed to get metadata for {filename} for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get image metadata"
        )


@router.delete("/{filename}", summary="Delete image", description="Delete an image and its thumbnail")
async def delete_image(
    filename: str,
    current_user: User = Depends(get_current_user),
    image_service: ImageStorageService = Depends(get_image_service)
) -> Dict[str, Any]:
    """
    Delete an image file and its associated thumbnail.
    """
    try:
        success = await image_service.delete_image(current_user.id, filename)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Image not found"
            )

        return {
            "success": True,
            "message": f"Image {filename} deleted successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete image {filename} for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete image"
        )


@router.get(
    "/statistics/storage",
    summary="Get storage statistics",
    description="Get storage usage statistics for the current user"
)
async def get_storage_statistics(
    current_user: User = Depends(get_current_user),
    image_service: ImageStorageService = Depends(get_image_service)
) -> Dict[str, Any]:
    """
    Get storage statistics for the current user's images.
    """
    try:
        stats = await image_service.get_storage_stats(current_user.id)
        return {"statistics": stats}

    except Exception as e:
        logger.error(f"Failed to get storage stats for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get storage statistics"
        )


@router.post("/upload-from-clipboard", summary="Upload from clipboard", description="Upload an image from clipboard data")
async def upload_from_clipboard(
    image_data: str = Form(..., description="Base64 encoded image data"),
    filename: str = Form(default="clipboard_image.png", description="Filename for the image"),
    optimize_for_pdf: bool = Form(default=True, description="Optimize image for PDF rendering"),
    create_thumbnail: bool = Form(default=True, description="Create thumbnail"),
    current_user: User = Depends(get_current_user),
    image_service: ImageStorageService = Depends(get_image_service)
) -> Dict[str, Any]:
    """
    Upload an image from clipboard data (base64 encoded).
    
    This endpoint is designed for paste functionality from the frontend.
    """
    try:
        import base64

        # Remove data URL prefix if present (e.g., "data:image/png;base64,")
        if image_data.startswith('data:'):
            image_data = image_data.split(',', 1)[1]

        # Decode base64 data
        try:
            decoded_data = base64.b64decode(image_data)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid base64 image data"
            )

        # Check file size (max 10MB)
        max_size = 10 * 1024 * 1024  # 10MB
        if len(decoded_data) > max_size:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Image data too large. Maximum size is 10MB."
            )

        # Store the image
        metadata = await image_service.store_image(
            user_id=current_user.id,
            image_data=decoded_data,
            filename=filename,
            optimize_for_pdf=optimize_for_pdf,
            create_thumbnail=create_thumbnail
        )

        logger.info(f"Clipboard image uploaded successfully for user {current_user.id}: {metadata['filename']}")
        return {
            "success": True,
            "message": "Clipboard image uploaded successfully",
            "image": metadata
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload clipboard image for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload clipboard image"
        )
