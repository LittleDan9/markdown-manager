"""Diagrams.net export router."""
import base64
import logging
from fastapi import APIRouter, HTTPException
from pydantic import ValidationError

from app.models import DiagramsNetExportRequest, DiagramsNetExportResponse
from app.services.diagramsnet_service import diagramsnet_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/diagramsnet", response_model=DiagramsNetExportResponse)
async def export_diagramsnet(request: DiagramsNetExportRequest) -> DiagramsNetExportResponse:
    """
    Convert Mermaid SVG to diagrams.net XML format.

    This endpoint accepts raw SVG content from the Mermaid rendering engine
    and converts it to diagrams.net's XML format with embedded PNG capability.

    Args:
        request: DiagramsNetExportRequest containing SVG content and format options

    Returns:
        DiagramsNetExportResponse with conversion results and quality assessment

    Raises:
        HTTPException: If conversion fails or invalid input provided
    """
    try:
        logger.info(f"Starting diagrams.net export conversion, format: {request.format}")
        logger.info(f"SVG content length: {len(request.svg_content)} characters")

        # Validate SVG content
        if not request.svg_content.strip():
            raise HTTPException(
                status_code=400,
                detail="SVG content cannot be empty"
            )

        if not request.svg_content.strip().startswith('<svg'):
            raise HTTPException(
                status_code=400,
                detail="Invalid SVG content - must start with <svg tag"
            )

        # Perform conversion based on requested format
        try:
            if request.format == "png":
                # Convert to PNG with embedded XML
                png_bytes, quality = await diagramsnet_service.convert_svg_to_diagrams_png(
                    request.svg_content
                )

                # Encode PNG bytes as base64
                file_data = base64.b64encode(png_bytes).decode('utf-8')
                filename = "diagram.diagramsnet.png"
                content_type = "image/png"

                # Prepare metadata
                metadata = {
                    "original_svg_length": len(request.svg_content),
                    "png_size": len(png_bytes),
                    "conversion_format": request.format,
                    "dark_mode": request.is_dark_mode,
                    "embedded_xml": True
                }

            else:  # Default to XML format
                # Convert to XML only
                xml_content, quality = await diagramsnet_service.convert_svg_to_diagrams_xml(
                    request.svg_content
                )

                # Encode XML content as base64
                file_data = base64.b64encode(xml_content.encode('utf-8')).decode('utf-8')
                filename = "diagram.diagramsnet.xml"
                content_type = "application/xml"

                # Prepare metadata
                metadata = {
                    "original_svg_length": len(request.svg_content),
                    "xml_length": len(xml_content),
                    "conversion_format": request.format,
                    "dark_mode": request.is_dark_mode
                }

            logger.info(f"Conversion completed with quality score: {quality.score:.1f}%")

        except ValueError as e:
            logger.error(f"Conversion failed: {str(e)}")
            raise HTTPException(
                status_code=422,
                detail=f"Conversion failed: {str(e)}"
            )

        # Convert quality object to the proper model format
        quality_info = None
        if quality:
            from app.models import ConversionQualityInfo
            quality_info = ConversionQualityInfo(
                score=quality.score,
                message=quality.message,
                details=quality.details
            )

        # Create successful response
        response = DiagramsNetExportResponse(
            success=True,
            file_data=file_data,
            filename=filename,
            content_type=content_type,
            format=request.format,
            quality=quality_info,
            error_message=None,
            metadata=metadata,
            diagrams_version="21.7.5"
        )

        logger.info(f"Successfully exported diagrams.net {request.format.upper()}, quality: {quality.score:.1f}%")
        return response

    except HTTPException:
        # Re-raise HTTP exceptions
        raise

    except ValidationError as e:
        logger.error(f"Request validation failed: {str(e)}")
        raise HTTPException(
            status_code=422,
            detail=f"Request validation failed: {str(e)}"
        )

    except Exception as e:
        logger.error(f"Unexpected error in diagrams.net export: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error during conversion: {str(e)}"
        )


@router.get("/health")
async def diagramsnet_health_check():
    """Health check endpoint for diagrams.net conversion service."""
    try:
        # Test basic service functionality
        test_svg = '<svg width="100" height="100"><rect x="10" y="10" width="80" height="80" fill="blue"/></svg>'

        xml_content, quality = await diagramsnet_service.convert_svg_to_diagrams_xml(test_svg)

        return {
            "status": "healthy",
            "service": "diagramsnet-conversion",
            "test_conversion": "successful",
            "test_quality_score": quality.score
        }

    except Exception as e:
        logger.error(f"diagrams.net health check failed: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail=f"diagrams.net service unhealthy: {str(e)}"
        )


@router.get("/formats")
async def get_supported_formats():
    """
    Get list of supported export formats.

    Returns information about current and future supported formats.
    """
    return {
        "current_formats": [
            {
                "format": "xml",
                "description": "diagrams.net XML format",
                "file_extension": ".diagramsnet.xml",
                "content_type": "application/xml",
                "features": [
                    "Editable in diagrams.net",
                    "Preserves diagram structure",
                    "Retains SVG icons",
                    "Quality assessment"
                ]
            },
            {
                "format": "png",
                "description": "PNG with embedded XML metadata",
                "file_extension": ".diagramsnet.png",
                "content_type": "image/png",
                "features": [
                    "Visual preview",
                    "Editable in diagrams.net",
                    "Self-contained file",
                    "Quality assessment",
                    "Embedded XML metadata"
                ]
            }
        ],
        "service_info": {
            "version": "2.0.0",
            "quality_scoring": True,
            "svg_icon_preservation": True,
            "png_embedding": True
        }
    }