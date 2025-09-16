"""
Single Icon Upload Router - Handles individual icon uploads to existing or new packs
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
import re
import xml.etree.ElementTree as ET
from typing import Optional

from ...database import get_db
from ...services.standardized_icon_installer import StandardizedIconPackInstaller
from ...services.icon_service import IconService
from ...schemas.icon_schemas import IconMetadataResponse
from ...schemas.icon_schemas import IconPackResponse, StandardizedIconPackRequest
from ...core.auth import get_admin_user
from ...models.user import User

router = APIRouter(prefix="/upload", tags=["Icon Upload"])


async def get_icon_service(db: AsyncSession = Depends(get_db)) -> IconService:
    """Dependency to get IconService instance."""
    return IconService(db)


async def get_standardized_installer(db: AsyncSession = Depends(get_db)) -> StandardizedIconPackInstaller:
    """Dependency to get StandardizedIconPackInstaller instance."""
    return StandardizedIconPackInstaller(db)



def inline_svg_styles(svg_content: str) -> str:
    """
    Convert CSS styles in <style> tags to inline style attributes.
    This prevents styles from being stripped by browsers/sanitizers.
    """
    try:
        # Simple regex-based approach for the common case: .classname { fill: #color }
        import re
        
        # Extract style rules
        style_pattern = r'<style[^>]*>(.*?)</style>'
        style_match = re.search(style_pattern, svg_content, re.DOTALL | re.IGNORECASE)
        
        if not style_match:
            return svg_content
            
        style_content = style_match.group(1)
        
        # Parse simple CSS rules like .s0 { fill: #16325b }
        class_styles = {}
        rule_pattern = r'\.([^{]+)\s*\{\s*([^}]+)\s*\}'
        
        for match in re.finditer(rule_pattern, style_content):
            class_name = match.group(1).strip()
            style_props = match.group(2).strip()
            class_styles[class_name] = style_props
        
        # Apply styles to elements with matching classes
        result = svg_content
        for class_name, style_props in class_styles.items():
            # Replace class="classname" with style="properties"
            class_pattern = rf'class="{re.escape(class_name)}"'
            style_replacement = f'style="{style_props}"'
            result = re.sub(class_pattern, style_replacement, result)
        
        # Remove the <style> tag
        result = re.sub(style_pattern, '', result, flags=re.DOTALL | re.IGNORECASE)
        
        return result
        
    except Exception as e:
        print(f"Style inlining failed: {e}")
        return svg_content
def extract_svg_content(svg_content: str) -> dict:
    """
    Extract body content, dimensions, and viewBox from SVG content.
    Also converts CSS styles to inline attributes for better compatibility.
    
    Based on generate_payload.py logic for consistency.

    Args:
        svg_content: Raw SVG file content

    Returns:
        dict: Parsed SVG data with body, width, height, viewBox
    """
    # First, inline any CSS styles to prevent them from being stripped
    svg_content = inline_svg_styles(svg_content)
    
    # Extract viewBox, width, and height from the SVG tag
    svg_tag_match = re.search(r'<svg[^>]*>', svg_content, re.IGNORECASE)

    width = 24  # Default
    height = 24  # Default
    viewBox = "0 0 24 24"  # Default

    if svg_tag_match:
        svg_tag = svg_tag_match.group(0)

        # Extract width
        width_match = re.search(r'width=["\'](\d+)["\']', svg_tag)
        if width_match:
            width = int(width_match.group(1))

        # Extract height
        height_match = re.search(r'height=["\'](\d+)["\']', svg_tag)
        if height_match:
            height = int(height_match.group(1))

        # Extract viewBox
        viewbox_match = re.search(r'viewBox=["\']([^"\']+)["\']', svg_tag)
        if viewbox_match:
            viewBox = viewbox_match.group(1)

    # Extract the content between <svg> and </svg>
    content_match = re.search(r'<svg[^>]*>(.*?)</svg>', svg_content, re.DOTALL | re.IGNORECASE)
    if content_match:
        body = content_match.group(1).strip()
    else:
        # Fallback: just remove svg tags
        body = re.sub(r'</?svg[^>]*>', '', svg_content).strip()

    return {
        "body": body,
        "width": width,
        "height": height,
        "viewBox": viewBox
    }


@router.post(
    "/icon",
    response_model=IconPackResponse,
    summary="Upload a single icon to a pack",
    description="""
    Upload a single SVG icon to an existing pack or create a new pack.
    
    **Process:**
    1. Validates SVG file format and size
    2. Parses SVG to extract metadata (viewBox, dimensions)
    3. Creates new pack if it doesn't exist
    4. Adds icon to the pack in Iconify format
    
    **File Requirements:**
    - Must be valid SVG format
    - Maximum size: 1MB
    - Should contain vector graphics (paths, shapes, etc.)
    """
)
async def upload_single_icon(
    svg_file: UploadFile = File(..., description="SVG file to upload"),
    icon_name: str = Form(..., description="Icon name (lowercase, hyphens allowed)"),
    pack_name: str = Form(..., description="Pack name to add icon to"),
    category: str = Form(default="other", description="Pack category"),
    description: Optional[str] = Form(default=None, description="Pack description"),
    current_user: User = Depends(get_admin_user),
    icon_service: IconService = Depends(get_icon_service),
    installer: StandardizedIconPackInstaller = Depends(get_standardized_installer)
):
    """Upload a single icon to a pack."""
    
    # Validate file type
    filename = svg_file.filename or ""
    if not svg_file.content_type == "image/svg+xml" and not filename.endswith('.svg'):
        raise HTTPException(
            status_code=400,
            detail="File must be an SVG image"
        )
    
    # Validate file size (1MB limit)
    if svg_file.size and svg_file.size > 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="SVG file must be smaller than 1MB"
        )
    
    # Validate icon name format
    if not re.match(r'^[a-z0-9-]+$', icon_name):
        raise HTTPException(
            status_code=400,
            detail="Icon name must contain only lowercase letters, numbers, and hyphens"
        )
    
    # Validate pack name format
    if not re.match(r'^[a-z0-9-]+$', pack_name):
        raise HTTPException(
            status_code=400,
            detail="Pack name must contain only lowercase letters, numbers, and hyphens"
        )
    
    try:
        # Read SVG content
        svg_content = await svg_file.read()
        svg_text = svg_content.decode('utf-8')
        
        # Parse SVG to extract metadata
        svg_data = extract_svg_content(svg_text)
        
        # Check if pack exists
        existing_packs = await icon_service.get_icon_packs()
        existing_pack = next((pack for pack in existing_packs if pack.name == pack_name), None)
        
        if existing_pack:
            # Add icon to existing pack using the simple add method
            try:
                icon_metadata = await icon_service.add_icon_to_pack(
                    pack_id=existing_pack.id,
                    icon_name=icon_name,
                    icon_data={
                        'body': svg_data['body'],
                        'width': svg_data['width'],
                        'height': svg_data['height'],
                        'viewBox': svg_data['viewBox']
                    }
                )
                
                # Return the updated pack info
                updated_packs = await icon_service.get_icon_packs()
                updated_pack = next((pack for pack in updated_packs if pack.id == existing_pack.id), None)
                return updated_pack
                
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))
        else:
            # Create new pack with this single icon
            pack_request_data = {
                'info': {
                    'name': pack_name,
                    'displayName': pack_name.replace('-', ' ').title(),
                    'category': category,
                    'description': description or f"{pack_name.replace('-', ' ').title()} icons",
                    'version': '1.0.0'
                },
                'icons': {
                    icon_name: {
                        'body': svg_data['body'],
                        'width': svg_data['width'],
                        'height': svg_data['height'],
                        'viewBox': svg_data['viewBox']
                    }
                }
            }
            
            # Create the standardized request object
            pack_request = StandardizedIconPackRequest(**pack_request_data)
            
            # Install the new pack
            result = await installer.install_pack(pack_request)
            
            return result
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload icon: {str(e)}"
        )
