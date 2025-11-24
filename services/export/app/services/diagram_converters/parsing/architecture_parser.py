"""Main architecture diagram parsing logic."""

import re
import logging
from typing import Dict, List, Tuple, Optional, Any, Set
from dataclasses import dataclass


@dataclass
class ServiceDefinition:
    """Represents a service in an architecture diagram."""
    id: str
    label: str
    icon: Optional[str] = None
    group: Optional[str] = None


@dataclass
class GroupDefinition:
    """Represents a group in an architecture diagram."""
    id: str
    label: str
    icon: Optional[str] = None
    services: List[str] = None

    def __post_init__(self):
        if self.services is None:
            self.services = []


@dataclass
class JunctionDefinition:
    """Represents a junction in an architecture diagram."""
    id: str
    group: Optional[str] = None


@dataclass
class EdgeDefinition:
    """Represents an edge connection in an architecture diagram."""
    source: str
    target: str
    source_direction: Optional[str] = None
    target_direction: Optional[str] = None
    arrow_type: str = "solid"  # solid, dashed, bidirectional


class ArchitectureParser:
    """Parser for Mermaid architecture diagram syntax."""

    def __init__(self):
        self.logger = logging.getLogger("export-service.architecture-parser")

    def parse_architecture_content(self, content: str) -> Dict[str, Any]:
        """
        Parse complete architecture diagram content.

        Returns:
            Dictionary with services, groups, junctions, and edges
        """
        try:
            self.logger.info("Parsing architecture diagram content")

            # Normalize content
            content = self._normalize_content(content)

            # Parse components
            services = self._parse_services(content)
            groups = self._parse_groups(content)
            junctions = self._parse_junctions(content)
            edges = self._parse_edges(content)

            # Validate references
            self._validate_references(services, groups, junctions, edges)

            result = {
                'services': services,
                'groups': groups,
                'junctions': junctions,
                'edges': edges
            }

            self.logger.info(f"Parsed architecture: {len(services)} services, {len(groups)} groups, "
                           f"{len(junctions)} junctions, {len(edges)} edges")

            return result

        except Exception as e:
            self.logger.error(f"Architecture parsing failed: {str(e)}")
            raise ValueError(f"Failed to parse architecture content: {str(e)}")

    def _normalize_content(self, content: str) -> str:
        """Normalize content by removing comments and extra whitespace."""
        lines = []
        for line in content.split('\n'):
            # Remove comments
            line = re.sub(r'%%.*$', '', line)
            # Strip whitespace
            line = line.strip()
            if line:
                lines.append(line)

        return '\n'.join(lines)

    def _parse_services(self, content: str) -> Dict[str, ServiceDefinition]:
        """Parse service definitions from content."""
        services = {}

        # Pattern: service name(icon)[Label] [in group]
        pattern = r'service\s+([A-Za-z0-9_-]+)\(([^)]+)\)\[([^\]]+)\](?:\s+in\s+([A-Za-z0-9_-]+))?'

        matches = re.findall(pattern, content, re.MULTILINE)

        for match in matches:
            service_id = match[0]
            icon = match[1] if match[1] else None
            label = match[2]
            group = match[3] if match[3] else None

            services[service_id] = ServiceDefinition(
                id=service_id,
                label=label,
                icon=icon,
                group=group
            )

            self.logger.debug(f"Parsed service: {service_id} -> {label} ({icon}) in {group}")

        return services

    def _parse_groups(self, content: str) -> Dict[str, GroupDefinition]:
        """Parse group definitions from content."""
        groups = {}

        # Pattern: group name(icon)[Label] or group name[Label]
        pattern = r'group\s+([A-Za-z0-9_-]+)(?:\(([^)]+)\))?\[([^\]]+)\]'

        matches = re.findall(pattern, content, re.MULTILINE)

        for match in matches:
            group_id = match[0]
            icon = match[1] if match[1] else None
            label = match[2]

            groups[group_id] = GroupDefinition(
                id=group_id,
                label=label,
                icon=icon
            )

            self.logger.debug(f"Parsed group: {group_id} -> {label} ({icon})")

        return groups

    def _parse_junctions(self, content: str) -> Dict[str, JunctionDefinition]:
        """Parse junction definitions from content."""
        junctions = {}

        # Pattern: junction name [in group]
        pattern = r'junction\s+([A-Za-z0-9_-]+)(?:\s+in\s+([A-Za-z0-9_-]+))?'

        matches = re.findall(pattern, content, re.MULTILINE)

        for match in matches:
            junction_id = match[0]
            group = match[1] if match[1] else None

            junctions[junction_id] = JunctionDefinition(
                id=junction_id,
                group=group
            )

            self.logger.debug(f"Parsed junction: {junction_id} in {group}")

        return junctions

    def _parse_edges(self, content: str) -> List[EdgeDefinition]:
        """Parse edge definitions from content."""
        edges = []

        # Process all lines to find edges
        lines = content.split('\n')
        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Try directional patterns first (most specific)
            edge = self._try_parse_directional_edge(line)
            if edge:
                edges.append(edge)
                continue

            # Try simple patterns (less specific, only if directional didn't match)
            edge = self._try_parse_simple_edge(line)
            if edge:
                edges.append(edge)

        return edges

    def _try_parse_directional_edge(self, line: str) -> Optional[EdgeDefinition]:
        """Try to parse a directional edge from a line."""
        # Directional edge patterns
        patterns = [
            (r'([A-Za-z0-9_-]+):([LRTB])\s*(-->)\s*([LRTB]):([A-Za-z0-9_-]+)', 'directional_solid'),
            (r'([A-Za-z0-9_-]+):([LRTB])\s*(<--)\s*([LRTB]):([A-Za-z0-9_-]+)', 'directional_reverse'),
            (r'([A-Za-z0-9_-]+):([LRTB])\s*(<-->)\s*([LRTB]):([A-Za-z0-9_-]+)', 'directional_bidirectional'),
            (r'([A-Za-z0-9_-]+):([LRTB])\s*(--)\s*([LRTB]):([A-Za-z0-9_-]+)', 'directional_line'),
        ]

        for pattern, edge_type in patterns:
            match = re.search(pattern, line)
            if match:
                return self._create_edge_from_match(match.groups(), edge_type)

        return None

    def _try_parse_simple_edge(self, line: str) -> Optional[EdgeDefinition]:
        """Try to parse a simple edge from a line."""
        # Simple edge patterns (without directions)
        patterns = [
            (r'^([A-Za-z0-9_-]+)\s*(-->)\s*([A-Za-z0-9_-]+)$', 'simple_solid'),
            (r'^([A-Za-z0-9_-]+)\s*(<--?)\s*([A-Za-z0-9_-]+)$', 'simple_reverse'),
        ]

        for pattern, edge_type in patterns:
            match = re.search(pattern, line)
            if match:
                return self._create_edge_from_match(match.groups(), edge_type)

        return None

    def _create_edge_from_match(self, match: Tuple, edge_type: str) -> Optional[EdgeDefinition]:
        """Create EdgeDefinition from regex match based on edge type."""
        try:
            if edge_type.startswith('directional'):
                # Directional edge: (source, source_dir, arrow, target_dir, target)
                source = match[0]
                source_direction = match[1]
                arrow = match[2]
                target_direction = match[3]
                target = match[4]

                # Determine arrow type
                if edge_type.endswith('bidirectional') or '<->' in arrow:
                    arrow_type = 'bidirectional'
                elif edge_type.endswith('reverse') or arrow.startswith('<'):
                    arrow_type = 'solid'
                    # Swap source and target for reverse arrows
                    source, target = target, source
                    source_direction, target_direction = target_direction, source_direction
                elif edge_type.endswith('line'):
                    arrow_type = 'line'
                else:
                    arrow_type = 'solid'

                return EdgeDefinition(
                    source=source,
                    target=target,
                    source_direction=source_direction,
                    target_direction=target_direction,
                    arrow_type=arrow_type
                )

            elif edge_type.startswith('simple'):
                # Simple edge: (source, arrow, target)
                source = match[0]
                arrow = match[1]
                target = match[2]

                if edge_type.endswith('reverse') or arrow.startswith('<'):
                    # Swap for reverse arrows
                    source, target = target, source

                return EdgeDefinition(
                    source=source,
                    target=target,
                    arrow_type='solid'
                )

        except (IndexError, ValueError) as e:
            self.logger.warning(f"Failed to create edge from match {match}: {str(e)}")

        return None

    def _validate_references(
        self,
        services: Dict[str, ServiceDefinition],
        groups: Dict[str, GroupDefinition],
        junctions: Dict[str, JunctionDefinition],
        edges: List[EdgeDefinition]
    ):
        """Validate that all references are valid."""
        # Collect all valid node IDs
        all_nodes = set(services.keys()) | set(groups.keys()) | set(junctions.keys())

        # Check edge references
        invalid_edges = []
        for edge in edges:
            if edge.source not in all_nodes:
                self.logger.warning(f"Edge references unknown source: {edge.source}")
                invalid_edges.append(edge)
            elif edge.target not in all_nodes:
                self.logger.warning(f"Edge references unknown target: {edge.target}")
                invalid_edges.append(edge)

        # Remove invalid edges
        for invalid_edge in invalid_edges:
            edges.remove(invalid_edge)

        # Check group membership
        for service in services.values():
            if service.group and service.group not in groups:
                self.logger.warning(f"Service {service.id} references unknown group: {service.group}")
                service.group = None  # Clear invalid group reference

        for junction in junctions.values():
            if junction.group and junction.group not in groups:
                self.logger.warning(f"Junction {junction.id} references unknown group: {junction.group}")
                junction.group = None  # Clear invalid group reference

        # Update group service lists
        for service in services.values():
            if service.group and service.group in groups:
                if service.id not in groups[service.group].services:
                    groups[service.group].services.append(service.id)