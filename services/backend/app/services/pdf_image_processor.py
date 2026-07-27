"""PDF Image Processor Service.

This service processes HTML content for PDF export by converting user images
to base64 data URIs so they can be embedded directly in the PDF.
"""
import base64
import logging
import re
from typing import Optional

from app.services.storage.image_storage_service import ImageStorageService

logger = logging.getLogger(__name__)


class PDFImageProcessor:
    """Processes images in HTML content for PDF export."""
    
    def __init__(self, image_storage_service: ImageStorageService):
        """Initialize with image storage service."""
        self.image_storage_service = image_storage_service
    
    async def process_html_for_pdf(
        self, html_content: str, user_id: int, image_metadata: dict | None = None
    ) -> str:
        """
        Process HTML content to embed user images as base64 data URIs for PDF export.
        
        If image_metadata is provided, annotations are flattened onto images before embedding.
        
        Args:
            html_content: The HTML content containing image references
            user_id: The user ID for accessing user-scoped images
            image_metadata: Optional document image_metadata dict with annotation data
            
        Returns:
            Modified HTML content with images embedded as data URIs
        """
        logger.info("Processing HTML content for PDF export")
        
        # Find all image tags with src attributes
        img_pattern = r'<img[^>]+src=["\']([^"\']+)["\'][^>]*>'
        img_matches = re.findall(img_pattern, html_content, re.IGNORECASE)
        
        if not img_matches:
            logger.info("No images found in HTML content")
            return html_content
        
        logger.info(f"Found {len(img_matches)} images to process")
        processed_content = html_content
        
        for img_src in img_matches:
            try:
                # Check if this is a user image URL
                if self._is_user_image_url(img_src):
                    # Extract image ID from URL
                    image_id = self._extract_image_id_from_url(img_src)
                    if image_id:
                        # Check for annotations on this image
                        annotations = self._get_annotations_for_image(image_id, image_metadata)
                        
                        # Get image data and convert to data URI
                        data_uri = await self._convert_to_data_uri(
                            image_id, user_id, annotations=annotations
                        )
                        if data_uri:
                            # Replace the URL with the data URI
                            processed_content = processed_content.replace(img_src, data_uri)
                            logger.info(f"Embedded image {image_id} as data URI")
                        else:
                            logger.warning(f"Failed to convert image {image_id} to data URI")
                    else:
                        logger.warning(f"Could not extract image ID from URL: {img_src}")
                else:
                    logger.info(f"Skipping external image: {img_src}")
                    
            except Exception as e:
                logger.error(f"Error processing image {img_src}: {e}")
                # Continue processing other images even if one fails
                continue
        
        logger.info("Completed HTML processing for PDF export")
        return processed_content
    
    def _is_user_image_url(self, url: str) -> bool:
        """Check if URL is a user image URL."""
        return '/api/images/' in url or '/images/' in url
    
    def _extract_image_id_from_url(self, url: str) -> Optional[str]:
        """Extract image ID from a user image URL."""
        # Handle URLs like /api/images/{image_id} or /api/v1/images/{image_id}
        patterns = [
            r'/api/(?:v1/)?images/([^/?#]+)',
            r'/images/([^/?#]+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        
        return None
    
    async def _convert_to_data_uri(
        self, image_id: str, user_id: int, annotations: dict | None = None
    ) -> Optional[str]:
        """Convert an image to a data URI, optionally flattening annotations."""
        try:
            # Get image data from storage
            image_data = await self.image_storage_service.retrieve_image(user_id, image_id)
            if not image_data:
                logger.warning(f"Image {image_id} not found for user {user_id}")
                return None
            
            # Flatten annotations onto image if present
            if annotations and annotations.get("shapes"):
                try:
                    image_data = await self.image_storage_service.flatten_annotations(
                        image_data, annotations
                    )
                    # After flattening, format is always PNG
                    mime_type = "image/png"
                    logger.info(f"Flattened annotations onto image {image_id}")
                except Exception as e:
                    logger.warning(f"Failed to flatten annotations for {image_id}: {e}")
                    # Fall through to use original image
                    metadata = await self.image_storage_service.get_image_metadata(user_id, image_id)
                    mime_type = self._get_mime_type_from_format(metadata.get('format', 'JPEG')) if metadata else 'image/jpeg'
            else:
                # Get image metadata for MIME type
                metadata = await self.image_storage_service.get_image_metadata(user_id, image_id)
                if not metadata:
                    logger.warning(f"Metadata for image {image_id} not found")
                    return None
                mime_type = self._get_mime_type_from_format(metadata.get('format', 'JPEG'))
            
            # Encode as base64
            base64_data = base64.b64encode(image_data).decode('utf-8')
            
            # Create data URI
            data_uri = f"data:{mime_type};base64,{base64_data}"
            
            logger.info(f"Converted image {image_id} to data URI (size: {len(base64_data)} chars)")
            return data_uri
            
        except Exception as e:
            logger.error(f"Error converting image {image_id} to data URI: {e}")
            return None
    
    def _get_mime_type_from_format(self, format_str: str) -> str:
        """Get MIME type from image format."""
        format_to_mime = {
            'JPEG': 'image/jpeg',
            'JPG': 'image/jpeg',
            'PNG': 'image/png',
            'GIF': 'image/gif',
            'WEBP': 'image/webp',
            'BMP': 'image/bmp',
            'TIFF': 'image/tiff',
        }
        
        return format_to_mime.get(format_str.upper(), 'image/jpeg')

    def _get_annotations_for_image(
        self, image_id: str, image_metadata: dict | None
    ) -> dict | None:
        """
        Look up annotation data for a given image filename in image_metadata.
        
        Searches all instances of the image and returns the first annotations found.
        In practice, PDF export uses a single flattened view, so we merge all instances.
        """
        if not image_metadata:
            return None

        # image_id is the filename; look it up in metadata
        image_entry = image_metadata.get(image_id)
        if not image_entry or not image_entry.get("instances"):
            return None

        # Collect annotations from all instances (different line numbers)
        # For PDF, we combine all annotations for the same image file
        all_shapes = []
        for _line_key, instance in image_entry["instances"].items():
            annotations = instance.get("annotations")
            if annotations and annotations.get("shapes"):
                all_shapes.extend(annotations["shapes"])

        if not all_shapes:
            return None

        return {"version": 1, "shapes": all_shapes}


# Create a dependency function for FastAPI
def get_pdf_image_processor() -> PDFImageProcessor:
    """Dependency function to get PDF image processor."""
    from app.services.storage.image_storage_service import ImageStorageService
    image_storage_service = ImageStorageService()
    return PDFImageProcessor(image_storage_service)
