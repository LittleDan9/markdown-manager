"""PDF export endpoints."""
import io

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.models.user import User
from app.services.pdf_processor import PDFContentProcessor
from app.services.export_service_client import export_service_client
from app.services.pdf_image_processor import get_pdf_image_processor, PDFImageProcessor

router = APIRouter()


class PDFExportRequest(BaseModel):
    """PDF export request model."""

    html_content: str
    document_name: str
    is_dark_mode: bool = False


@router.post("/export")
async def export_pdf(
    request: PDFExportRequest,
    current_user: User = Depends(get_current_user),
    pdf_image_processor: PDFImageProcessor = Depends(get_pdf_image_processor),
) -> StreamingResponse:
    """Export HTML content as PDF using PDF service."""
    try:
        print(f"Exporting PDF for document: {request.document_name}")

        # Process images in HTML content for PDF embedding
        try:
            processed_content = await pdf_image_processor.process_html_for_pdf(
                request.html_content, current_user.id
            )
            print("Successfully processed images for PDF export")
        except Exception as e:
            print(f"Error processing images for PDF: {e}")
            # Continue with original content if image processing fails
            processed_content = request.html_content

        # Still get document statistics for monitoring
        try:
            doc_stats = PDFContentProcessor.get_document_stats(request.html_content)
            print(f"Document stats: {doc_stats}")
        except Exception as e:
            print(f"Error getting document stats: {e}")

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

        # Generate PDF via PDF service
        try:
            pdf_bytes = await export_service_client.generate_pdf(
                html_content=full_html,
                document_name=request.document_name,
                is_dark_mode=request.is_dark_mode,
            )
        except HTTPException:
            # Re-raise HTTPExceptions from PDF service
            raise
        except Exception as e:
            print(f"Error generating PDF: {e}")
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

    except HTTPException:
        # Re-raise HTTPExceptions
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")
