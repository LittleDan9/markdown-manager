"""
Image Storage Service for managing user images.

Handles image upload, optimization, storage, and retrieval with
user-scoped directory organization and format optimization.
"""

import asyncio
import hashlib
import aiofiles
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime
import logging
from PIL import Image, ImageOps
import io

from app.configs.settings import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class ImageStorageService:
    """Service for managing user image storage and optimization."""

    # Supported image formats
    SUPPORTED_FORMATS = {
        'image/jpeg': ['.jpg', '.jpeg'],
        'image/png': ['.png'],
        'image/gif': ['.gif'],
        'image/webp': ['.webp'],
        'image/bmp': ['.bmp'],
        'image/tiff': ['.tiff', '.tif']
    }

    # PDF optimization settings
    PDF_MAX_WIDTH = 612  # 8.5 inches at 72 DPI
    PDF_MAX_HEIGHT = 792  # 11 inches at 72 DPI
    PDF_QUALITY = 85  # JPEG quality for optimization
    THUMBNAIL_SIZE = (200, 200)  # Thumbnail dimensions

    def __init__(self):
        """Initialize the image storage service."""
        self.storage_root = Path(settings.markdown_storage_root)
        self.storage_root.mkdir(parents=True, exist_ok=True)

    def get_user_image_directory(self, user_id: int) -> Path:
        """Get the base image directory for a user."""
        return self.storage_root / str(user_id) / "images"

    def get_user_thumbnail_directory(self, user_id: int) -> Path:
        """Get the thumbnail directory for a user."""
        return self.get_user_image_directory(user_id) / "thumbnails"

    async def create_user_image_directories(self, user_id: int) -> bool:
        """
        Create the image directory structure for a user.

        Args:
            user_id: The ID of the user

        Returns:
            True if successful, False otherwise
        """
        try:
            image_dir = self.get_user_image_directory(user_id)
            thumbnail_dir = self.get_user_thumbnail_directory(user_id)

            # Create directories
            image_dir.mkdir(parents=True, exist_ok=True)
            thumbnail_dir.mkdir(parents=True, exist_ok=True)

            logger.info(f"Created image directory structure for user {user_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to create image directories for user {user_id}: {e}")
            return False

    def _generate_unique_filename(self, original_filename: str, content_hash: str) -> str:
        """
        Generate a unique filename using content hash and timestamp.

        Args:
            original_filename: Original uploaded filename
            content_hash: SHA-256 hash of file content

        Returns:
            Unique filename
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        base_name = Path(original_filename).stem[:50]  # Limit length
        extension = Path(original_filename).suffix.lower()
        
        # Sanitize filename
        safe_name = "".join(c for c in base_name if c.isalnum() or c in "._-")
        
        return f"{timestamp}_{content_hash[:8]}_{safe_name}{extension}"

    def _calculate_content_hash(self, content: bytes) -> str:
        """Calculate SHA-256 hash of file content."""
        return hashlib.sha256(content).hexdigest()

    async def _optimize_image_for_pdf(self, image_data: bytes, filename: str) -> Tuple[bytes, str]:
        """
        Optimize image for PDF rendering while preserving quality.

        Args:
            image_data: Original image bytes
            filename: Original filename

        Returns:
            Tuple of (optimized_bytes, optimized_format)
        """
        def _process_image():
            # Open image with PIL
            with Image.open(io.BytesIO(image_data)) as img:
                # Auto-rotate based on EXIF data
                img = ImageOps.exif_transpose(img)
                
                # Convert to RGB if necessary (for JPEG compatibility)
                if img.mode in ('RGBA', 'P', 'LA'):
                    # Create white background for transparency
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                    if 'transparency' in img.info:
                        background.paste(img, mask=img.split()[-1])
                    else:
                        background.paste(img)
                    img = background
                elif img.mode != 'RGB':
                    img = img.convert('RGB')

                # Calculate optimal size for PDF (8.5x11 paper)
                original_width, original_height = img.size
                aspect_ratio = original_width / original_height

                # Calculate new dimensions to fit PDF page
                if aspect_ratio > (self.PDF_MAX_WIDTH / self.PDF_MAX_HEIGHT):
                    # Landscape orientation or wide image
                    new_width = min(original_width, self.PDF_MAX_WIDTH)
                    new_height = int(new_width / aspect_ratio)
                else:
                    # Portrait orientation or tall image
                    new_height = min(original_height, self.PDF_MAX_HEIGHT)
                    new_width = int(new_height * aspect_ratio)

                # Only resize if image is larger than target
                if original_width > new_width or original_height > new_height:
                    img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

                # Save optimized image
                output_buffer = io.BytesIO()
                
                # Choose optimal format
                original_ext = Path(filename).suffix.lower()
                if original_ext in ['.png'] and img.mode == 'RGBA':
                    # Keep PNG for transparency
                    img.save(output_buffer, format='PNG', optimize=True)
                    optimized_format = 'png'
                else:
                    # Use JPEG for smaller file size
                    img.save(output_buffer, format='JPEG', quality=self.PDF_QUALITY, optimize=True)
                    optimized_format = 'jpg'

                return output_buffer.getvalue(), optimized_format

        # Run image processing in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _process_image)

    async def _create_thumbnail(self, image_data: bytes) -> bytes:
        """
        Create a thumbnail of the image.

        Args:
            image_data: Original image bytes

        Returns:
            Thumbnail image bytes
        """
        def _process_thumbnail():
            with Image.open(io.BytesIO(image_data)) as img:
                # Auto-rotate based on EXIF data
                img = ImageOps.exif_transpose(img)
                
                # Create thumbnail
                img.thumbnail(self.THUMBNAIL_SIZE, Image.Resampling.LANCZOS)
                
                # Convert to RGB if necessary
                if img.mode in ('RGBA', 'P', 'LA'):
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                    if 'transparency' in img.info:
                        background.paste(img, mask=img.split()[-1])
                    else:
                        background.paste(img)
                    img = background

                # Save thumbnail as JPEG
                output_buffer = io.BytesIO()
                img.save(output_buffer, format='JPEG', quality=80, optimize=True)
                return output_buffer.getvalue()

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _process_thumbnail)

    async def store_image(
        self,
        user_id: int,
        image_data: bytes,
        filename: str,
        optimize_for_pdf: bool = True,
        create_thumbnail: bool = True
    ) -> Dict[str, Any]:
        """
        Store an image with optimization and metadata.

        Args:
            user_id: The ID of the user
            image_data: Image file bytes
            filename: Original filename
            optimize_for_pdf: Whether to optimize for PDF rendering
            create_thumbnail: Whether to create a thumbnail

        Returns:
            Dictionary with image metadata and paths
        """
        try:
            # Ensure user directories exist
            await self.create_user_image_directories(user_id)

            # Calculate content hash for deduplication
            content_hash = self._calculate_content_hash(image_data)
            
            # Generate unique filename
            unique_filename = self._generate_unique_filename(filename, content_hash)
            
            # Get file paths
            image_dir = self.get_user_image_directory(user_id)
            thumbnail_dir = self.get_user_thumbnail_directory(user_id)
            
            # Check if image already exists (deduplication)
            existing_files = list(image_dir.glob(f"*_{content_hash[:8]}_*"))
            if existing_files:
                existing_file = existing_files[0]
                logger.info(f"Image already exists for user {user_id}: {existing_file.name}")
                return await self.get_image_metadata(user_id, existing_file.name)

            # Optimize image if requested
            if optimize_for_pdf:
                optimized_data, optimized_format = await self._optimize_image_for_pdf(image_data, filename)
                # Update filename with optimized format
                unique_filename = f"{Path(unique_filename).stem}.{optimized_format}"
                final_image_data = optimized_data
            else:
                final_image_data = image_data

            # Store main image
            image_path = image_dir / unique_filename
            async with aiofiles.open(image_path, 'wb') as f:
                await f.write(final_image_data)

            # Create thumbnail if requested
            thumbnail_path = None
            if create_thumbnail:
                try:
                    thumbnail_data = await self._create_thumbnail(image_data)
                    thumbnail_filename = f"thumb_{unique_filename.replace(Path(unique_filename).suffix, '.jpg')}"
                    thumbnail_path = thumbnail_dir / thumbnail_filename
                    async with aiofiles.open(thumbnail_path, 'wb') as f:
                        await f.write(thumbnail_data)
                except Exception as e:
                    logger.warning(f"Failed to create thumbnail for {unique_filename}: {e}")

            # Get image dimensions
            def _get_dimensions():
                with Image.open(io.BytesIO(final_image_data)) as img:
                    return img.size

            loop = asyncio.get_event_loop()
            width, height = await loop.run_in_executor(None, _get_dimensions)

            # Return metadata
            metadata = {
                'filename': unique_filename,
                'original_filename': filename,
                'content_hash': content_hash,
                'file_size': len(final_image_data),
                'width': width,
                'height': height,
                'thumbnail_filename': thumbnail_path.name if thumbnail_path else None,
                'relative_path': f"images/{unique_filename}",
                'thumbnail_path': f"images/thumbnails/{thumbnail_path.name}" if thumbnail_path else None,
                'created_at': datetime.now().isoformat(),
                'optimized_for_pdf': optimize_for_pdf,
                'url_path': f"/api/images/{user_id}/{unique_filename}",
                'thumbnail_url': f"/api/images/{user_id}/thumbnails/{thumbnail_path.name}" if thumbnail_path else None
            }

            logger.info(f"Stored image for user {user_id}: {unique_filename} ({len(final_image_data)} bytes)")
            return metadata

        except Exception as e:
            logger.error(f"Failed to store image for user {user_id}: {e}")
            raise

    async def retrieve_image(self, user_id: int, filename: str) -> Optional[bytes]:
        """
        Retrieve an image file.

        Args:
            user_id: The ID of the user
            filename: Image filename

        Returns:
            Image bytes or None if not found
        """
        try:
            image_path = self.get_user_image_directory(user_id) / filename
            
            if not image_path.exists():
                return None

            async with aiofiles.open(image_path, 'rb') as f:
                return await f.read()

        except Exception as e:
            logger.error(f"Failed to retrieve image {filename} for user {user_id}: {e}")
            return None

    async def retrieve_thumbnail(self, user_id: int, filename: str) -> Optional[bytes]:
        """
        Retrieve a thumbnail image.

        Args:
            user_id: The ID of the user
            filename: Thumbnail filename

        Returns:
            Thumbnail bytes or None if not found
        """
        try:
            thumbnail_path = self.get_user_thumbnail_directory(user_id) / filename
            
            if not thumbnail_path.exists():
                return None

            async with aiofiles.open(thumbnail_path, 'rb') as f:
                return await f.read()

        except Exception as e:
            logger.error(f"Failed to retrieve thumbnail {filename} for user {user_id}: {e}")
            return None

    async def delete_image(self, user_id: int, filename: str) -> bool:
        """
        Delete an image and its thumbnail.

        Args:
            user_id: The ID of the user
            filename: Image filename

        Returns:
            True if successful, False otherwise
        """
        try:
            image_path = self.get_user_image_directory(user_id) / filename
            
            # Delete main image
            if image_path.exists():
                image_path.unlink()

            # Delete thumbnail
            thumbnail_filename = f"thumb_{Path(filename).stem}.jpg"
            thumbnail_path = self.get_user_thumbnail_directory(user_id) / thumbnail_filename
            if thumbnail_path.exists():
                thumbnail_path.unlink()

            logger.info(f"Deleted image for user {user_id}: {filename}")
            return True

        except Exception as e:
            logger.error(f"Failed to delete image {filename} for user {user_id}: {e}")
            return False

    async def list_user_images(self, user_id: int) -> List[Dict[str, Any]]:
        """
        List all images for a user with metadata.

        Args:
            user_id: The ID of the user

        Returns:
            List of image metadata dictionaries
        """
        try:
            image_dir = self.get_user_image_directory(user_id)
            
            if not image_dir.exists():
                return []

            images = []
            for image_path in image_dir.glob("*"):
                if image_path.is_file() and not image_path.name.startswith('.'):
                    try:
                        metadata = await self.get_image_metadata(user_id, image_path.name)
                        images.append(metadata)
                    except Exception as e:
                        logger.warning(f"Failed to get metadata for {image_path.name}: {e}")

            # Sort by creation time (newest first)
            images.sort(key=lambda x: x.get('created_at', ''), reverse=True)
            return images

        except Exception as e:
            logger.error(f"Failed to list images for user {user_id}: {e}")
            return []

    async def get_image_metadata(self, user_id: int, filename: str) -> Dict[str, Any]:
        """
        Get metadata for a specific image.

        Args:
            user_id: The ID of the user
            filename: Image filename

        Returns:
            Image metadata dictionary
        """
        try:
            image_path = self.get_user_image_directory(user_id) / filename
            
            if not image_path.exists():
                raise FileNotFoundError(f"Image not found: {filename}")

            # Get file stats
            stat = image_path.stat()
            
            # Get image dimensions
            async with aiofiles.open(image_path, 'rb') as f:
                image_data = await f.read()

            def _get_image_info():
                with Image.open(io.BytesIO(image_data)) as img:
                    return img.size, img.format

            loop = asyncio.get_event_loop()
            (width, height), img_format = await loop.run_in_executor(None, _get_image_info)

            # Check for thumbnail
            thumbnail_filename = f"thumb_{Path(filename).stem}.jpg"
            thumbnail_path = self.get_user_thumbnail_directory(user_id) / thumbnail_filename
            has_thumbnail = thumbnail_path.exists()

            return {
                'filename': filename,
                'file_size': stat.st_size,
                'width': width,
                'height': height,
                'format': img_format,
                'thumbnail_filename': thumbnail_filename if has_thumbnail else None,
                'relative_path': f"images/{filename}",
                'thumbnail_path': f"images/thumbnails/{thumbnail_filename}" if has_thumbnail else None,
                'created_at': datetime.fromtimestamp(stat.st_ctime).isoformat(),
                'modified_at': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                'url_path': f"/api/images/{user_id}/{filename}",
                'thumbnail_url': f"/api/images/{user_id}/thumbnails/{thumbnail_filename}" if has_thumbnail else None
            }

        except Exception as e:
            logger.error(f"Failed to get metadata for {filename} for user {user_id}: {e}")
            raise

    async def get_storage_stats(self, user_id: int) -> Dict[str, Any]:
        """
        Get storage statistics for a user's images.

        Args:
            user_id: The ID of the user

        Returns:
            Storage statistics dictionary
        """
        try:
            image_dir = self.get_user_image_directory(user_id)
            thumbnail_dir = self.get_user_thumbnail_directory(user_id)

            if not image_dir.exists():
                return {
                    'total_images': 0,
                    'total_size_bytes': 0,
                    'thumbnail_size_bytes': 0,
                    'total_size_mb': 0.0
                }

            total_images = 0
            total_size = 0
            thumbnail_size = 0

            # Count main images
            for image_path in image_dir.glob("*"):
                if image_path.is_file():
                    total_images += 1
                    total_size += image_path.stat().st_size

            # Count thumbnails
            if thumbnail_dir.exists():
                for thumb_path in thumbnail_dir.glob("*"):
                    if thumb_path.is_file():
                        thumbnail_size += thumb_path.stat().st_size

            return {
                'total_images': total_images,
                'total_size_bytes': total_size,
                'thumbnail_size_bytes': thumbnail_size,
                'total_size_mb': round((total_size + thumbnail_size) / (1024 * 1024), 2)
            }

        except Exception as e:
            logger.error(f"Failed to get storage stats for user {user_id}: {e}")
            return {
                'total_images': 0,
                'total_size_bytes': 0,
                'thumbnail_size_bytes': 0,
                'total_size_mb': 0.0
            }

    @classmethod
    def is_supported_image(cls, filename: str, content_type: Optional[str] = None) -> bool:
        """
        Check if an image format is supported.

        Args:
            filename: Image filename
            content_type: MIME content type

        Returns:
            True if supported, False otherwise
        """
        extension = Path(filename).suffix.lower()
        
        if content_type:
            return content_type in cls.SUPPORTED_FORMATS
        
        for mime_type, extensions in cls.SUPPORTED_FORMATS.items():
            if extension in extensions:
                return True
        
        return False