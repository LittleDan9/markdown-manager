"""Icon pack installer service with flexible data mapping."""
import os
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
            description=pack_info.get("description"),
            icon_count=0
        )

        self.db.add(icon_pack)
        await self.db.flush()  # Get the ID

        # Extract and install icons
        icons_data = self._extract_icons_data(pack_data, mapping_config, package_type)
        icon_count = await self._install_icons(icon_pack.id, icons_data, pack_info["name"])

        # Update icon count
        icon_pack.icon_count = icon_count
        await self.db.commit()

        return IconPackResponse.model_validate(icon_pack)

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
        icon_count = await self._install_icons(existing_pack.id, icons_data, pack_name)

        # Update icon count
        existing_pack.icon_count = icon_count
        await self.db.commit()

        return IconPackResponse.model_validate(existing_pack)

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

        if package_type == "json":
            return self._extract_json_icons(pack_data, mapping_config)
        elif package_type == "svg_files":
            return self._extract_svg_file_icons(pack_data, mapping_config)
        elif package_type == "mixed":
            return self._extract_mixed_icons(pack_data, mapping_config)
        else:
            raise ValueError(f"Unsupported package type: {package_type}")

    def _extract_json_icons(self, pack_data: Dict[str, Any], mapping_config: Dict[str, str]) -> List[Dict[str, Any]]:
        """Extract icons from JSON-based packages (like Iconify)."""
        icons_path = mapping_config.get("icons_data", "icons")
        icons_data = self._get_nested_value(pack_data, icons_path)

        if not icons_data:
            return []

        icons = []
        for key, icon_data in icons_data.items():
            icon_info = {
                "key": key,
                "search_terms": self._generate_search_terms(key, mapping_config.get("search_terms")),
                "icon_data": icon_data,
                "file_path": None
            }

            # Extract additional metadata if specified
            if "width" in mapping_config:
                icon_info["width"] = self._get_nested_value(icon_data, mapping_config["width"])
            if "height" in mapping_config:
                icon_info["height"] = self._get_nested_value(icon_data, mapping_config["height"])
            if "svg" in mapping_config:
                icon_info["svg"] = self._get_nested_value(icon_data, mapping_config["svg"])

            icons.append(icon_info)

        return icons

    def _extract_svg_file_icons(self, pack_data: Dict[str, Any], mapping_config: Dict[str, str]) -> List[Dict[str, Any]]:
        """Extract icons from SVG file-based packages (like AWS icons)."""
        files_path = mapping_config.get("files_path", "files")
        base_path = mapping_config.get("base_path", "")

        files_list = self._get_nested_value(pack_data, files_path) or []

        icons = []
        for file_info in files_list:
            if isinstance(file_info, str):
                file_path = file_info
                key = Path(file_path).stem
            else:
                file_path = self._get_nested_value(file_info, mapping_config.get("file_path", "path"))
                key = self._get_nested_value(file_info, mapping_config.get("key", "name"))
                if not key:
                    key = Path(file_path).stem

            if file_path and file_path.endswith('.svg'):
                full_path = os.path.join(base_path, file_path) if base_path else file_path

                icon_info = {
                    "key": key,
                    "search_terms": self._generate_search_terms(key, mapping_config.get("search_terms")),
                    "icon_data": {},
                    "file_path": full_path
                }

                # Try to load SVG content if file exists
                if os.path.exists(full_path):
                    try:
                        with open(full_path, 'r', encoding='utf-8') as f:
                            svg_content = f.read()
                            icon_info["icon_data"]["svg"] = svg_content
                    except Exception:
                        pass  # File will be loaded on demand

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
        icon_count = 0

        for icon_info in icons_data:
            full_key = f"{pack_name}:{icon_info['key']}"

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
