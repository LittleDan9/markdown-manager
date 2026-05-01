"""
Syntax highlighting service using Pygments.
Provides comprehensive syntax highlighting for code blocks with support
for many programming languages.
"""
import html
import re
from typing import Any, Dict, List, Optional

from pygments import highlight
from pygments.formatters import HtmlFormatter
from pygments.lexers import get_all_lexers, get_lexer_by_name
from pygments.styles import get_all_styles, get_style_by_name
from pygments.util import ClassNotFound


class SyntaxHighlightingService:
    """Service for syntax highlighting code blocks using Pygments."""

    # Curated styles with metadata for the UI
    CURATED_STYLES = {
        "one-dark": {"label": "One Dark", "variant": "dark", "companion": "one-light"},
        "monokai": {"label": "Monokai", "variant": "dark", "companion": None},
        "dracula": {"label": "Dracula", "variant": "dark", "companion": None},
        "github-dark": {"label": "GitHub Dark", "variant": "dark", "companion": "github-light"},
        "gruvbox-dark": {"label": "Gruvbox Dark", "variant": "dark", "companion": "gruvbox-light"},
        "nord": {"label": "Nord", "variant": "dark", "companion": None},
        "solarized-dark": {"label": "Solarized Dark", "variant": "dark", "companion": "solarized-light"},
        "native": {"label": "Native", "variant": "dark", "companion": None},
        "zenburn": {"label": "Zenburn", "variant": "dark", "companion": None},
        "material": {"label": "Material", "variant": "dark", "companion": None},
        "one-light": {"label": "One Light", "variant": "light", "companion": "one-dark"},
        "github-light": {"label": "GitHub Light", "variant": "light", "companion": "github-dark"},
        "gruvbox-light": {"label": "Gruvbox Light", "variant": "light", "companion": "gruvbox-dark"},
        "solarized-light": {"label": "Solarized Light", "variant": "light", "companion": "solarized-dark"},
        "vs": {"label": "Visual Studio", "variant": "light", "companion": None},
        "xcode": {"label": "Xcode", "variant": "light", "companion": None},
        "friendly": {"label": "Friendly", "variant": "light", "companion": None},
    }

    def __init__(self) -> None:
        """Initialize the syntax highlighting service."""
        self.formatter: HtmlFormatter = HtmlFormatter(
            nowrap=True,
            cssclass="",
            classprefix="token ",
        )
        self._available_languages: Optional[Dict[str, str]] = None
        self._style_css_cache: Dict[str, str] = {}
        self._available_styles: Optional[List[str]] = None

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

    def map_pygments_to_prism(self, highlighted: str) -> str:
        PYGMENTS_TO_PRISM = {
            # Keywords
            "k": "keyword",
            "kd": "keyword",
            "kn": "keyword",
            "kp": "keyword",
            "kr": "keyword",
            "kt": "keyword",
            # Operators and punctuation
            "o": "operator",
            "p": "punctuation",
            # Numbers
            "m": "number",
            "mf": "number",
            "mh": "number",
            "mi": "number",
            "mo": "number",
            # Strings
            "s": "string",
            "sb": "string",
            "sc": "string",
            "sd": "string",
            "s2": "string",
            "se": "string",
            "sh": "string",
            "si": "string",
            "sx": "string",
            "sr": "regex",
            "s1": "string",
            "ss": "string",
            # Comments
            "c": "comment",
            "ch": "comment",
            "cm": "comment",
            "cp": "comment",
            "cpf": "comment",
            "c1": "comment",
            "cs": "comment",
            # Variables and identifiers
            "n": "name",
            "na": "attribute",
            "nb": "builtin",
            "nc": "class-name",
            "no": "constant",
            "nd": "function",
            "ni": "namespace",
            "ne": "exception",
            "nf": "function",
            "nl": "function",
            "nn": "namespace",
            "nx": "variable",
            "py": "variable",
            "nt": "tag",
            "nv": "variable",
            "vc": "variable",
            "vg": "variable",
            "vi": "variable",
            "vm": "variable",
            # Built-in functions and constants
            "kc": "constant",
            # Whitespace
            "w": "whitespace",
            # Generic tokens
            "g": "generic",
            # Error tokens
            "err": "error",
        }

        # Regex to find class="token <short> ..." or class="token <short>"
        def repl(match: re.Match[str]) -> str:
            classes = match.group(1).split()
            new_classes = []
            for cls in classes:
                # Only replace if in mapping
                new_classes.append(PYGMENTS_TO_PRISM.get(cls, cls))
            return 'class="token ' + " ".join(new_classes) + '"'

        # Replace all token class attributes
        return re.sub(r'class="token ([^"]+)"', repl, highlighted)

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

    def get_available_styles(self) -> List[Dict[str, Any]]:
        """Get curated list of available syntax highlighting styles."""
        if self._available_styles is None:
            # Get all installed Pygments styles
            installed = set(get_all_styles())
            self._available_styles = installed

        styles = []
        for style_name, meta in self.CURATED_STYLES.items():
            # Only include if the style is actually installed
            # Handle name differences (Pygments uses underscores sometimes)
            pygments_name = style_name.replace("-", "_")
            alt_name = style_name
            if pygments_name in self._available_styles or alt_name in self._available_styles:
                styles.append({
                    "name": style_name,
                    "label": meta["label"],
                    "variant": meta["variant"],
                    "companion": meta["companion"],
                })
        return styles

    def get_style_css(self, style_name: str) -> Optional[str]:
        """Generate CSS for a given Pygments style, using Prism token class names."""
        if style_name in self._style_css_cache:
            return self._style_css_cache[style_name]

        # Resolve Pygments style name (may use underscores)
        pygments_name = style_name.replace("-", "_")
        try:
            style = get_style_by_name(pygments_name)
        except ClassNotFound:
            try:
                style = get_style_by_name(style_name)
            except ClassNotFound:
                return None

        formatter = HtmlFormatter(style=style, nowrap=True, classprefix="token ")
        # Get CSS rules scoped to .token prefix
        raw_css = formatter.get_style_defs("pre code .token")

        # Map Pygments short classes to Prism long names in the CSS
        css = self._map_css_to_prism_classes(raw_css)

        self._style_css_cache[style_name] = css
        return css

    def _map_css_to_prism_classes(self, css: str) -> str:
        """Remap Pygments short class names in CSS to Prism-compatible names."""
        PYGMENTS_CSS_MAP = {
            ".token.k": ".token.keyword",
            ".token.kd": ".token.keyword",
            ".token.kn": ".token.keyword",
            ".token.kp": ".token.keyword",
            ".token.kr": ".token.keyword",
            ".token.kt": ".token.keyword",
            ".token.o": ".token.operator",
            ".token.p": ".token.punctuation",
            ".token.m": ".token.number",
            ".token.mf": ".token.number",
            ".token.mh": ".token.number",
            ".token.mi": ".token.number",
            ".token.mo": ".token.number",
            ".token.s": ".token.string",
            ".token.sb": ".token.string",
            ".token.sc": ".token.string",
            ".token.sd": ".token.string",
            ".token.s2": ".token.string",
            ".token.se": ".token.string",
            ".token.sh": ".token.string",
            ".token.si": ".token.string",
            ".token.sx": ".token.string",
            ".token.sr": ".token.regex",
            ".token.s1": ".token.string",
            ".token.ss": ".token.string",
            ".token.c": ".token.comment",
            ".token.ch": ".token.comment",
            ".token.cm": ".token.comment",
            ".token.cp": ".token.comment",
            ".token.cpf": ".token.comment",
            ".token.c1": ".token.comment",
            ".token.cs": ".token.comment",
            ".token.na": ".token.attribute",
            ".token.nb": ".token.builtin",
            ".token.nc": ".token.class-name",
            ".token.no": ".token.constant",
            ".token.nd": ".token.function",
            ".token.ni": ".token.namespace",
            ".token.ne": ".token.exception",
            ".token.nf": ".token.function",
            ".token.nl": ".token.function",
            ".token.nn": ".token.namespace",
            ".token.nx": ".token.variable",
            ".token.py": ".token.variable",
            ".token.nt": ".token.tag",
            ".token.nv": ".token.variable",
            ".token.vc": ".token.variable",
            ".token.vg": ".token.variable",
            ".token.vi": ".token.variable",
            ".token.vm": ".token.variable",
            ".token.kc": ".token.constant",
            ".token.w": ".token.whitespace",
            ".token.g": ".token.generic",
            ".token.err": ".token.error",
        }

        # Sort by length (longest first) to avoid partial replacements
        sorted_map = sorted(PYGMENTS_CSS_MAP.items(), key=lambda x: len(x[0]), reverse=True)
        for short, long in sorted_map:
            # Use regex to match only when the short class is followed by a non-alphanumeric
            # character (space, comma, brace, etc.) to avoid partial replacements
            # e.g. ".token.c" should not match inside ".token.class-name"
            pattern = re.escape(short) + r"(?![a-zA-Z0-9\-])"
            css = re.sub(pattern, long, css)
        return css


# Global instance
syntax_highlighter = SyntaxHighlightingService()
