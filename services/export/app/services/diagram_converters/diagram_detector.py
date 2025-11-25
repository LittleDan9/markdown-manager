"""Diagram type detection for Mermaid source code."""

import re
from typing import Dict, List, Union
from enum import Enum


class DiagramType(Enum):
    """Supported Mermaid diagram types."""
    ARCHITECTURE = "architecture"
    FLOWCHART = "flowchart"
    DEFAULT = "default"


class DiagramTypeDetector:
    """Detects Mermaid diagram type from source code."""

    # Detection patterns ordered by specificity
    DETECTION_PATTERNS = {
        DiagramType.ARCHITECTURE: [
            r'^\s*architecture(-beta)?',                    # architecture-beta keyword
            r'\bservice\s+\w+.*\[.*\]',                     # service definitions
            r'\bgroup\s+\w+.*\[.*\]',                       # group definitions
            r'\bjunction\s+\w+',                           # junction definitions
            r':\s*[LRTB]\s*[<-]+[>-]*\s*[LRTB]\s*:',      # directional edges
        ],
        DiagramType.FLOWCHART: [
            r'^\s*(graph|flowchart)',                       # graph TD, flowchart TD
            r'^\s*graph\s+(TD|TB|BT|RL|LR)',               # directed graphs
        ]
    }

    @classmethod
    def detect_diagram_type(cls, mermaid_source: str) -> DiagramType:
        """
        Detect diagram type from Mermaid source code.

        Args:
            mermaid_source: Raw Mermaid source code

        Returns:
            DiagramType enum value
        """
        if not mermaid_source or not mermaid_source.strip():
            return DiagramType.DEFAULT

        # Normalize source: remove comments, extra whitespace
        normalized = cls._normalize_source(mermaid_source)

        # Check patterns in order of specificity
        for diagram_type, patterns in cls.DETECTION_PATTERNS.items():
            if cls._matches_patterns(normalized, patterns):
                return diagram_type

        return DiagramType.DEFAULT

    @staticmethod
    def _normalize_source(source: str) -> str:
        """Remove comments and normalize whitespace."""
        # Remove Mermaid comments (lines starting with %%)
        lines = []
        for line in source.split('\n'):
            # Remove comment portion
            comment_pos = line.find('%%')
            if comment_pos >= 0:
                line = line[:comment_pos]
            line = line.strip()
            if line:
                lines.append(line)

        return '\n'.join(lines)

    @staticmethod
    def _matches_patterns(normalized_source: str, patterns: List[str]) -> bool:
        """Check if source matches any of the given patterns."""
        for pattern in patterns:
            if re.search(pattern, normalized_source, re.MULTILINE | re.IGNORECASE):
                return True
        return False

    @classmethod
    def get_diagram_info(cls, mermaid_source: str) -> Dict[str, Union[str, float, int, 'DiagramType']]:
        """
        Get detailed diagram information.

        Returns:
            Dictionary with diagram type and metadata
        """
        diagram_type = cls.detect_diagram_type(mermaid_source)

        return {
            "type": diagram_type,
            "type_name": diagram_type.value,
            "source_length": len(mermaid_source),
            "normalized_length": len(cls._normalize_source(mermaid_source)),
            "confidence": cls._calculate_confidence(mermaid_source, diagram_type)
        }

    @classmethod
    def _calculate_confidence(cls, source: str, detected_type: DiagramType) -> float:
        """Calculate confidence score for detection (0.0 to 1.0)."""
        if detected_type == DiagramType.DEFAULT:
            return 0.5  # Medium confidence for fallback

        normalized = cls._normalize_source(source)
        patterns = cls.DETECTION_PATTERNS.get(detected_type, [])

        matches = sum(1 for pattern in patterns
                      if re.search(pattern, normalized, re.MULTILINE | re.IGNORECASE))

        return min(1.0, 0.6 + (matches * 0.2))  # 60% base + 20% per match
