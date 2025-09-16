"""Icon pack installer service with flexible data mapping."""
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.icon_models import IconMetadata, IconPack
from app.schemas.icon_schemas import IconPackResponse


class IconPackInstaller:
    """Service for installing and updating icon packs with flexible data mapping."""

    def __init__(self, db_session: AsyncSession):
        """Initialize the installer with database session."""
        self.db = db_session

    async def install_pack(
        self,
        pack_data: Dict[str, Any],
        mapping_config: Dict[str, str],
        package_type: str = "json"
    ) -> IconPackResponse:
        """Install a new icon pack with flexible data mapping.

        Args:
            pack_data: Raw data from the icon package
            mapping_config: Mapping configuration for extracting data
            package_type: Type of package ("json", "svg_files", "mixed")

        Returns:
            IconPackResponse: The created icon pack
        """
        # Extract pack metadata using mapping config
        pack_info = self._extract_pack_info(pack_data, mapping_config)

        # Check if pack already exists
        existing_pack = await self._get_existing_pack(pack_info["name"])
        if existing_pack:
            raise ValueError(f"Icon pack '{pack_info['name']}' already exists")

        # Create the icon pack
        icon_pack = IconPack(
            name=pack_info["name"],
            display_name=pack_info["display_name"],
            category=pack_info["category"],
            description=pack_info.get("description")
        )

        self.db.add(icon_pack)
        await self.db.flush()  # Get the ID

        # Extract and install icons
        icons_data = self._extract_icons_data(pack_data, mapping_config, package_type)
        await self._install_icons(icon_pack.id, icons_data, pack_info["name"])

        # Note: icon_count is now computed automatically via hybrid_property
        await self.db.commit()

        # Query the pack fresh from database to get proper response with relationships
        fresh_pack = await self._get_existing_pack(pack_info["name"])
        return IconPackResponse.model_validate(fresh_pack)

    async def update_pack(
        self,
        pack_name: str,
        pack_data: Dict[str, Any],
        mapping_config: Dict[str, str],
        package_type: str = "json"
    ) -> IconPackResponse:
        """Update an existing icon pack."""
        # Get existing pack
        existing_pack = await self._get_existing_pack(pack_name)
        if not existing_pack:
            raise ValueError(f"Icon pack '{pack_name}' not found")

        # Extract pack metadata
        pack_info = self._extract_pack_info(pack_data, mapping_config)

        # Update pack metadata
        existing_pack.display_name = pack_info["display_name"]
        existing_pack.category = pack_info["category"]
        existing_pack.description = pack_info.get("description")

        # Delete existing icons
        delete_query = select(IconMetadata).where(IconMetadata.pack_id == existing_pack.id)
        result = await self.db.execute(delete_query)
        icons_to_delete = result.scalars().all()

        for icon in icons_to_delete:
            await self.db.delete(icon)

        await self.db.flush()  # Ensure deletions are committed before inserting new ones

        # Extract and install new icons
        icons_data = self._extract_icons_data(pack_data, mapping_config, package_type)
        await self._install_icons(existing_pack.id, icons_data, pack_name)

        # Note: icon_count is now computed automatically from relationship
        await self.db.commit()

        # Query the pack fresh from database to get proper response with relationships
        fresh_pack = await self._get_existing_pack(pack_name)
        return IconPackResponse.model_validate(fresh_pack)

    def _extract_pack_info(self, pack_data: Dict[str, Any], mapping_config: Dict[str, str]) -> Dict[str, Any]:
        """Extract pack information using mapping configuration.

        Mapping config example:
        {
            "name": "info.name",
            "display_name": "info.displayName",
            "category": "info.category",
            "description": "info.description"
        }
        """
        pack_info = {}

        for field, path in mapping_config.items():
            if path.startswith("static:"):
                # Static value
                pack_info[field] = path[7:]  # Remove "static:" prefix
            else:
                # Dot notation path
                value = self._get_nested_value(pack_data, path)
                if value is not None:
                    pack_info[field] = value

        # Validate required fields
        required_fields = ["name", "display_name", "category"]
        missing_fields = [field for field in required_fields if field not in pack_info]
        if missing_fields:
            raise ValueError(f"Missing required pack fields: {missing_fields}")

        return pack_info

    def _extract_icons_data(
        self,
        pack_data: Dict[str, Any],
        mapping_config: Dict[str, str],
        package_type: str
    ) -> List[Dict[str, Any]]:
        """Extract icons data based on package type and mapping config."""
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"Extracting icons data with package_type='{package_type}'")
        logger.info(f"Mapping config: {mapping_config}")

        if package_type == "json":
            result = self._extract_json_icons(pack_data, mapping_config)
        elif package_type == "svg_files":
            result = self._extract_svg_file_icons(pack_data, mapping_config)
        elif package_type == "mixed":
            result = self._extract_mixed_icons(pack_data, mapping_config)
        else:
            raise ValueError(f"Unsupported package type: {package_type}")
            
        logger.info(f"Extracted {len(result)} icons")
        return result

    def _extract_json_icons(self, pack_data: Dict[str, Any], mapping_config: Dict[str, str]) -> List[Dict[str, Any]]:
        """Extract icons from JSON-based packages (like Iconify)."""
        import logging
        logger = logging.getLogger(__name__)
        
        icons_path = mapping_config.get("icons_data", "icons")
        icons_data = self._get_nested_value(pack_data, icons_path)
        
        logger.info(f"Extracting JSON icons from path '{icons_path}'")
        logger.info(f"Icons data type: {type(icons_data)}")
        
        if icons_data:
            logger.info(f"Found {len(icons_data)} icons")
        else:
            logger.warning("No icons data found")
            return []

        icons = []
        
        # Handle both dictionary and list formats
        if isinstance(icons_data, dict):
            # Dictionary format: {icon_name: {body: "...", width: 24, height: 24}}
            for icon_key, icon_data in icons_data.items():
                logger.debug(f"Processing icon: {icon_key}")
                
                # Process Iconify-style data to create proper icon structure
                processed_icon_data = self._process_iconify_icon_data(icon_data, pack_data)
                
                icon_info = {
                    "key": icon_key,
                    "search_terms": self._generate_search_terms(icon_key, mapping_config.get("search_terms")),
                    "icon_data": processed_icon_data,
                    "file_path": None
                }

                # Extract additional metadata if specified (for non-Iconify formats)
                if "width" in mapping_config:
                    icon_info["width"] = self._get_nested_value(icon_data, mapping_config["width"])
                if "height" in mapping_config:
                    icon_info["height"] = self._get_nested_value(icon_data, mapping_config["height"])
                if "body" in mapping_config:
                    icon_info["body"] = self._get_nested_value(icon_data, mapping_config["body"])

                icons.append(icon_info)
        
        elif isinstance(icons_data, list):
            # List format: [{key: "name", ...}, ...]
            for icon_item in icons_data:
                if not isinstance(icon_item, dict):
                    logger.warning(f"Skipping non-dict icon item: {icon_item}")
                    continue
                    
                key = icon_item.get("key")
                if not key:
                    logger.warning(f"Skipping icon without key: {icon_item}")
                    continue
                    
                icon_info = {
                    "key": key,
                    "search_terms": icon_item.get("search_terms", ""),
                    "icon_data": icon_item.get("icon_data", {}),
                    "file_path": None
                }

                icons.append(icon_info)
        
        else:
            logger.error(f"Unexpected icons_data type: {type(icons_data)}")
            return []

        logger.info(f"Successfully extracted {len(icons)} icons")
        return icons

    def _extract_svg_file_icons(self, pack_data: Dict[str, Any], mapping_config: Dict[str, str]) -> List[Dict[str, Any]]:
        """Extract icons from SVG file-based packages (like AWS icons)."""
        import logging
        logger = logging.getLogger(__name__)
        
        files_path = mapping_config.get("files_path", "files")
        base_path = mapping_config.get("base_path", "")
        
        logger.info(f"Extracting SVG file icons with files_path='{files_path}', base_path='{base_path}'")
        logger.info(f"Pack data keys: {list(pack_data.keys())}")
        
        files_list = self._get_nested_value(pack_data, files_path) or []
        files_length = len(files_list) if hasattr(files_list, '__len__') else 'N/A'
        logger.info(f"Files list type: {type(files_list)}, length: {files_length}")

        icons = []
        for file_info in files_list:
            if isinstance(file_info, str):
                file_path = file_info
                key = Path(file_path).stem
            else:
                file_path = self._get_nested_value(file_info, mapping_config.get("file_path", "file_path"))
                key = self._get_nested_value(file_info, mapping_config.get("key", "key"))
                if not key:
                    key = Path(file_path).stem if file_path else "unknown"

            if file_path and file_path.endswith('.svg'):
                full_path = os.path.join(base_path, file_path) if base_path else file_path

                icon_info = {
                    "key": key,
                    "search_terms": self._generate_search_terms(key, mapping_config.get("search_terms")),
                    "icon_data": {},
                    "file_path": None  # We'll store content, not file paths
                }

                # Read and store SVG content directly
                if os.path.exists(full_path):
                    try:
                        with open(full_path, 'r', encoding='utf-8') as f:
                            svg_content = f.read()
                            # Extract viewBox and dimensions from SVG
                            viewbox_match = re.search(r'viewBox\s*=\s*["\']([^"\']+)["\']', svg_content)
                            width_match = re.search(r'width\s*=\s*["\']([^"\']+)["\']', svg_content)
                            height_match = re.search(r'height\s*=\s*["\']([^"\']+)["\']', svg_content)
                            
                            # Store complete SVG and metadata
                            icon_info["icon_data"] = {
                                "svg": svg_content,
                                "viewBox": viewbox_match.group(1) if viewbox_match else "0 0 24 24",
                                "width": width_match.group(1) if width_match else "24",
                                "height": height_match.group(1) if height_match else "24"
                            }
                            logger.debug(f"Loaded SVG content for {key}: {len(svg_content)} chars")
                    except Exception as e:
                        logger.warning(f"Failed to read SVG file {full_path}: {e}")
                        continue  # Skip this icon if we can't read the file

                icons.append(icon_info)

        return icons

    def _extract_mixed_icons(self, pack_data: Dict[str, Any], mapping_config: Dict[str, str]) -> List[Dict[str, Any]]:
        """Extract icons from mixed packages (both JSON and files)."""
        icons = []

        # Extract JSON icons if present
        if "json_icons" in mapping_config:
            json_config = {k.replace("json_", ""): v for k, v in mapping_config.items() if k.startswith("json_")}
            icons.extend(self._extract_json_icons(pack_data, json_config))

        # Extract file icons if present
        if "files_path" in mapping_config:
            file_config = {k: v for k, v in mapping_config.items() if not k.startswith("json_")}
            icons.extend(self._extract_svg_file_icons(pack_data, file_config))

        return icons

    async def _install_icons(self, pack_id: int, icons_data: List[Dict[str, Any]], pack_name: str) -> int:
        """Install icons into the database."""
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"Installing icons for pack '{pack_name}' (pack_id={pack_id})")
        logger.info(f"Icons data length: {len(icons_data)}")
        
        if not icons_data:
            logger.warning("No icons data provided for installation")
            return 0
            
        # Log first few icons for debugging
        for i, icon_info in enumerate(icons_data[:3]):
            logger.info(f"Icon {i}: {icon_info}")
        
        icon_count = 0

        for icon_info in icons_data:
            if 'key' not in icon_info:
                logger.warning(f"Skipping icon without 'key': {icon_info}")
                continue
                
            full_key = f"{pack_name}:{icon_info['key']}"
            logger.debug(f"Creating icon: {full_key}")

            icon = IconMetadata(
                pack_id=pack_id,
                key=icon_info["key"],
                full_key=full_key,
                search_terms=icon_info["search_terms"],
                icon_data=icon_info.get("icon_data"),
                file_path=icon_info.get("file_path"),
                access_count=0
            )

            self.db.add(icon)
            icon_count += 1

        logger.info(f"Successfully created {icon_count} icons for pack '{pack_name}'")
        return icon_count

    async def _get_existing_pack(self, pack_name: str) -> Optional[IconPack]:
        """Get existing icon pack by name."""
        query = select(IconPack).where(IconPack.name == pack_name)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    def _get_nested_value(self, data: Dict[str, Any], path: str) -> Any:
        """Get value from nested dictionary using dot notation."""
        if not path:
            return None

        keys = path.split('.')
        current = data

        for key in keys:
            if isinstance(current, dict) and key in current:
                current = current[key]
            else:
                return None

        return current

    def _process_iconify_icon_data(self, icon_data: Dict[str, Any], pack_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process Iconify icon data to create proper icon structure with viewBox."""
        # Extract dimensions, with fallbacks to pack-level defaults
        left = int(icon_data.get("left", 0))
        top = int(icon_data.get("top", 0))
        width = int(icon_data.get("width", pack_data.get("width", 24)))
        height = int(icon_data.get("height", pack_data.get("height", 24)))
        
        # Construct viewBox from dimensions
        view_box = f"{left} {top} {width} {height}"
        
        # Create processed icon data with proper structure
        processed_data = {
            "body": icon_data.get("body", ""),
            "viewBox": view_box,
            "width": width,
            "height": height
        }
        
        # Preserve any additional fields that might be useful
        for key, value in icon_data.items():
            if key not in ["body", "left", "top", "width", "height"]:
                processed_data[key] = value
                
        return processed_data

    def _generate_search_terms(self, key: str, search_config: Optional[str] = None) -> str:
        """Generate search terms for an icon."""
        terms = [key]

        # Add variations of the key
        terms.extend(key.replace('-', ' ').replace('_', ' ').split())

        # Add custom search terms if specified
        if search_config:
            # search_config could be a static string or a pattern
            if search_config.startswith("static:"):
                terms.append(search_config[7:])
            else:
                # Could implement more complex search term generation here
                pass

        return ' '.join(set(terms)).lower()
