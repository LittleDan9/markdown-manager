"""
Icon Administration Module

Admin operations for icon management:
- Icon pack installation, updates, and deletion
- Individual icon uploads and metadata updates
- Cache management and performance tuning
- Usage statistics and monitoring
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, Dict, Any, List
import re
import xml.etree.ElementTree as ET
import logging

from ...database import get_db
from ...services.icon_service import IconService
from ...services.icons.svg import IconSVGService
from ...services.standardized_icon_installer import StandardizedIconPackInstaller
from ...schemas.icon_schemas import (
    IconPackResponse,
    IconPackInstallRequest,
    IconPackDeleteResponse,
    IconPackMetadataUpdate,
    IconMetadataUpdate
)
from ...core.auth import get_admin_user
from ...models.user import User

router = APIRouter(tags=["Icon Administration"])


def _inline_svg_styles(svg_content: str) -> str:
    """Convert CSS styles in <style> tags to inline style attributes."""
    try:
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
            class_pattern = rf'class="{re.escape(class_name)}"'
            style_replacement = f'style="{style_props}"'
            result = re.sub(class_pattern, style_replacement, result)

        # Remove the <style> tag
        result = re.sub(style_pattern, '', result, flags=re.DOTALL | re.IGNORECASE)
        return result
    except Exception:
        return svg_content


def _parse_svg_with_xml(svg_content: str) -> dict:
    """Parse SVG using XML ElementTree for robust handling."""
    root = ET.fromstring(svg_content)

    # Default values
    width = 24
    height = 24
    viewBox = "0 0 24 24"

    # Extract viewBox
    if 'viewBox' in root.attrib:
        viewBox = root.attrib['viewBox']
        try:
            vb_parts = viewBox.split()
            if len(vb_parts) == 4:
                vb_width = float(vb_parts[2])
                vb_height = float(vb_parts[3])
                width = int(vb_width) if vb_width.is_integer() else vb_width
                height = int(vb_height) if vb_height.is_integer() else vb_height
        except (ValueError, IndexError):
            pass

    # Extract explicit dimensions (take precedence over viewBox)
    for attr, var_name in [('width', 'width'), ('height', 'height')]:
        if attr in root.attrib:
            try:
                val = root.attrib[attr]
                num_match = re.search(r'([0-9.]+)', val)
                if num_match:
                    parsed_val = float(num_match.group(1))
                    if var_name == 'width':
                        width = int(parsed_val) if parsed_val.is_integer() else parsed_val
                    else:
                        height = int(parsed_val) if parsed_val.is_integer() else parsed_val
            except (ValueError, AttributeError):
                pass

    # Extract body content (serialize all child elements)
    body_parts = [ET.tostring(child, encoding='unicode', method='xml') for child in root]
    body = ''.join(body_parts).strip()

    return {"body": body, "width": width, "height": height, "viewBox": viewBox}


def _parse_svg_with_regex(svg_content: str) -> dict:
    """Fallback regex-based SVG parsing for malformed XML."""
    width = 24
    height = 24
    viewBox = "0 0 24 24"

    # Find SVG opening tag (multi-line support)
    svg_start_pattern = r'<svg[^>]*?(?:>|\s*>)'
    svg_start_match = re.search(svg_start_pattern, svg_content, re.DOTALL | re.IGNORECASE)

    if svg_start_match:
        svg_tag = svg_start_match.group(0)

        # Extract viewBox
        viewbox_match = re.search(r'viewBox=["\']([^"\']+)["\']', svg_tag)
        if viewbox_match:
            viewBox = viewbox_match.group(1)
            try:
                vb_parts = viewBox.split()
                if len(vb_parts) == 4:
                    vb_width = float(vb_parts[2])
                    vb_height = float(vb_parts[3])
                    width = int(vb_width) if vb_width.is_integer() else vb_width
                    height = int(vb_height) if vb_height.is_integer() else vb_height
            except (ValueError, IndexError):
                pass

        # Extract explicit dimensions
        for pattern, var_name in [(r'width=["\']([0-9.]+)["\']', 'width'),
                                  (r'height=["\']([0-9.]+)["\']', 'height')]:
            match = re.search(pattern, svg_tag)
            if match:
                try:
                    parsed_val = float(match.group(1))
                    val = int(parsed_val) if parsed_val.is_integer() else parsed_val
                    if var_name == 'width':
                        width = val
                    else:
                        height = val
                except ValueError:
                    pass

    # Extract body content
    content_pattern = r'<svg[^>]*?>\s*(.*?)\s*</svg\s*>'
    content_match = re.search(content_pattern, svg_content, re.DOTALL | re.IGNORECASE)
    if content_match:
        body = content_match.group(1).strip()
    else:
        # Last resort: remove XML/SVG tags
        body = re.sub(r'<\?xml[^>]*\?>|<!--.*?-->|</?svg[^>]*>', '', svg_content, flags=re.DOTALL).strip()

    return {"body": body, "width": width, "height": height, "viewBox": viewBox}


async def _process_svg_content(svg_text: str) -> Dict[str, Any]:
    """
    Process SVG content to extract metadata using improved XML parsing.

    Uses proper XML parsing to handle complex SVGs with multi-line tags,
    namespaces, and metadata sections like the firewall icon.
    """
    try:
        # First, inline any CSS styles to prevent them from being stripped
        svg_content = _inline_svg_styles(svg_text)

        try:
            # Try XML parsing first for robust handling
            result = _parse_svg_with_xml(svg_content)
        except ET.ParseError:
            # Fallback to regex-based extraction for malformed XML
            logging.getLogger(__name__).warning("XML parsing failed, falling back to regex extraction")
            result = _parse_svg_with_regex(svg_content)

        # Clean the body content to remove namespaces for better browser compatibility
        cleaned_body = IconSVGService.clean_body_for_mermaid(result["body"])

        return {
            "body": cleaned_body,
            "width": result["width"],
            "height": result["height"],
            "viewBox": result["viewBox"]
        }
    except Exception as e:
        logging.getLogger(__name__).error(f"SVG processing failed: {e}")
        # Return minimal fallback
        return {
            "body": svg_text,
            "width": 24,
            "height": 24,
            "viewBox": "0 0 24 24"
        }


async def get_icon_service(db: AsyncSession = Depends(get_db)) -> IconService:
    """Dependency to get IconService instance."""
    return IconService(db)


async def get_standardized_installer(db: AsyncSession = Depends(get_db)) -> StandardizedIconPackInstaller:
    """Dependency to get StandardizedIconPackInstaller instance."""
    return StandardizedIconPackInstaller(db)


# ============================================================================
# PACK MANAGEMENT
# ============================================================================

@router.post(
    "/packs",
    response_model=IconPackResponse,
    summary="Install new icon pack",
    description="Install a new icon pack in standardized Iconify format"
)
async def install_icon_pack(
    pack_request: IconPackInstallRequest,
    current_user: User = Depends(get_admin_user),
    installer: StandardizedIconPackInstaller = Depends(get_standardized_installer)
):
    """Install a new icon pack in standardized Iconify format."""
    try:
        result = await installer.install_pack(pack_request.pack_data)

        # Add reference URLs
        result.urls = {
            "self": f"/icons/packs/{result.name}",
            "icons": f"/icons/packs/{result.name}",
            "admin": f"/admin/icons/packs/{result.name}"
        }

        return result
    except ValueError as e:
        if "already exists" in str(e):
            raise HTTPException(status_code=409, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to install icon pack: {str(e)}"
        )


@router.put(
    "/packs/{pack_name}",
    response_model=IconPackResponse,
    summary="Update icon pack",
    description="Update an existing icon pack with new data in standardized Iconify format"
)
async def update_icon_pack(
    pack_name: str,
    pack_request: IconPackInstallRequest,
    current_user: User = Depends(get_admin_user),
    installer: StandardizedIconPackInstaller = Depends(get_standardized_installer)
):
    """Update an existing icon pack with new data in standardized Iconify format."""
    try:
        result = await installer.update_pack(pack_name, pack_request.pack_data)

        # Add reference URLs
        result.urls = {
            "self": f"/icons/packs/{result.name}",
            "icons": f"/icons/packs/{result.name}",
            "admin": f"/admin/icons/packs/{result.name}"
        }

        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update icon pack: {str(e)}"
        )


@router.patch(
    "/packs/{pack_name}",
    response_model=IconPackResponse,
    summary="Update pack metadata",
    description="Update metadata (name, display_name, category, description) without affecting icons"
)
async def update_icon_pack_metadata(
    pack_name: str,
    metadata: IconPackMetadataUpdate,
    current_user: User = Depends(get_admin_user),
    installer: StandardizedIconPackInstaller = Depends(get_standardized_installer)
):
    """Update only the metadata of an existing icon pack without touching icons."""
    try:
        metadata_dict = {k: v for k, v in metadata.model_dump().items() if v is not None}
        result = await installer.update_pack_metadata(pack_name, metadata_dict)

        # Add reference URLs
        result.urls = {
            "self": f"/icons/packs/{result.name}",
            "icons": f"/icons/packs/{result.name}",
            "admin": f"/admin/icons/packs/{result.name}"
        }

        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update icon pack metadata: {str(e)}"
        )


@router.delete(
    "/packs/{pack_name}",
    response_model=IconPackDeleteResponse,
    summary="Delete icon pack",
    description="Permanently delete an icon pack and all its associated icons"
)
async def delete_icon_pack(
    pack_name: str,
    current_user: User = Depends(get_admin_user),
    icon_service: IconService = Depends(get_icon_service)
):
    """Permanently delete an icon pack and all its associated icons."""
    try:
        success = await icon_service.delete_icon_pack(pack_name)
        if not success:
            raise HTTPException(
                status_code=404,
                detail=f"Icon pack '{pack_name}' not found"
            )
        return IconPackDeleteResponse(
            success=True,
            message=f"Icon pack '{pack_name}' deleted successfully"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete icon pack: {str(e)}"
        )


# ============================================================================
# ICON UPLOAD
# ============================================================================

@router.post(
    "/upload/icon",
    response_model=IconPackResponse,
    summary="Upload single icon",
    description="Upload a single SVG icon to an existing pack or create a new pack"
)
async def upload_single_icon(
    svg_file: UploadFile = File(..., description="SVG file to upload"),
    icon_name: str = Form(..., description="Icon name (lowercase, hyphens allowed)"),
    pack_name: str = Form(..., description="Pack name to add icon to"),
    category: str = Form(default="other", description="Pack category"),
    description: Optional[str] = Form(default=None, description="Pack description"),
    search_terms: Optional[str] = Form(default=None, description="Comma-separated search terms"),
    current_user: User = Depends(get_admin_user),
    icon_service: IconService = Depends(get_icon_service),
    installer: StandardizedIconPackInstaller = Depends(get_standardized_installer)
):
    """Upload a single icon to a pack."""
    logger = logging.getLogger(__name__)

    try:
        # Validate all input parameters
        if not svg_file.filename or not svg_file.filename.endswith('.svg'):
            raise HTTPException(status_code=400, detail="File must be an SVG")

        if not re.match(r'^[a-z0-9]+(?:-[a-z0-9]+)*$', icon_name):
            raise HTTPException(
                status_code=400,
                detail="Icon name must be lowercase with hyphens only (e.g., 'aws-lambda')"
            )

        if not re.match(r'^[a-z0-9]+(?:-[a-z0-9]+)*$', pack_name):
            raise HTTPException(
                status_code=400,
                detail="Pack name must be lowercase with hyphens only (e.g., 'aws-icons')"
            )

        # Read and validate SVG content
        svg_content = await svg_file.read()
        svg_text = svg_content.decode('utf-8')

        # More robust SVG validation - check if it contains an SVG element
        if '<svg' not in svg_text.lower():
            raise HTTPException(status_code=400, detail="Invalid SVG file")

        # Process SVG content to extract metadata and determine storage method
        parsed_svg_data = await _process_svg_content(svg_text)

        # Create or update the pack with the new icon
        result = await icon_service.add_icon_to_pack(
            pack_name=pack_name,
            key=icon_name,
            search_terms=search_terms or "",
            icon_data=parsed_svg_data,
            file_path=None
        )

        if not result:
            # Try to create a new pack if it doesn't exist
            from ...schemas.icon_schemas import StandardizedIconPackRequest, IconifyIconData

            # Use the properly parsed SVG data with body content
            try:
                icon_data = IconifyIconData(
                    body=parsed_svg_data.get("body", ""),
                    width=parsed_svg_data.get("width", 24),
                    height=parsed_svg_data.get("height", 24),
                    viewBox=parsed_svg_data.get("viewBox", "0 0 24 24")
                )
            except Exception:
                # Ultimate fallback
                icon_data = IconifyIconData(
                    body="<!-- Complex SVG -->",
                    width=24,
                    height=24,
                    viewBox="0 0 24 24"
                )

            # Create the pack request
            standardized_pack_data = StandardizedIconPackRequest(
                info={
                    "name": pack_name,
                    "displayName": pack_name.replace('-', ' ').title(),  # camelCase for schema
                    "category": category,
                    "description": description or f"Custom pack for {pack_name} icons"
                },
                icons={
                    icon_name: icon_data
                },
                width=24,
                height=24
            )

            pack_request = IconPackInstallRequest(pack_data=standardized_pack_data)
            return await install_icon_pack(pack_request, current_user, installer)

        # Convert icon result to pack response (for consistency)
        packs = await icon_service.get_icon_packs()
        pack = next((p for p in packs if p.name == pack_name), None)
        if pack:
            return pack

        raise HTTPException(status_code=500, detail="Failed to retrieve pack after upload")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading icon: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload icon: {str(e)}"
        )


# ============================================================================
# INDIVIDUAL ICON MANAGEMENT
# ============================================================================

@router.patch(
    "/{icon_id}",
    summary="Update icon metadata",
    description="Update metadata for a specific icon"
)
async def update_icon_metadata(
    icon_id: int,
    metadata: IconMetadataUpdate,
    current_user: User = Depends(get_admin_user),
    icon_service: IconService = Depends(get_icon_service)
):
    """Update metadata for a specific icon."""
    try:
        metadata_dict = {k: v for k, v in metadata.model_dump().items() if v is not None}
        icon = await icon_service.update_icon_metadata(icon_id, metadata_dict)
        if not icon:
            raise HTTPException(
                status_code=404,
                detail=f"Icon with ID {icon_id} not found"
            )

        # Add reference URLs
        if icon.pack:
            pack_name = icon.pack.name
            icon.urls = {
                "self": f"/icons/packs/{pack_name}/{icon.key}",
                "raw": f"/icons/packs/{pack_name}/{icon.key}/raw",
                "pack": f"/icons/packs/{pack_name}"
            }

        return icon
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update icon metadata: {str(e)}"
        )


@router.delete(
    "/{icon_id}",
    summary="Delete icon",
    description="Delete a specific icon"
)
async def delete_icon(
    icon_id: int,
    current_user: User = Depends(get_admin_user),
    icon_service: IconService = Depends(get_icon_service)
):
    """Delete a specific icon."""
    try:
        success = await icon_service.delete_icon(icon_id)
        if not success:
            raise HTTPException(
                status_code=404,
                detail=f"Icon with ID {icon_id} not found"
            )
        return {"success": True, "message": f"Icon {icon_id} deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete icon: {str(e)}"
        )


# ============================================================================
# CACHE MANAGEMENT
# ============================================================================

@router.get(
    "/cache/stats",
    summary="Get cache performance statistics",
    description="Retrieve detailed performance metrics about icon cache operations including hit ratios, "
                "memory usage, and TTL effectiveness"
)
async def get_cache_stats(
    current_user: User = Depends(get_admin_user),
    icon_service: IconService = Depends(get_icon_service)
):
    """Get comprehensive cache performance statistics."""
    try:
        cache_stats = icon_service.get_cache_stats()

        # Add additional performance metrics
        metadata_cache_stats = icon_service.cache.metadata_cache.get_stats()
        svg_cache_stats = icon_service.cache.svg_cache.get_stats()

        return {
            "success": True,
            "cache_performance": cache_stats,
            "metadata_cache": {
                "size": metadata_cache_stats["size"],
                "max_size": metadata_cache_stats["max_size"],
                "utilization_percent": round((metadata_cache_stats["size"] / metadata_cache_stats["max_size"]) * 100, 2),
                "total_accesses": metadata_cache_stats["total_accesses"],
                "average_accesses_per_entry": round(
                    metadata_cache_stats["total_accesses"] / max(metadata_cache_stats["size"], 1), 2
                )
            },
            "svg_cache": {
                "size": svg_cache_stats["size"],
                "max_size": svg_cache_stats["max_size"],
                "utilization_percent": round((svg_cache_stats["size"] / svg_cache_stats["max_size"]) * 100, 2),
                "total_accesses": svg_cache_stats["total_accesses"],
                "average_accesses_per_entry": round(
                    svg_cache_stats["total_accesses"] / max(svg_cache_stats["size"], 1), 2
                ),
                "ttl_seconds": icon_service.cache.svg_ttl_seconds
            },
            "performance_summary": {
                "total_entries": cache_stats["metadata"]["size"] + cache_stats["svg"]["size"],
                "estimated_memory_mb": cache_stats["memory_estimate_mb"],
                "overall_hit_ratio": round((cache_stats["metadata"]["hit_ratio"] + cache_stats["svg"]["hit_ratio"]) / 2, 4),
                "cache_efficiency": (
                    "good" if cache_stats["metadata"]["hit_ratio"] > 0.7 and cache_stats["svg"]["hit_ratio"] > 0.7
                    else "needs_optimization"
                )
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get cache stats: {str(e)}"
        )


@router.post(
    "/cache/warm",
    summary="Warm cache",
    description="Pre-load cache with popular icons from API usage and document analysis"
)
async def warm_cache(
    current_user: User = Depends(get_admin_user),
    icon_service: IconService = Depends(get_icon_service)
):
    """Pre-load the cache with popular icons including document analysis."""
    try:
        # Use enhanced warm cache with user document analysis
        result = await icon_service.warm_cache(user_id=current_user.id)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to warm cache: {str(e)}"
        )


@router.delete(
    "/cache/clear",
    summary="Clear cache",
    description="Clear all cached icon data to free memory or force fresh data loading"
)
async def clear_cache(
    current_user: User = Depends(get_admin_user),
    icon_service: IconService = Depends(get_icon_service)
):
    """Clear all cached icon data to free memory or force fresh data loading."""
    try:
        # Get stats before clearing for reporting
        before_stats = icon_service.get_cache_stats()

        # Clear the icon cache
        icon_service.clear_all_cache()

        # Get stats after clearing
        after_stats = icon_service.get_cache_stats()

        return {
            "success": True,
            "message": "Cache cleared successfully",
            "cleared": {
                "metadata_entries": before_stats["metadata"]["size"],
                "svg_entries": before_stats["svg"]["size"],
                "estimated_memory_freed_mb": before_stats["memory_estimate_mb"]
            },
            "current_stats": after_stats
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to clear cache: {str(e)}"
        )


@router.delete(
    "/cache/packs/{pack_name}",
    summary="Invalidate pack cache",
    description="Remove all cached entries for a specific icon pack"
)
async def invalidate_pack_cache(
    pack_name: str,
    current_user: User = Depends(get_admin_user),
    icon_service: IconService = Depends(get_icon_service)
):
    """Invalidate cache entries for a specific pack."""
    try:
        # Get stats before invalidation
        before_stats = icon_service.get_cache_stats()

        # Invalidate pack cache
        invalidated_count = icon_service.invalidate_pack_cache(pack_name)

        # Get stats after invalidation
        after_stats = icon_service.get_cache_stats()

        return {
            "success": True,
            "message": f"Cache invalidated for pack '{pack_name}'",
            "pack_name": pack_name,
            "invalidated_entries": invalidated_count,
            "memory_freed_mb": round(before_stats["memory_estimate_mb"] - after_stats["memory_estimate_mb"], 2),
            "current_cache_size": {
                "metadata": after_stats["metadata"]["size"],
                "svg": after_stats["svg"]["size"]
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to invalidate pack cache: {str(e)}"
        )


@router.get(
    "/cache/analysis",
    summary="Get cache performance analysis",
    description="Analyze cache performance patterns and provide optimization recommendations"
)
async def get_cache_analysis(
    current_user: User = Depends(get_admin_user),
    icon_service: IconService = Depends(get_icon_service)
):
    """Analyze cache performance and provide optimization insights."""
    try:
        cache_stats = icon_service.get_cache_stats()
        metadata_stats = icon_service.cache.metadata_cache.get_stats()
        svg_stats = icon_service.cache.svg_cache.get_stats()

        # Calculate performance insights
        metadata_hit_ratio = cache_stats["metadata"]["hit_ratio"]
        svg_hit_ratio = cache_stats["svg"]["hit_ratio"]

        # Generate recommendations
        recommendations = []

        if metadata_hit_ratio < 0.6:
            recommendations.append({
                "type": "metadata_cache",
                "issue": "Low metadata cache hit ratio",
                "current_ratio": round(metadata_hit_ratio, 3),
                "suggestion": "Consider increasing metadata cache size or reviewing access patterns"
            })

        if svg_hit_ratio < 0.6:
            recommendations.append({
                "type": "svg_cache",
                "issue": "Low SVG cache hit ratio",
                "current_ratio": round(svg_hit_ratio, 3),
                "suggestion": "Consider increasing SVG cache size or adjusting TTL settings"
            })

        # Check utilization
        metadata_util = (metadata_stats["size"] / metadata_stats["max_size"]) * 100
        svg_util = (svg_stats["size"] / svg_stats["max_size"]) * 100

        if metadata_util > 90:
            recommendations.append({
                "type": "metadata_capacity",
                "issue": "Metadata cache near capacity",
                "current_utilization": f"{metadata_util:.1f}%",
                "suggestion": "Consider increasing metadata cache max_size to reduce evictions"
            })

        if svg_util > 90:
            recommendations.append({
                "type": "svg_capacity",
                "issue": "SVG cache near capacity",
                "current_utilization": f"{svg_util:.1f}%",
                "suggestion": "Consider increasing SVG cache max_size or reducing TTL"
            })

        # Memory analysis
        memory_mb = cache_stats["memory_estimate_mb"]
        if memory_mb > 100:  # More than 100MB
            recommendations.append({
                "type": "memory_usage",
                "issue": "High cache memory usage",
                "current_memory_mb": memory_mb,
                "suggestion": "Monitor memory usage and consider reducing cache sizes if needed"
            })

        return {
            "success": True,
            "performance_analysis": {
                "overall_health": "good" if len(recommendations) == 0 else "needs_attention",
                "metadata_performance": {
                    "hit_ratio": round(metadata_hit_ratio, 3),
                    "utilization_percent": round(metadata_util, 1),
                    "average_accesses": round(metadata_stats["total_accesses"] / max(metadata_stats["size"], 1), 1)
                },
                "svg_performance": {
                    "hit_ratio": round(svg_hit_ratio, 3),
                    "utilization_percent": round(svg_util, 1),
                    "average_accesses": round(svg_stats["total_accesses"] / max(svg_stats["size"], 1), 1),
                    "ttl_effectiveness": "good" if svg_hit_ratio > 0.7 else "review_needed"
                },
                "memory_analysis": {
                    "total_memory_mb": memory_mb,
                    "memory_per_entry_kb": round((memory_mb * 1024) / max(metadata_stats["size"] + svg_stats["size"], 1), 1)
                }
            },
            "recommendations": recommendations,
            "optimization_tips": [
                "Monitor hit ratios regularly - target >70% for good performance",
                "Adjust cache sizes based on usage patterns and available memory",
                "Consider different TTL settings for different content types",
                "Clear cache during low-traffic periods for optimal performance"
            ]
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to analyze cache performance: {str(e)}"
        )


@router.get(
    "/cache/packs/{pack_name}",
    summary="Get pack cache details",
    description="Get detailed cache information for a specific icon pack"
)
async def get_pack_cache_details(
    pack_name: str,
    current_user: User = Depends(get_admin_user),
    icon_service: IconService = Depends(get_icon_service)
):
    """Get cache details for a specific pack."""
    try:
        pack_info = icon_service.get_pack_cache_info(pack_name)
        return {
            "success": True,
            "pack_cache_info": pack_info
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get pack cache details: {str(e)}"
        )


@router.post(
    "/cache/cleanup",
    summary="Cleanup expired cache entries",
    description="Remove expired cache entries to free memory and improve performance"
)
async def cleanup_cache(
    current_user: User = Depends(get_admin_user),
    icon_service: IconService = Depends(get_icon_service)
):
    """Clean up expired cache entries."""
    try:
        # Get expired entries info before cleanup
        expired_info = icon_service.get_expired_entries()

        # Perform cleanup
        removed_count = icon_service.cleanup_expired_entries()

        # Get updated cache stats
        updated_stats = icon_service.get_cache_stats()

        return {
            "success": True,
            "message": f"Cleaned up {removed_count} expired entries",
            "cleanup_details": {
                "expired_entries_found": expired_info["expired_count"],
                "entries_removed": removed_count,
                "memory_freed_estimate_mb": round(removed_count * 2048 / (1024 * 1024), 3)
            },
            "updated_cache_stats": {
                "svg_cache_size": updated_stats["svg"]["size"],
                "estimated_memory_mb": updated_stats["memory_estimate_mb"]
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to cleanup cache: {str(e)}"
        )


# ============================================================================
# STATISTICS
# ============================================================================

@router.get(
    "/statistics",
    summary="Get comprehensive statistics",
    description="Retrieve detailed statistics about icon packs, usage patterns, document analysis, and system metrics"
)
async def get_icon_statistics(
    current_user: User = Depends(get_admin_user),
    icon_service: IconService = Depends(get_icon_service)
):
    """Get comprehensive icon usage statistics with document analysis."""
    try:
        # Use enhanced statistics service with document analysis
        return await icon_service.get_pack_statistics(user_id=current_user.id)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get icon statistics: {str(e)}"
        )


@router.get(
    "/statistics/popular",
    summary="Get popular icons",
    description="Get a list of the most frequently accessed icons from API usage and document analysis"
)
async def get_popular_icons(
    limit: int = 50,
    current_user: User = Depends(get_admin_user),
    icon_service: IconService = Depends(get_icon_service)
):
    """Get most popular icons by access count and document usage."""
    try:
        # Get comprehensive statistics which includes popular icons
        stats = await icon_service.get_pack_statistics(user_id=current_user.id)

        popular_icons = stats.get('top_icons', [])
        doc_popular = stats.get('document_usage', {}).get('most_used_in_documents', [])

        return {
            "api_popular_icons": popular_icons[:limit],
            "document_popular_icons": doc_popular[:limit],
            "total_api_accesses": sum(icon.get('access_count', 0) for icon in popular_icons),
            "document_usage_summary": stats.get('document_usage', {})
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get popular icons: {str(e)}"
        )


@router.get(
    "/statistics/packs",
    summary="Get pack statistics",
    description="Get usage statistics broken down by icon pack"
)
async def get_pack_statistics(
    current_user: User = Depends(get_admin_user),
    icon_service: IconService = Depends(get_icon_service)
):
    """Get statistics for each icon pack."""
    try:
        packs = await icon_service.get_icon_packs()
        pack_stats = [
            {
                "name": pack.name,
                "display_name": pack.display_name,
                "category": pack.category,
                "icon_count": pack.icon_count,
                "created_at": pack.created_at.isoformat() if pack.created_at else None,
                "updated_at": pack.updated_at.isoformat() if pack.updated_at else None,
            }
            for pack in packs
        ]
        return {
            "pack_statistics": pack_stats,
            "total_packs": len(pack_stats)
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get pack statistics: {str(e)}"
        )


@router.get(
    "/statistics/packs/{pack_name}/usage",
    summary="Get pack document usage details",
    description="Get detailed document usage statistics for a specific icon pack"
)
async def get_pack_document_usage(
    pack_name: str,
    current_user: User = Depends(get_admin_user),
    icon_service: IconService = Depends(get_icon_service)
):
    """Get detailed document usage for a specific pack."""
    try:
        return await icon_service.get_pack_document_usage(pack_name, current_user.id)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get pack usage: {str(e)}"
        )


@router.get(
    "/statistics/documents/{document_id}/analysis",
    summary="Analyze icon usage in a specific document",
    description="Get detailed analysis of icon usage within a specific document"
)
async def get_document_icon_analysis(
    document_id: int,
    current_user: User = Depends(get_admin_user),
    icon_service: IconService = Depends(get_icon_service)
):
    """Analyze icon usage in a specific document."""
    try:
        return await icon_service.get_document_icon_analysis(document_id, current_user.id)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to analyze document: {str(e)}"
        )


@router.get(
    "/statistics/trends",
    summary="Get usage trends over time",
    description="Get icon usage trends and patterns over a specified time period"
)
async def get_usage_trends(
    days: int = 30,
    current_user: User = Depends(get_admin_user),
    icon_service: IconService = Depends(get_icon_service)
):
    """Get icon usage trends over time."""
    try:
        return await icon_service.get_usage_trends(current_user.id, days)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get usage trends: {str(e)}"
        )


# ============================================================================
# PHASE 4: REAL-TIME DOCUMENT ANALYSIS ENDPOINTS
# ============================================================================

@router.get(
    "/analysis/documents/{document_id}/realtime",
    summary="Real-time document analysis",
    description="Perform comprehensive real-time analysis of a single document"
)
async def analyze_document_realtime(
    document_id: int,
    current_user: User = Depends(get_admin_user),
    icon_service: IconService = Depends(get_icon_service)
):
    """Perform real-time analysis of a single document."""
    try:
        return await icon_service.analyze_document_realtime(document_id, current_user.id)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to analyze document: {str(e)}"
        )


@router.get(
    "/analysis/trends/realtime",
    summary="Real-time usage trends",
    description="Get real-time usage trends with comprehensive analysis of document changes and icon usage patterns"
)
async def get_usage_trends_realtime(
    days: int = 30,
    current_user: User = Depends(get_admin_user),
    icon_service: IconService = Depends(get_icon_service)
):
    """Get real-time usage trends over a specified period."""
    try:
        return await icon_service.get_usage_trends_realtime(current_user.id, days)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get real-time trends: {str(e)}"
        )


@router.post(
    "/analysis/cache/warm",
    summary="Warm analysis cache",
    description="Pre-load analysis cache for frequently accessed documents to improve performance"
)
async def warm_analysis_cache(
    document_ids: Optional[List[int]] = None,
    current_user: User = Depends(get_admin_user),
    icon_service: IconService = Depends(get_icon_service)
):
    """Warm the analysis cache for frequently accessed documents."""
    try:
        return await icon_service.warm_analysis_cache(current_user.id, document_ids)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to warm analysis cache: {str(e)}"
        )


@router.delete(
    "/analysis/cache/clear",
    summary="Clear analysis cache",
    description="Clear the real-time analysis cache to free memory and force fresh analysis"
)
async def clear_analysis_cache(
    current_user: User = Depends(get_admin_user),
    icon_service: IconService = Depends(get_icon_service)
):
    """Clear the real-time analysis cache."""
    try:
        cleared_count = await icon_service.clear_analysis_cache()
        return {
            "success": True,
            "message": f"Cleared {cleared_count} cached analysis entries",
            "cleared_entries": cleared_count
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to clear analysis cache: {str(e)}"
        )
