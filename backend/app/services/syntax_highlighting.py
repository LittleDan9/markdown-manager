"""
Syntax highlighting service using Pygments.
Provides comprehensive syntax highlighting for code blocks with support
for many programming languages.
"""
import html
from typing import Any, Dict, Optional

from pygments import highlight
from pygments.formatters import HtmlFormatter
from pygments.lexers import get_all_lexers, get_lexer_by_name
from pygments.util import ClassNotFound


class SyntaxHighlightingService:
    """Service for syntax highlighting code blocks using Pygments."""

    def __init__(self) -> None:
        """Initialize the syntax highlighting service."""
        self.formatter: HtmlFormatter = HtmlFormatter(
            nowrap=True,
            cssclass="",
            classprefix="token ",
        )
        self._available_languages: Optional[Dict[str, str]] = None

    def get_available_languages(self) -> Dict[str, str]:
        """Get all available languages that can be highlighted."""
        if self._available_languages is None:
            self._available_languages = {}
            for lexer in get_all_lexers():
                name = lexer[0]
                aliases = lexer[1]
                if aliases:
                    for alias in aliases:
                        self._available_languages[alias.lower()] = name
        return self._available_languages

    def highlight_code(self, code: str, language: Optional[str] = None) -> str:
        """
        Highlight code using Pygments.
        Args:
            code: The source code to highlight
            language: The programming language (optional)
        Returns:
            HTML string with syntax highlighting
        """
        if not code or not code.strip():
            return html.escape(code)
        if not language:
            return html.escape(code)
        try:
            lexer = get_lexer_by_name(language.lower(), stripnl=False)
            highlighted = highlight(code, lexer, self.formatter)
            return str(highlighted)
        except ClassNotFound:
            return html.escape(code)
        except Exception as e:
            print(f"Error highlighting code: {e}")
            return html.escape(code)

    def is_language_supported(self, language: str) -> bool:
        """Check if a language is supported for highlighting."""
        if not language:
            return False
        try:
            get_lexer_by_name(language.lower())
            return True
        except ClassNotFound:
            return False

    def get_language_info(self, language: str) -> Optional[Dict[str, Any]]:
        """Get information about a specific language."""
        try:
            lexer = get_lexer_by_name(language.lower())
            return {
                "name": lexer.name,
                "aliases": lexer.aliases,
                "filenames": lexer.filenames,
                "mimetypes": lexer.mimetypes,
            }
        except ClassNotFound:
            return None


# Global instance
syntax_highlighter = SyntaxHighlightingService()
