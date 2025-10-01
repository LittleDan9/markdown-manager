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

logger = logging.getLogger(__name__)


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
    
    def __init__(self, export_service_url: str = "http://localhost:8001"):
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
        repository_path: str = "/.markdown-manager/diagrams/"
    ) -> ConversionResult:
        """
        Convert a document's advanced diagrams to GitHub-compatible format.
        
        Args:
            content: Original markdown content
            settings: User's GitHub settings (from github_settings table)
            repository_path: Path in repository for storing diagram images

        Returns:
            ConversionResult with converted content and metadata
        """
        logger.info("Starting document conversion for GitHub compatibility")
        
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
            # Find all Mermaid code blocks
            mermaid_blocks = self._extract_mermaid_blocks(content)
            logger.info(f"Found {len(mermaid_blocks)} Mermaid diagrams")
            
            for block_info in mermaid_blocks:
                try:
                    if self._is_advanced_diagram(block_info['code']):
                        logger.info(f"Converting advanced diagram at position {block_info['start']}")
                        
                        # Convert diagram to image
                        conversion = await self._convert_diagram_to_image(
                            block_info['code'],
                            settings.get('diagram_format', 'png'),
                            repository_path
                        )
                        
                        if conversion:
                            diagrams.append(conversion)
                            
                            # Replace in content
                            converted_content = self._replace_diagram_in_content(
                                converted_content,
                                block_info,
                                conversion,
                                repository_path
                            )
                        else:
                            logger.warning(f"Failed to convert diagram at position {block_info['start']}")

                except Exception as e:
                    error_msg = f"Error converting diagram: {str(e)}"
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
    
    async def _convert_diagram_to_image(
        self,
        diagram_code: str,
        format: str,
        repository_path: str
    ) -> Optional[DiagramConversion]:
        """Convert a single diagram to image format"""
        try:
            # Generate hash for consistent filename
            diagram_hash = hashlib.sha256(diagram_code.encode()).hexdigest()[:12]
            filename = f"diagram_{diagram_hash}.{format}"
            
            # Create HTML wrapper for the diagram
            html_content = self._create_diagram_html(diagram_code)
            
            # Call export service
            endpoint = f"{self.export_service_url}/diagram/{format}"
            payload = {
                "html_content": html_content,
                "width": 1200,
                "height": 800
            }

            logger.debug(f"Calling export service: {endpoint}")

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
                repository_path
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
    
    def _create_diagram_html(self, diagram_code: str) -> str:
        """Create HTML wrapper for diagram rendering"""
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <script type="module">
                import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
                mermaid.initialize({{ startOnLoad: true, theme: 'default' }});
            </script>
        </head>
        <body>
            <div class="mermaid">
{diagram_code}
            </div>
        </body>
        </html>
        """
    
    def _create_github_markdown(
        self,
        diagram_code: str,
        filename: str,
        repository_path: str
    ) -> str:
        """Create GitHub-compatible markdown with collapsible source"""
        image_path = f"{repository_path.rstrip('/')}/{filename}"

        return f"""![Diagram]({image_path})

<details>
<summary>📊 View diagram source (click to expand)</summary>

```mermaid
{diagram_code}
```
</details>"""
    
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
    return GitHubDiagramConversionService()
