"""PDF export endpoints."""
import io

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from weasyprint import CSS, HTML

from app.services.css_service import css_service

router = APIRouter()


class PDFExportRequest(BaseModel):
    """PDF export request model."""

    html_content: str
    document_name: str
    is_dark_mode: bool = False


@router.post("/export")
async def export_pdf(request: PDFExportRequest) -> StreamingResponse:
    print(request.html_content)
    """Export HTML content as PDF."""
    try:
        # Get CSS styles from CSS service
        css_styles = css_service.get_pdf_css(request.is_dark_mode)

        # Create HTML document with proper structure
        html_document = f"""
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

        # Generate PDF using WeasyPrint
        html_obj = HTML(string=html_document)
        css_obj = CSS(string=css_styles)

        # Create PDF in memory
        pdf_buffer = io.BytesIO()
        html_obj.write_pdf(pdf_buffer, stylesheets=[css_obj])
        pdf_buffer.seek(0)

        # Prepare filename
        filename = request.document_name
        if not filename.endswith(".pdf"):
            filename += ".pdf"

        # Return PDF as streaming response
        return StreamingResponse(
            io.BytesIO(pdf_buffer.read()),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")
