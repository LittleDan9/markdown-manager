"""Export Service - Main Application."""
import io
import logging
import base64
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from playwright.async_api import async_playwright
from pydantic import BaseModel

from app.services.css_service import css_service

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PDFExportRequest(BaseModel):
    """PDF export request model - matches backend interface."""

    html_content: str
    document_name: str
    is_dark_mode: bool = False


class DiagramExportRequest(BaseModel):
    """Diagram export request model."""
    html_content: str
    format: str = "svg"  # svg or png
    width: int = 1200
    height: int = 800
    is_dark_mode: bool = False


async def render_html_to_pdf(html: str, css: str) -> bytes:
    """Renders HTML (including complex SVG) to PDF via headless Chromium.

    This function mirrors the backend implementation exactly.
    """
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page()
        await page.set_content(f"<style>{css}</style>{html}", wait_until="networkidle")

        # Enhanced PDF options for better page break control
        pdf: bytes = await page.pdf(
            format="Letter",
            print_background=True,
            prefer_css_page_size=True,  # Respect CSS @page rules
            margin={
                "top": "0.5in",
                "right": "0.5in",
                "bottom": "0.5in",
                "left": "0.5in",
            },
            # Enable page ranges if needed in future
            display_header_footer=False,
            # Scale content slightly to avoid edge cutting
            scale=0.98,
        )
        await browser.close()
        return pdf


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle."""
    # Startup
    logger.info("Initializing Export service...")
    await css_service.initialize()
    logger.info("Export service initialized successfully")
    yield
    # Shutdown
    logger.info("Export service shutting down")


app = FastAPI(
    title="Export Service",
    description="Service for generating PDFs and exporting diagrams from HTML content using Playwright",
    version="2.0.0",
    lifespan=lifespan,
)


@app.post("/generate-pdf")
async def export_pdf(request: PDFExportRequest) -> StreamingResponse:
    """Export HTML content as PDF.

    This endpoint mirrors the backend /api/v1/pdf/export functionality
    but is standalone and doesn't require authentication.
    """
    try:
        logger.info(f"Generating PDF for document: {request.document_name}")
        logger.info(f"HTML content length: {len(request.html_content)} chars")
        logger.info(f"Dark mode: {request.is_dark_mode}")

        # Get CSS styles from CSS service
        css_styles = css_service.get_pdf_css(request.is_dark_mode)

        # Use original content without processing for now to avoid corruption
        processed_content = request.html_content

        # Create HTML document with proper structure
        full_html = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>{request.document_name}</title>
        </head>
        <body>
            {processed_content}
        </body>
        </html>
        """

        try:
            pdf_bytes = await render_html_to_pdf(full_html, css_styles)
            logger.info(f"PDF generated successfully, size: {len(pdf_bytes)} bytes")
        except Exception as e:
            logger.error(f"Error generating PDF: {e}")
            raise HTTPException(status_code=500, detail="Failed to generate PDF")

        buf = io.BytesIO(pdf_bytes)
        buf.seek(0)

        # Prepare filename
        filename = request.document_name
        if not filename.endswith(".pdf"):
            filename += ".pdf"

        # Return PDF as streaming response
        return StreamingResponse(
            buf,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    except Exception as e:
        logger.error(f"Failed to generate PDF: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")


@app.post("/export-diagram-svg")
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


@app.post("/export-diagram-png")
async def export_diagram_png(request: DiagramExportRequest) -> dict:
    """Export diagram as PNG using Chromium rendering."""
    try:
        logger.info(f"Exporting diagram as PNG ({request.width}x{request.height})")

        css_styles = css_service.get_diagram_css(request.is_dark_mode)

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

            await page.set_viewport_size({"width": request.width, "height": request.height})
            await page.set_content(f"<style>{css_styles}</style>{diagram_html}", wait_until="networkidle")

            # Take screenshot of the diagram area
            png_bytes = await page.screenshot(
                type="png",
                full_page=False,
                clip={
                    "x": 0,
                    "y": 0,
                    "width": request.width,
                    "height": request.height
                }
            )

            await browser.close()

            # Return base64 encoded image
            image_data = base64.b64encode(png_bytes).decode('utf-8')
            return {"image_data": image_data}

    except Exception as e:
        logger.error(f"Failed to export diagram as PNG: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to export diagram: {str(e)}")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "export-service", "version": "2.0.0"}


@app.get("/")
async def root():
    """Root endpoint with service info."""
    return {
        "service": "Export Service",
        "version": "2.0.0",
        "description": "Service for generating PDFs and exporting diagrams using Playwright",
        "endpoints": {
            "generate_pdf": "/generate-pdf",
            "export_diagram_svg": "/export-diagram-svg",
            "export_diagram_png": "/export-diagram-png",
            "health": "/health"
        },
    }
