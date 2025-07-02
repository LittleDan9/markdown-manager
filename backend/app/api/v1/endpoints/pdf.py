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

        /* Inline code styling */
        code {
            padding: 2px 4px;
            font-size: 0.9em;
        }

        /* Code block container */
        .code-block {
            margin: 16px 0;
            border-radius: 6px;
            overflow: hidden;
        }

        /* Code block header styling */
        .code-block-header {
            padding: 8px 12px;
            font-size: 10pt;
            font-weight: 600;
            border-bottom-width: 1px;
            border-bottom-style: solid;
            display: flex;
            justify-content: space-between;
            align-items: center;
            min-height: 32px;
            box-sizing: border-box;
        }

        /* Hide copy button in PDF */
        .code-block-copy-btn {
            display: none !important;
        }

        /* Language label */
        .code-block-lang {
            font-family: inherit;
            font-size: 10pt;
            font-weight: 600;
            line-height: 16px;
            min-height: 16px;
            display: inline-block;
        }

        /* Ensure empty language labels maintain height */
        .code-block-lang:empty::before {
            content: "\00a0";
            visibility: hidden;
        }

        /* Pre blocks (code blocks) */
        pre {
            padding: 16px;
            margin: 0;
            overflow: visible;
            white-space: pre-wrap;
            word-wrap: break-word;
            page-break-inside: avoid;
            break-inside: avoid;
            border-radius: 0 0 6px 6px;
        }

        /* Code blocks inside .code-block containers */
        .code-block pre {
            border-radius: 0;
            margin: 0;
        }

        /* Remove inline code styling when inside pre blocks */
        pre code {
            padding: 0 !important;
            border: none !important;
            background: transparent !important;
            font-size: inherit !important;
            border-radius: 0 !important;
        }

        /* Prism.js syntax highlighting preservation */
        .token.comment,
        .token.prolog,
        .token.doctype,
        .token.cdata {
            color: #708090;
        }

        .token.punctuation {
            color: #999;
        }

        .token.property,
        .token.tag,
        .token.constant,
        .token.symbol,
        .token.deleted {
            color: #905;
        }

        .token.boolean,
        .token.number {
            color: #905;
        }

        .token.selector,
        .token.attr-name,
        .token.string,
        .token.char,
        .token.builtin,
        .token.inserted {
            color: #690;
        }

        .token.operator,
        .token.entity,
        .token.url,
        .language-css .token.string,
        .style .token.string,
        .token.variable {
            color: #9a6e3a;
        }

        .token.atrule,
        .token.attr-value,
        .token.function,
        .token.class-name {
            color: #DD4A68;
        }

        .token.keyword {
            color: #07a;
        }

        .token.regex,
        .token.important {
            color: #e90;
        }

        .token.important,
        .token.bold {
            font-weight: bold;
        }

        .token.italic {
            font-style: italic;
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

            /* Code block container for dark mode */
            .code-block {
                border: 1px solid #30363d !important;
            }

            /* Code block header for dark mode */
            .code-block-header {
                background: #0d1117 !important;
                color: #8b949e !important;
                border-bottom-color: #30363d !important;
            }

            .code-block-lang {
                color: #f0f6fc !important;
            }

            pre {
                background: #161b22 !important;
                color: #e6edf3 !important;
                border: none !important;
            }

            /* Inline code styling for dark mode */
            code {
                background: #161b22 !important;
                color: #e6edf3 !important;
                border: 1px solid #30363d !important;
            }

            /* Remove styling from code inside pre blocks */
            pre code {
                background: transparent !important;
                border: none !important;
                color: inherit !important;
            }

            /* Dark mode syntax highlighting */
            .token.comment,
            .token.prolog,
            .token.doctype,
            .token.cdata {
                color: #6e7681 !important;
            }

            .token.punctuation {
                color: #8b949e !important;
            }

            .token.property,
            .token.tag,
            .token.constant,
            .token.symbol,
            .token.deleted {
                color: #ff7b72 !important;
            }

            .token.boolean,
            .token.number {
                color: #79c0ff !important;
            }

            .token.selector,
            .token.attr-name,
            .token.string,
            .token.char,
            .token.builtin,
            .token.inserted {
                color: #a5d6ff !important;
            }

            .token.operator,
            .token.entity,
            .token.url,
            .language-css .token.string,
            .style .token.string,
            .token.variable {
                color: #ffa657 !important;
            }

            .token.atrule,
            .token.attr-value,
            .token.function,
            .token.class-name {
                color: #d2a8ff !important;
            }

            .token.keyword {
                color: #ff7b72 !important;
            }

            .token.regex,
            .token.important {
                color: #ffa657 !important;
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

            /* Code block container for light mode */
            .code-block {
                border: 1px solid #d0d7de !important;
            }

            /* Code block header for light mode */
            .code-block-header {
                background: #f6f8fa !important;
                color: #656d76 !important;
                border-bottom-color: #d0d7de !important;
            }

            .code-block-lang {
                color: #24292f !important;
            }

            pre {
                background: #f6f8fa !important;
                color: #24292f !important;
                border: none !important;
            }

            /* Inline code styling for light mode */
            code {
                background: #f6f8fa !important;
                color: #24292f !important;
                border: 1px solid #d0d7de !important;
            }

            /* Remove styling from code inside pre blocks */
            pre code {
                background: transparent !important;
                border: none !important;
                color: inherit !important;
            }

            /* Light mode syntax highlighting - keep default colors */
            .token.comment,
            .token.prolog,
            .token.doctype,
            .token.cdata {
                color: #708090 !important;
            }

            .token.property,
            .token.tag,
            .token.constant,
            .token.symbol,
            .token.deleted {
                color: #905 !important;
            }

            .token.boolean,
            .token.number {
                color: #905 !important;
            }

            .token.selector,
            .token.attr-name,
            .token.string,
            .token.char,
            .token.builtin,
            .token.inserted {
                color: #690 !important;
            }

            .token.keyword {
                color: #07a !important;
            }

            .token.function,
            .token.class-name {
                color: #DD4A68 !important;
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
