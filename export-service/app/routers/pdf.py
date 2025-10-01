"""PDF export router."""
import io
import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from playwright.async_api import async_playwright
from pydantic import BaseModel

from app.services.css_service import css_service

router = APIRouter()
logger = logging.getLogger(__name__)


class PDFExportRequest(BaseModel):
    """PDF export request model - matches backend interface."""
    html_content: str
    document_name: str
    is_dark_mode: bool = False


async def render_html_to_pdf(html: str, css: str) -> bytes:
    """Renders HTML (including complex SVG) to PDF via headless Chromium."""
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
            display_header_footer=False,
            scale=0.98,
        )
        await browser.close()
        return pdf


@router.post("/pdf")
async def export_pdf(request: PDFExportRequest) -> StreamingResponse:
    """Export HTML content as PDF."""
    try:
        logger.info(f"Generating PDF for document: {request.document_name}")
        logger.info(f"HTML content length: {len(request.html_content)} chars")
        logger.info(f"Dark mode: {request.is_dark_mode}")

        # Get CSS styles from CSS service
        css_styles = css_service.get_pdf_css(request.is_dark_mode)

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
            {request.html_content}
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