"""
GitHub Diagram Conversion Service

This service detects advanced Mermaid diagrams (architecture-beta, custom icons) and
converts them to GitHub-compatible format using static images with collapsible source code.
"""

import re
import hashlib
import base64
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import httpx

from app.configs.settings import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class DiagramConversion:
    """Represents a converted diagram with metadata"""
    original_code: str
    converted_markdown: str
    image_data: bytes
    image_format: str
    filename: str
    hash: str
    needs_upload: bool = True


@dataclass
class ConversionResult:
    """Results of document conversion process"""
    converted_content: str
    diagrams: List[DiagramConversion]
    has_changes: bool
    errors: List[str]


class GitHubDiagramConversionService:
    """
    Service for converting advanced Mermaid diagrams to GitHub-compatible format.

    Detects:
    - architecture-beta diagrams
    - Custom icon usage in diagrams
    - Complex Mermaid features not supported by GitHub

    Converts to:
    - Static images (SVG/PNG) uploaded to repository
    - Collapsible details sections with original source
    - GitHub-compatible markdown references
    """

    def __init__(self, export_service_url: str = "http://export-service:8001"):
        self.export_service_url = export_service_url
        self.client = httpx.AsyncClient(timeout=30.0)

        # Patterns for detecting advanced diagrams
        self.advanced_patterns = [
            r'architecture-beta',  # Architecture beta diagrams
            r'icon\s*:\s*["\']\w+:',  # Custom icon syntax: icon: "aws:"
            r'%{[^}]+}',  # Custom directives
            r'classDef\s+\w+\s+.*icon:',  # Class definitions with icons
        ]

        # Compile regex patterns for performance
        self.compiled_patterns = [re.compile(pattern, re.IGNORECASE) for pattern in self.advanced_patterns]

    async def convert_document(
        self,
        content: str,
        settings: Dict[str, Any],
        repository_path: str = "/.markdown-manager/diagrams/",
        repository_owner: str = "",
        repository_name: str = "",
        branch: str = "main",
        rendered_diagrams: Optional[List[Dict[str, str]]] = None
    ) -> ConversionResult:
        """
        Convert a document's advanced diagrams to GitHub-compatible format.

        Args:
            content: Original markdown content
            settings: User's GitHub settings (from github_settings table)
            repository_path: Path in repository for storing diagram images
            repository_owner: GitHub repository owner (username/organization)
            repository_name: GitHub repository name
            branch: Target branch for the images
            rendered_diagrams: Pre-rendered SVG content from frontend

        Returns:
            ConversionResult with converted content and metadata
        """
        logger.info("Starting document conversion for GitHub compatibility")
        logger.debug(f"Repository: {repository_owner}/{repository_name}, branch: {branch}")
        logger.debug(f"Rendered diagrams provided: {len(rendered_diagrams) if rendered_diagrams else 0}")

        # DEBUG: Log actual rendered diagrams content
        if rendered_diagrams:
            for i, diagram in enumerate(rendered_diagrams):
                logger.debug(f"Rendered diagram {i + 1}: hash={diagram.get('hash', 'no-hash')}, "
                             f"code_length={len(diagram.get('diagram_code', ''))}, "
                             f"svg_length={len(diagram.get('svg_content', ''))}")
        else:
            logger.warning("No rendered diagrams provided from frontend!")

        if not settings.get('auto_convert_diagrams', False):
            logger.info("Auto-convert diagrams disabled, returning original content")
            return ConversionResult(
                converted_content=content,
                diagrams=[],
                has_changes=False,
                errors=[]
            )

        diagrams = []
        errors = []
        converted_content = content

        try:
            # If rendered diagrams are provided, process them directly
            if rendered_diagrams:
                logger.info(f"Processing {len(rendered_diagrams)} pre-rendered diagrams from frontend")

                # Process each rendered diagram
                for rendered in rendered_diagrams:
                    try:
                        # Convert SVG to PNG
                        conversion = await self._convert_svg_to_png(
                            rendered['diagram_code'],
                            rendered['svg_content'],
                            repository_path,
                            repository_owner,
                            repository_name,
                            branch
                        )

                        if conversion:
                            diagrams.append(conversion)

                            # Replace mermaid block with image reference in content
                            converted_content = self._replace_mermaid_block_with_image(
                                converted_content,
                                rendered['diagram_code'],
                                conversion,
                                repository_path,
                                repository_owner,
                                repository_name,
                                branch
                            )
                        else:
                            logger.warning("Failed to convert provided SVG diagram")

                    except Exception as e:
                        error_msg = f"Error converting provided diagram: {str(e)}"
                        logger.error(error_msg)
                        errors.append(error_msg)
            else:
                # Legacy path: Find all Mermaid code blocks and process as advanced diagrams
                mermaid_blocks = self._extract_mermaid_blocks(content)
                logger.info(f"Found {len(mermaid_blocks)} Mermaid diagrams (no pre-rendered content provided)")

                # Process blocks in reverse order to avoid position conflicts
                for block_info in reversed(mermaid_blocks):
                    try:
                        if self._is_advanced_diagram(block_info['code']):
                            logger.info(f"Converting advanced diagram at position {block_info['start']}")

                            # No SVG content provided - log warning
                            logger.warning("No pre-rendered SVG content provided from frontend. "
                                           "Frontend should render diagrams and provide SVG content.")
                            logger.warning(f"Diagram code preview: {block_info['code'][:100]}...")
                        else:
                            logger.info(f"Skipping standard diagram at position {block_info['start']} "
                                        "(not advanced, GitHub can render natively)")
                    except Exception as e:
                        error_msg = f"Error processing diagram: {str(e)}"
                        logger.error(error_msg)
                        errors.append(error_msg)

        except Exception as e:
            error_msg = f"Error during document conversion: {str(e)}"
            logger.error(error_msg)
            errors.append(error_msg)

        has_changes = len(diagrams) > 0

        logger.info(f"Conversion complete: {len(diagrams)} diagrams converted, {len(errors)} errors")

        return ConversionResult(
            converted_content=converted_content,
            diagrams=diagrams,
            has_changes=has_changes,
            errors=errors
        )

    def _extract_mermaid_blocks(self, content: str) -> List[Dict[str, Any]]:
        """Extract all Mermaid code blocks from markdown content"""
        pattern = r'```mermaid\n(.*?)\n```'
        blocks = []

        for match in re.finditer(pattern, content, re.DOTALL):
            blocks.append({
                'code': match.group(1).strip(),
                'full_match': match.group(0),
                'start': match.start(),
                'end': match.end()
            })

        return blocks

    def _is_advanced_diagram(self, diagram_code: str) -> bool:
        """Check if diagram uses advanced features not supported by GitHub"""
        for pattern in self.compiled_patterns:
            if pattern.search(diagram_code):
                logger.debug(f"Advanced feature detected: {pattern.pattern}")
                return True
        return False

    async def _convert_svg_to_png(
        self,
        diagram_code: str,
        svg_content: str,
        repository_path: str,
        repository_owner: str = "",
        repository_name: str = "",
        branch: str = "main"
    ) -> Optional[DiagramConversion]:
        """Convert SVG content to PNG and return conversion info"""
        try:
            # Generate hash for consistent filename
            diagram_hash = hashlib.sha256(diagram_code.encode()).hexdigest()[:12]
            filename = f"diagram_{diagram_hash}.png"

            # Convert SVG to PNG using export service
            endpoint = f"{self.export_service_url}/diagram/png"
            payload = {
                "svg_content": svg_content,
                "transparent_background": True
            }
            logger.debug(f"Converting SVG to PNG using: {endpoint}")

            response = await self.client.post(endpoint, json=payload)
            if response.status_code != 200:
                logger.error(f"Export service error: {response.status_code} - {response.text}")
                return None

            result = response.json()
            image_data = base64.b64decode(result.get('image_data', ''))

            if not image_data:
                logger.error("No image data received from export service")
                return None

            return DiagramConversion(
                filename=filename,
                image_data=image_data,
                image_format='png',
                hash=diagram_hash,
                needs_upload=True,
                original_code=diagram_code,
                converted_markdown=""  # Will be set when replacing
            )

        except Exception as e:
            logger.error(f"Failed to convert SVG to PNG: {str(e)}")
            return None

    def _replace_mermaid_block_with_image(
        self,
        content: str,
        diagram_code: str,
        conversion: DiagramConversion,
        repository_path: str,
        repository_owner: str = "",
        repository_name: str = "",
        branch: str = "main"
    ) -> str:
        """Replace mermaid block with image reference"""
        # Create the mermaid block pattern to find
        mermaid_block = f"```mermaid\n{diagram_code}\n```"

        # Create GitHub markdown with image
        github_markdown = self._create_github_markdown(
            diagram_code,
            conversion.filename,
            repository_path,
            repository_owner,
            repository_name,
            branch
        )

        # Replace the first occurrence
        if mermaid_block in content:
            content = content.replace(mermaid_block, github_markdown, 1)
            logger.debug(f"Replaced mermaid block with image reference: {conversion.filename}")
        else:
            logger.warning(f"Could not find mermaid block to replace for diagram {conversion.hash}")

        return content

    async def _convert_diagram_to_image(
        self,
        diagram_code: str,
        format: str,
        repository_path: str,
        repository_owner: str = "",
        repository_name: str = "",
        branch: str = "main",
        svg_content: Optional[str] = None
    ) -> Optional[DiagramConversion]:
        """Convert a single diagram to image format"""
        try:
            # Generate hash for consistent filename
            diagram_hash = hashlib.sha256(diagram_code.encode()).hexdigest()[:12]
            filename = f"diagram_{diagram_hash}.{format}"

            if svg_content:
                # Use provided SVG content (from frontend)
                endpoint = f"{self.export_service_url}/diagram/png"
                payload = {
                    "svg_content": svg_content,
                    "transparent_background": True
                }
                logger.debug(f"Converting SVG to PNG using: {endpoint}")
            else:
                # TEMPORARY: Log warning but don't convert (frontend should provide SVG)
                logger.warning(f"No SVG content provided for diagram hash {diagram_hash}. "
                               "Frontend should provide rendered SVG content.")
                logger.warning(f"Diagram code preview: {diagram_code[:100]}...")
                return None

            logger.debug(f"Export service endpoint: {endpoint}")

            response = await self.client.post(endpoint, json=payload)
            if response.status_code != 200:
                logger.error(f"Export service error: {response.status_code} - {response.text}")
                return None

            result = response.json()

            if format == 'svg':
                image_data = result.get('svg_content', '').encode('utf-8')
            else:  # png
                image_data = base64.b64decode(result.get('image_data', ''))

            if not image_data:
                logger.error("No image data received from export service")
                return None

            # Create GitHub-compatible markdown
            converted_markdown = self._create_github_markdown(
                diagram_code,
                filename,
                repository_path,
                repository_owner,
                repository_name,
                branch
            )

            return DiagramConversion(
                original_code=diagram_code,
                converted_markdown=converted_markdown,
                image_data=image_data,
                image_format=format,
                filename=filename,
                hash=diagram_hash
            )

        except Exception as e:
            logger.error(f"Error converting diagram to image: {str(e)}")
            return None

    def _create_github_markdown(
        self,
        diagram_code: str,
        filename: str,
        repository_path: str,
        repository_owner: str = "",
        repository_name: str = "",
        branch: str = "main"
    ) -> str:
        """Create GitHub-compatible markdown with collapsible source"""
        # Debug logging
        logger.debug(f"Generating GitHub link with owner={repository_owner}, name={repository_name}, branch={branch}")
        logger.debug(f"Repository path: {repository_path}")
        logger.debug(f"Filename: {filename}")

        # Use full GitHub URL for reliable image display
        if repository_owner and repository_name:
            base_url = f"https://github.com/{repository_owner}/{repository_name}/raw/{branch}"
            image_path = f"{base_url}/{repository_path.rstrip('/')}/{filename}"
            logger.debug(f"Generated full GitHub URL: {image_path}")
        else:
            # Fallback to relative path
            image_path = f"{repository_path.rstrip('/')}/{filename}"
            logger.debug(f"Generated relative path: {image_path}")

        markdown_result = f"""![Diagram]({image_path})

<details>
<summary>📊 View diagram source (click to expand)</summary>

```mermaid
{diagram_code}
```
</details>"""

        logger.debug(f"Generated markdown result length: {len(markdown_result)}")
        return markdown_result

    def _replace_diagram_in_content(
        self,
        content: str,
        block_info: Dict[str, Any],
        conversion: DiagramConversion,
        repository_path: str
    ) -> str:
        """Replace original diagram block with converted markdown"""
        before = content[:block_info['start']]
        after = content[block_info['end']:]

        return before + conversion.converted_markdown + after

    async def cleanup(self):
        """Cleanup resources"""
        await self.client.aclose()


# Factory function for dependency injection
async def get_diagram_conversion_service() -> GitHubDiagramConversionService:
    """Factory function for creating diagram conversion service"""
    return GitHubDiagramConversionService(export_service_url=settings.export_service_url)
