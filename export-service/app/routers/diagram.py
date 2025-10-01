"""Diagram export router."""
import base64
import logging
from fastapi import APIRouter, HTTPException
from playwright.async_api import async_playwright
from pydantic import BaseModel

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
    width: int = None  # Optional - will use SVG's natural width
    height: int = None  # Optional - will use SVG's natural height
    transparent_background: bool = True


@router.post("/svg")
async def export_diagram_svg(request: DiagramExportRequest) -> dict:
    """Export diagram as SVG using Chromium rendering."""
    try:
        logger.info("Exporting diagram as SVG")

        # Get CSS styles optimized for diagrams
        css_styles = css_service.get_diagram_css(request.is_dark_mode)

        # Create minimal HTML for diagram
        diagram_html = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Diagram Export</title>
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

            await page.set_content(f"<style>{css_styles}</style>{diagram_html}", wait_until="networkidle")

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

            return {"svg_content": svg_content}

    except Exception as e:
        logger.error(f"Failed to export diagram as SVG: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to export diagram: {str(e)}")


@router.post("/png")
async def export_diagram_png(request: PNGExportRequest) -> dict:
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

                    const bbox = svg.getBBox();
                    const viewBox = svg.getAttribute('viewBox');
                    let width, height;

                    if (viewBox) {
                        const [, , vw, vh] = viewBox.split(' ').map(Number);
                        width = vw;
                        height = vh;
                    } else {
                        width = svg.getAttribute('width') || bbox.width || 800;
                        height = svg.getAttribute('height') || bbox.height || 600;
                    }

                    // Parse width/height if they have units
                    width = parseFloat(width);
                    height = parseFloat(height);

                    return { width, height };
                }
            """)

            if not svg_info:
                raise HTTPException(status_code=400, detail="No SVG content found")

            # Use provided dimensions or SVG's natural dimensions
            width = request.width or svg_info['width']
            height = request.height or svg_info['height']

            await page.set_viewport_size({"width": int(width), "height": int(height)})

            # Take screenshot with transparent background
            png_bytes = await page.screenshot(
                type="png",
                full_page=False,
                omit_background=request.transparent_background,
                clip={
                    "x": 0,
                    "y": 0,
                    "width": int(width),
                    "height": int(height)
                }
            )

            await browser.close()

            # Return base64 encoded image
            image_data = base64.b64encode(png_bytes).decode('utf-8')
            return {
                "image_data": image_data,
                "width": int(width),
                "height": int(height)
            }

    except Exception as e:
        logger.error(f"Failed to convert SVG to PNG: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to convert SVG to PNG: {str(e)}")
