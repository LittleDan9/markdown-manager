"""Diagram export router."""
import base64
import logging
from fastapi import APIRouter, HTTPException
from playwright.async_api import async_playwright
from pydantic import BaseModel

from app.models import ConversionResponse
from app.services.css_service import css_service

router = APIRouter()
logger = logging.getLogger(__name__)


class DiagramExportRequest(BaseModel):
    """Diagram export request model."""
    html_content: str
    format: str = "svg"  # svg or png
    width: int = 1200
    height: int = 800
    is_dark_mode: bool = False


class PNGExportRequest(BaseModel):
    """PNG export request model for SVG conversion."""
    svg_content: str
    width: int | None = None  # Optional - will use SVG's natural width
    height: int | None = None  # Optional - will use SVG's natural height
    transparent_background: bool = True


@router.post("/svg")
async def export_diagram_svg(request: DiagramExportRequest) -> ConversionResponse:
    """Export diagram as SVG using Chromium rendering."""
    try:
        logger.info("Exporting diagram as SVG")

        # Get CSS styles optimized for diagrams
        css_styles = css_service.get_diagram_css(request.is_dark_mode)

        # Create minimal HTML for already-rendered diagram
        diagram_html = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Diagram Export</title>
            <style>{css_styles}</style>
        </head>
        <body>
            {request.html_content}
        </body>
        </html>
        """

        async with async_playwright() as pw:
            browser = await pw.chromium.launch()
            page = await browser.new_page()

            # Set viewport for consistent rendering
            await page.set_viewport_size({"width": request.width, "height": request.height})

            await page.set_content(diagram_html, wait_until="networkidle")

            # Find the SVG element and extract it
            svg_content = await page.evaluate("""
                () => {
                    const svg = document.querySelector('svg');
                    if (!svg) return null;

                    // Ensure proper SVG attributes
                    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                    svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

                    return svg.outerHTML;
                }
            """)

            await browser.close()

            if not svg_content:
                raise HTTPException(status_code=400, detail="No SVG content found in diagram")

            # Encode SVG as base64 for consistent response format
            svg_base64 = base64.b64encode(svg_content.encode('utf-8')).decode('utf-8')

            return ConversionResponse(
                success=True,
                file_data=svg_base64,
                filename="diagram.svg",
                content_type="image/svg+xml",
                format="svg",
                metadata={
                    "width": request.width,
                    "height": request.height,
                    "dark_mode": request.is_dark_mode,
                    "svg_length": len(svg_content)
                }
            )

    except Exception as e:
        logger.error(f"Failed to export diagram as SVG: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to export diagram: {str(e)}")


@router.post("/png")
async def export_diagram_png(request: PNGExportRequest) -> ConversionResponse:
    """Convert SVG to PNG with transparent background."""
    try:
        logger.info("Converting SVG to PNG with transparent background")

        # Create HTML wrapper for SVG
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{
                    margin: 0;
                    padding: 0;
                    background: transparent;
                }}
                svg {{
                    display: block;
                    margin: 0 auto;
                }}
            </style>
        </head>
        <body>
            {request.svg_content}
        </body>
        </html>
        """

        async with async_playwright() as pw:
            browser = await pw.chromium.launch()
            page = await browser.new_page()

            # Set transparent background
            await page.set_content(html_content, wait_until="networkidle")

            # Get SVG dimensions if not provided
            svg_info = await page.evaluate("""
                () => {
                    const svg = document.querySelector('svg');
                    if (!svg) return null;

                    // Try to get dimensions from viewBox first, then attributes, then computed
                    const viewBox = svg.getAttribute('viewBox');
                    let width, height;

                    if (viewBox) {
                        const [minX, minY, vbWidth, vbHeight] = viewBox.split(' ').map(Number);
                        width = vbWidth;
                        height = vbHeight;
                    } else {
                        // Try explicit width/height attributes
                        width = svg.getAttribute('width');
                        height = svg.getAttribute('height');

                        if (width) width = parseFloat(width);
                        if (height) height = parseFloat(height);

                        // Fallback to computed dimensions
                        if (!width || !height) {
                            const rect = svg.getBoundingClientRect();
                            width = width || rect.width || 800;
                            height = height || rect.height || 600;
                        }
                    }

                    return {
                        width: Math.max(width, 100),  // Minimum reasonable size
                        height: Math.max(height, 100)
                    };
                }
            """)

            if not svg_info:
                raise HTTPException(status_code=400, detail="No SVG content found")

            # Use provided dimensions or SVG's natural dimensions
            width = request.width or svg_info['width']
            height = request.height or svg_info['height']

            # Ensure reasonable minimum dimensions
            width = max(width, 100)
            height = max(height, 100)

            await page.set_viewport_size({"width": int(width), "height": int(height)})

            # Take screenshot with transparent background, capturing the full SVG
            png_bytes = await page.screenshot(
                type="png",
                full_page=True,  # Capture the full page to avoid clipping
                omit_background=request.transparent_background,
            )

            await browser.close()

            # Return base64 encoded image using ConversionResponse
            image_data = base64.b64encode(png_bytes).decode('utf-8')

            return ConversionResponse(
                success=True,
                file_data=image_data,
                filename="diagram.png",
                content_type="image/png",
                format="png",
                metadata={
                    "width": int(width),
                    "height": int(height),
                    "transparent_background": request.transparent_background,
                    "svg_source_length": len(request.svg_content)
                }
            )

    except Exception as e:
        logger.error(f"Failed to convert SVG to PNG: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to convert SVG to PNG: {str(e)}")
