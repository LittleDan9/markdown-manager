"""Static file serving router for HTML and CSS files."""
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse, Response

router = APIRouter(prefix="/static", tags=["static"])

# Get the static directory path
STATIC_DIR = Path(__file__).parent.parent.parent / "static"


@router.get("/html/{file_path:path}", response_class=HTMLResponse)
async def serve_html_file(file_path: str):
    """Serve HTML files from the static/html directory."""
    # Ensure the file path is safe (no directory traversal)
    if ".." in file_path or file_path.startswith("/"):
        raise HTTPException(status_code=400, detail="Invalid file path")

    file_full_path = STATIC_DIR / "html" / file_path

    # Ensure the file exists and is within the html directory
    if not file_full_path.exists() or not str(file_full_path).startswith(str(STATIC_DIR / "html")):
        raise HTTPException(status_code=404, detail="File not found")

    # Ensure it's an HTML file
    if not file_full_path.suffix.lower() == ".html":
        raise HTTPException(status_code=400, detail="Only HTML files are served by this endpoint")

    return HTMLResponse(content=file_full_path.read_text(encoding="utf-8"), status_code=200)


@router.get("/css/{file_path:path}")
async def serve_css_file(file_path: str):
    """Serve CSS files from the static/css directory."""
    # Ensure the file path is safe (no directory traversal)
    if ".." in file_path or file_path.startswith("/"):
        raise HTTPException(status_code=400, detail="Invalid file path")

    file_full_path = STATIC_DIR / "css" / file_path

    # Ensure the file exists and is within the css directory
    if not file_full_path.exists() or not str(file_full_path).startswith(str(STATIC_DIR / "css")):
        raise HTTPException(status_code=404, detail="File not found")

    # Ensure it's a CSS file
    if not file_full_path.suffix.lower() == ".css":
        raise HTTPException(status_code=400, detail="Only CSS files are served by this endpoint")

    return Response(
        content=file_full_path.read_text(encoding="utf-8"),
        media_type="text/css",
        status_code=200
    )
