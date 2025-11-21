"""Draw.io export router with enhanced Mermaid to Draw.io conversion."""
import base64
import logging
import os
from fastapi import APIRouter, HTTPException
from pydantic import ValidationError

from app.models import DrawioXMLExportRequest, DrawioPNGExportRequest, DrawioExportResponse
from app.services.mermaid_drawio_service import mermaid_drawio_service
from app.services.drawio_quality_service import drawio_quality_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/drawio/xml", response_model=DrawioExportResponse)
async def export_drawio_xml(request: DrawioXMLExportRequest) -> DrawioExportResponse:
    """
    Convert Mermaid source and SVG to Draw.io XML format.

    This endpoint accepts both raw Mermaid source code and rendered SVG content
    to create high-quality Draw.io XML files with proper positioning, styling,
    and icon integration.

    Args:
        request: DrawioXMLExportRequest containing Mermaid source, SVG content, and options

    Returns:
        DrawioExportResponse with conversion results and quality assessment

    Raises:
        HTTPException: If conversion fails or invalid input provided
    """
    try:
        logger.info("Starting Draw.io XML export conversion")
        logger.info(f"Mermaid source length: {len(request.mermaid_source)} characters")
        logger.info(f"SVG content length: {len(request.svg_content)} characters")

        # Validate inputs
        if not request.mermaid_source.strip():
            raise HTTPException(
                status_code=400,
                detail="Mermaid source cannot be empty"
            )

        if not request.svg_content.strip():
            raise HTTPException(
                status_code=400,
                detail="SVG content cannot be empty"
            )

        if not request.svg_content.strip().startswith('<svg'):
            raise HTTPException(
                status_code=400,
                detail="Invalid SVG content - must start with <svg> tag"
            )

        # Get icon service URL (use provided or environment default)
        icon_service_url = request.icon_service_url or os.getenv('ICON_SERVICE_URL')

        # Perform conversion
        try:
            xml_content, metadata = await mermaid_drawio_service.convert_mermaid_to_drawio_xml(
                mermaid_source=request.mermaid_source,
                svg_content=request.svg_content,
                icon_service_url=icon_service_url,
                width=request.width,
                height=request.height,
                is_dark_mode=request.is_dark_mode
            )

            # Parse original nodes for quality assessment
            parsed_nodes, _ = await mermaid_drawio_service.parse_mermaid_source(request.mermaid_source)

            # Assess conversion quality with accurate data
            quality_info = await drawio_quality_service.assess_conversion_quality(
                original_nodes=parsed_nodes,
                converted_nodes=metadata.get('nodes_converted', metadata.get('original_nodes', 0)),
                original_edges=metadata.get('original_edges', 0),
                converted_edges=metadata.get('edges_converted', metadata.get('original_edges', 0)),
                icons_attempted=metadata.get('icons_attempted', 0),
                icons_successful=metadata.get('icons_successful', 0)
            )

            # Encode XML content as base64
            file_data = base64.b64encode(xml_content.encode('utf-8')).decode('utf-8')
            filename = "diagram.drawio"
            content_type = "application/xml"

            # Prepare enhanced metadata
            enhanced_metadata = {
                **metadata,
                "xml_length": len(xml_content),
                "conversion_format": "xml",
                "quality_score": quality_info.score
            }

            logger.info(f"Conversion completed with quality score: {quality_info.score:.1f}%")

        except ValueError as e:
            logger.error(f"Conversion failed: {str(e)}")
            raise HTTPException(
                status_code=422,
                detail=f"Conversion failed: {str(e)}"
            )

        # Create successful response
        response = DrawioExportResponse(
            success=True,
            file_data=file_data,
            filename=filename,
            content_type=content_type,
            format="xml",
            quality=quality_info.to_dict(),
            error_message=None,
            metadata=enhanced_metadata,
            drawio_version="24.7.5"
        )

        logger.info(f"Successfully exported Draw.io XML, quality: {quality_info.score:.1f}%")
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
        logger.error(f"Unexpected error in Draw.io XML export: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error during conversion: {str(e)}"
        )


@router.post("/drawio/png", response_model=DrawioExportResponse)
async def export_drawio_png(request: DrawioPNGExportRequest) -> DrawioExportResponse:
    """
    Convert Mermaid source and SVG to Draw.io editable PNG format.

    This endpoint creates PNG files with embedded Draw.io XML metadata,
    allowing the PNG to be opened and edited in Draw.io applications.

    Args:
        request: DrawioPNGExportRequest containing Mermaid source, SVG content, and options

    Returns:
        DrawioExportResponse with conversion results and quality assessment

    Raises:
        HTTPException: If conversion fails or invalid input provided
    """
    try:
        logger.info("Starting Draw.io PNG export conversion")
        logger.info(f"Mermaid source length: {len(request.mermaid_source)} characters")
        logger.info(f"SVG content length: {len(request.svg_content)} characters")

        # Validate inputs
        if not request.mermaid_source.strip():
            raise HTTPException(
                status_code=400,
                detail="Mermaid source cannot be empty"
            )

        if not request.svg_content.strip():
            raise HTTPException(
                status_code=400,
                detail="SVG content cannot be empty"
            )

        if not request.svg_content.strip().startswith('<svg'):
            raise HTTPException(
                status_code=400,
                detail="Invalid SVG content - must start with <svg> tag"
            )

        # Get icon service URL (use provided or environment default)
        icon_service_url = request.icon_service_url or os.getenv('ICON_SERVICE_URL')

        # Perform conversion
        try:
            png_bytes, metadata = await mermaid_drawio_service.convert_mermaid_to_drawio_png(
                mermaid_source=request.mermaid_source,
                svg_content=request.svg_content,
                icon_service_url=icon_service_url,
                width=request.width,
                height=request.height,
                transparent_background=request.transparent_background,
                is_dark_mode=request.is_dark_mode
            )

            # Parse original nodes for quality assessment
            parsed_nodes, _ = await mermaid_drawio_service.parse_mermaid_source(request.mermaid_source)

            # Assess conversion quality with accurate data
            quality_info = await drawio_quality_service.assess_conversion_quality(
                original_nodes=parsed_nodes,
                converted_nodes=metadata.get('nodes_converted', metadata.get('original_nodes', 0)),
                original_edges=metadata.get('original_edges', 0),
                converted_edges=metadata.get('edges_converted', metadata.get('original_edges', 0)),
                icons_attempted=metadata.get('icons_attempted', 0),
                icons_successful=metadata.get('icons_successful', 0)
            )

            # Encode PNG bytes as base64
            file_data = base64.b64encode(png_bytes).decode('utf-8')
            filename = "diagram.drawio.png"
            content_type = "image/png"

            # Prepare enhanced metadata
            enhanced_metadata = {
                **metadata,
                "conversion_format": "png",
                "quality_score": quality_info.score
            }

            logger.info(f"Conversion completed with quality score: {quality_info.score:.1f}%")

        except ValueError as e:
            logger.error(f"Conversion failed: {str(e)}")
            raise HTTPException(
                status_code=422,
                detail=f"Conversion failed: {str(e)}"
            )

        # Create successful response
        response = DrawioExportResponse(
            success=True,
            file_data=file_data,
            filename=filename,
            content_type=content_type,
            format="png",
            quality=quality_info.to_dict(),
            error_message=None,
            metadata=enhanced_metadata,
            drawio_version="24.7.5"
        )

        logger.info(f"Successfully exported Draw.io PNG, quality: {quality_info.score:.1f}%")
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
        logger.error(f"Unexpected error in Draw.io PNG export: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error during conversion: {str(e)}"
        )


@router.get("/drawio/health")
async def drawio_health_check():
    """Health check endpoint for Draw.io conversion service."""
    try:
        # Test basic service functionality with minimal Mermaid diagram
        test_mermaid = "graph TD\n    A --> B"
        test_svg = '<svg width="100" height="100"><rect x="10" y="10" width="80" height="80" fill="blue"/></svg>'

        xml_content, metadata = await mermaid_drawio_service.convert_mermaid_to_drawio_xml(
            test_mermaid, test_svg
        )

        # Parse original nodes for health check quality assessment
        parsed_nodes, _ = await mermaid_drawio_service.parse_mermaid_source(test_mermaid)

        quality_info = await drawio_quality_service.assess_conversion_quality(
            original_nodes=parsed_nodes,
            converted_nodes=metadata.get('nodes_converted', metadata.get('original_nodes', 0)),
            original_edges=metadata.get('original_edges', 0),
            converted_edges=metadata.get('edges_converted', metadata.get('original_edges', 0)),
            icons_attempted=metadata.get('icons_attempted', 0),
            icons_successful=metadata.get('icons_successful', 0)
        )

        return {
            "status": "healthy",
            "service": "drawio-conversion",
            "test_conversion": "successful",
            "test_quality_score": quality_info.score,
            "version": "24.7.5",
            "features": [
                "mermaid_source_parsing",
                "svg_position_extraction",
                "icon_service_integration",
                "quality_assessment",
                "xml_export",
                "png_with_metadata"
            ]
        }

    except Exception as e:
        logger.error(f"Draw.io health check failed: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail=f"Draw.io service unhealthy: {str(e)}"
        )


@router.get("/drawio/formats")
async def get_drawio_supported_formats():
    """
    Get list of supported Draw.io export formats.

    Returns information about current Draw.io export capabilities and features.
    """
    return {
        "current_formats": [
            {
                "format": "xml",
                "description": "Draw.io XML format",
                "file_extension": ".drawio",
                "content_type": "application/xml",
                "features": [
                    "Editable in Draw.io applications",
                    "Preserves diagram structure and relationships",
                    "Supports SVG icon embedding",
                    "Maintains positioning from rendered SVG",
                    "Quality assessment and scoring",
                    "Mermaid source parsing with icon references"
                ]
            },
            {
                "format": "png",
                "description": "PNG with embedded XML metadata",
                "file_extension": ".drawio.png",
                "content_type": "image/png",
                "features": [
                    "Visual preview with embedded editability",
                    "Self-contained editable file",
                    "Compatible with Draw.io applications",
                    "Preserves all XML diagram data",
                    "Quality assessment and scoring",
                    "Transparent background support",
                    "Configurable image dimensions"
                ]
            }
        ],
        "service_info": {
            "version": "3.0.0",
            "drawio_compatibility": "24.7.5",
            "conversion_method": "enhanced_mermaid_parser",
            "quality_scoring": True,
            "icon_service_integration": True,
            "svg_position_extraction": True,
            "png_metadata_embedding": True,
            "supported_mermaid_features": [
                "flowchart diagrams",
                "node definitions with icons",
                "edge relationships (solid, dashed)",
                "custom labels and styling",
                "icon service references"
            ]
        },
        "environment": {
            "icon_service_url": os.getenv('ICON_SERVICE_URL', 'not_configured'),
            "quality_threshold": float(os.getenv('DRAWIO_QUALITY_THRESHOLD', '60.0'))
        }
    }
