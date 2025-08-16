"""CSS management service for PDF generation."""
import logging
from pathlib import Path
from typing import Dict

import aiofiles  # type: ignore
import httpx

logger = logging.getLogger(__name__)


class CSSService:
    """Service for managing CSS files for PDF generation."""

    def __init__(self) -> None:
        self.static_dir: Path = Path(__file__).parent.parent / "static" / "css"
        self.css_cache: Dict[str, str] = {}
        self.prism_themes_version: str = "1.9.0"  # Current stable version

    async def initialize(self) -> None:
        """Initialize the CSS service by loading and downloading CSS files."""
        await self._load_local_css()
        await self._download_prism_css()

    async def _load_local_css(self) -> None:
        """Load local CSS files into cache."""
        css_files: Dict[str, Path] = {
            "base": self.static_dir / "pdf-base.css",
            "pagebreaks": self.static_dir / "pdf-pagebreaks-minimal.css",
            "mermaid": self.static_dir / "pdf-mermaid.css",
            "light": self.static_dir / "pdf-light.css",
            "dark": self.static_dir / "pdf-dark.css",
            # "prism-dark": self.static_dir / "prism-pdf-dark.css",
            # "prism-light": self.static_dir / "prism-pdf-light.css",
        }

        for name, file_path in css_files.items():
            if file_path.exists():
                async with aiofiles.open(file_path, "r", encoding="utf-8") as f:
                    self.css_cache[name] = await f.read()
                logger.info(f"Loaded {name} CSS from {file_path}")
            else:
                logger.warning(f"CSS file not found: {file_path}")

    async def _download_prism_css(self) -> None:
        """Download Prism.js CSS from CDN."""
        base_url = f"https://cdnjs.cloudflare.com/ajax/libs/prism-themes/{self.prism_themes_version}"
        prism_urls: Dict[str, str] = {
            "prism-light": f"{base_url}/prism-vsc-light-plus.min.css",
            "prism-dark": f"{base_url}/prism-vsc-dark-plus.min.css",
        }

        async with httpx.AsyncClient() as client:
            for name, url in prism_urls.items():
                try:
                    response = await client.get(url, follow_redirects=True)
                    response.raise_for_status()
                    self.css_cache[name] = response.text
                    logger.info(f"Downloaded {name} CSS from CDN")
                except Exception as e:
                    logger.warning(f"Failed to download {name} CSS: {e}")
                    # Fallback to minimal syntax highlighting
                    self.css_cache[name] = self._get_fallback_prism_css()

    def _get_fallback_prism_css(self) -> str:
        """Minimal fallback syntax highlighting if CDN fails."""
        return (
            ".token.comment, .token.prolog, .token.doctype, .token.cdata { color: #708090; }\n"
            ".token.punctuation { color: #999; }\n"
            ".token.property, .token.tag, .token.boolean, .token.number, .token.constant, .token.symbol,\n"
            ".token.deleted { color: #905; }\n"
            ".token.selector, .token.attr-name, .token.string, .token.char, .token.builtin,\n"
            ".token.inserted { color: #690; }\n"
            ".token.operator, .token.entity, .token.url, .language-css .token.string,\n"
            ".style .token.string { color: #9a6e3a; }\n"
            ".token.atrule, .token.attr-value, .token.keyword { color: #07a; }\n"
            ".token.function, .token.class-name { color: #DD4A68; }\n"
            ".token.regex, .token.important, .token.variable { color: #e90; }\n"
            ".token.important, .token.bold { font-weight: bold; }\n"
            ".token.italic { font-style: italic; }"
        )

    def get_pdf_css(self, is_dark_mode: bool = False) -> str:
        """Get combined CSS for PDF generation."""
        css_parts: list[str] = [
            self.css_cache.get("base", ""),
            self.css_cache.get("pagebreaks", ""),
            self.css_cache.get("mermaid", ""),
            self.css_cache.get("dark" if is_dark_mode else "light", ""),
            self.css_cache.get("prism-dark" if is_dark_mode else "prism-light", ""),
        ]
        return "\n\n".join(filter(None, css_parts))

    async def refresh_prism_css(self, version: str | None = None) -> None:
        """Refresh Prism.js CSS from CDN (useful for updates)."""
        if version:
            self.prism_theme_version = version
            logger.info(f"Updated Prism.js version to {version}")
        await self._download_prism_css()

    def get_prism_themes_version(self) -> str:
        """Get current Prism.js version."""
        return self.prism_themes_version


# Global CSS service instance
css_service: CSSService = CSSService()
