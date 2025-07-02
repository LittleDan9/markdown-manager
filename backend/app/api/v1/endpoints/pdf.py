"""PDF export endpoints."""
import io
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from weasyprint import HTML, CSS

router = APIRouter()


class PDFExportRequest(BaseModel):
    """PDF export request model."""
    html_content: str
    document_name: str
    is_dark_mode: bool = False


def generate_pdf_styles(is_dark_mode: bool = False) -> str:
    """Generate PDF-optimized CSS styles."""
    base_styles = """
        @page {
            margin: 0.5in;
            size: A4;
        }

        * {
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        html {
            font-size: 12pt;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            font-size: 12pt;
            line-height: 1.6;
            margin: 0;
            padding: 0;
            width: 100%;
            min-height: 100vh;
        }

        /* Main content container */
        body > * {
            max-width: 100%;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }

        /* Headers */
        h1, h2, h3, h4, h5, h6 {
            page-break-after: avoid;
            break-after: avoid;
            margin-top: 24px;
            margin-bottom: 16px;
            font-weight: 600;
            line-height: 1.3;
        }

        h1 { font-size: 2.2em; margin-top: 0; }
        h2 { font-size: 1.8em; }
        h3 { font-size: 1.4em; }
        h4 { font-size: 1.2em; }
        h5 { font-size: 1.1em; }
        h6 { font-size: 1em; }

        /* Paragraphs */
        p {
            margin-bottom: 16px;
            margin-top: 0;
        }

        /* Code blocks and inline code */
        pre, code {
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
            font-size: 11pt;
            border-radius: 4px;
        }

        code {
            padding: 2px 4px;
            font-size: 0.9em;
        }

        pre {
            padding: 16px;
            overflow: visible;
            white-space: pre-wrap;
            word-wrap: break-word;
            page-break-inside: avoid;
            break-inside: avoid;
            margin: 16px 0;
            border-radius: 6px;
        }

        /* Tables */
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 16px 0;
            page-break-inside: avoid;
            break-inside: avoid;
            font-size: 11pt;
        }

        th, td {
            padding: 10px 12px;
            text-align: left;
            border-width: 1px;
            border-style: solid;
            vertical-align: top;
        }

        th {
            font-weight: 600;
        }

        /* Lists */
        ul, ol {
            margin: 16px 0;
            padding-left: 24px;
        }

        li {
            margin: 6px 0;
        }

        /* Blockquotes */
        blockquote {
            padding: 12px 0 12px 20px;
            margin: 20px 0;
            border-left-width: 4px;
            border-left-style: solid;
            font-style: italic;
        }

        /* Links */
        a {
            text-decoration: underline;
        }

        /* Images */
        img {
            max-width: 100%;
            height: auto;
        }

        /* Horizontal rules */
        hr {
            border: none;
            height: 2px;
            margin: 24px 0;
        }

        /* Strong and emphasis */
        strong, b {
            font-weight: 700;
        }

        em, i {
            font-style: italic;
        }

        /* Fix spacing issues */
        * + h1, * + h2, * + h3, * + h4, * + h5, * + h6 {
            margin-top: 32px;
        }

        /* Ensure emojis render properly */
        .emoji {
            font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Android Emoji", "EmojiSymbols", sans-serif;
        }
    """

    if is_dark_mode:
        # Dark mode colors with full page background
        color_styles = """
            @page {
                background: #0d1117;
            }

            html {
                background: #0d1117 !important;
            }

            body {
                background: #0d1117 !important;
                color: #e6edf3 !important;
            }

            h1, h2, h3, h4, h5, h6 {
                color: #f0f6fc !important;
            }

            pre {
                background: #161b22 !important;
                color: #e6edf3 !important;
                border: 1px solid #30363d !important;
            }

            code {
                background: #161b22 !important;
                color: #e6edf3 !important;
                border: 1px solid #30363d !important;
            }

            th, td {
                border-color: #30363d !important;
            }

            th {
                background: #161b22 !important;
                color: #f0f6fc !important;
            }

            td {
                background: rgba(22, 27, 34, 0.3) !important;
            }

            blockquote {
                border-left-color: #30363d !important;
                color: #8b949e !important;
                background: rgba(22, 27, 34, 0.3) !important;
            }

            a {
                color: #58a6ff !important;
            }

            hr {
                background: #30363d !important;
            }
        """
    else:
        # Light mode colors
        color_styles = """
            @page {
                background: white;
            }

            html {
                background: white !important;
            }

            body {
                background: white !important;
                color: #24292f !important;
            }

            h1, h2, h3, h4, h5, h6 {
                color: #1f2328 !important;
            }

            pre {
                background: #f6f8fa !important;
                color: #24292f !important;
                border: 1px solid #d0d7de !important;
            }

            code {
                background: #f6f8fa !important;
                color: #24292f !important;
                border: 1px solid #d0d7de !important;
            }

            th, td {
                border-color: #d0d7de !important;
            }

            th {
                background: #f6f8fa !important;
                color: #1f2328 !important;
            }

            td {
                background: white !important;
            }

            blockquote {
                border-left-color: #d0d7de !important;
                color: #656d76 !important;
                background: #f8f9fa !important;
            }

            a {
                color: #0969da !important;
            }

            hr {
                background: #d0d7de !important;
            }
        """

    return base_styles + color_styles


@router.post("/export")
async def export_pdf(request: PDFExportRequest) -> StreamingResponse:
    """Export HTML content as PDF."""
    try:
        # Generate CSS styles based on theme
        css_styles = generate_pdf_styles(request.is_dark_mode)

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
        if not filename.endswith('.pdf'):
            filename += '.pdf'

        # Return PDF as streaming response
        return StreamingResponse(
            io.BytesIO(pdf_buffer.read()),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=\"{filename}\""}
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate PDF: {str(e)}"
        )
