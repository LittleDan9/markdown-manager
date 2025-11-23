# Phase 2B: Architecture Converter - Mermaid Source Parsing

## Overview

Implement the second part of the architecture-specific converter focusing on parsing Mermaid architecture diagram source code. This phase handles services, groups, junctions, and directional edges specific to architecture diagrams.

## 🎯 Phase Objectives

- Parse architecture diagram source code syntax
- Support service, group, and junction definitions
- Handle bidirectional and directional edges with position specifiers
- Support icon references and group membership
- Parse complex edge routing (T-B, L-R, etc.)

## 🏗️ Architecture Overview

### Building on Phase 2A

Phase 2A established:

- `ArchitectureMermaidConverter` foundation class
- Enhanced SVG position extraction
- Transform accumulation and viewBox handling
- Positioning utility classes

### Phase 2B Additions

```text
diagram_converters/
├── architecture_converter.py  # COMPLETE: Full architecture parsing
└── parsing/                   # NEW: Architecture-specific parsing
    ├── __init__.py
    ├── architecture_parser.py  # Main parsing logic
    ├── service_parser.py       # Service definitions
    ├── group_parser.py         # Group definitions
    ├── junction_parser.py      # Junction definitions
    └── edge_parser.py          # Edge parsing with directions
```

## 📋 Architecture Diagram Syntax Reference

### Service Definitions

```mermaid
service input(azure:files)[Input]
service sftp(material-icon-theme:folder-content-open)[SFTP] in mft
```

**Pattern**: `service <id>(<icon>)[<label>] [in <group>]`

### Group Definitions

```mermaid
group mft(logos:progress)[Gainwell MFT]
group genius(logos:gainwell-arrow-green)[Gainwell Genius]
```

**Pattern**: `group <id>(<icon>)[<label>]`

### Junction Definitions

```mermaid
junction junctionPBI in genius
```

**Pattern**: `junction <id> [in <group>]`

### Edge Definitions

```mermaid
input:R --> L:sftp              # Right to Left connection
warehouse:T -- B:junctionPBI    # Top to Bottom connection
powerbi:B <-- T:portal          # Bottom to Top connection
portal:R <-- L:user             # Right to Left bidirectional
```

**Pattern**: `<source>:<direction> <arrow> <direction>:<target>`

- **Directions**: `R` (Right), `L` (Left), `T` (Top), `B` (Bottom)
- **Arrows**: `-->` (solid), `<--` (reverse), `<-->` (bidirectional), `--` (line)

## 🔧 Implementation Details

### 1. Complete Architecture Parser (`parsing/architecture_parser.py`)

```python
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
            normalized_content = self._normalize_content(content)

            # Parse each component type
            services = self._parse_services(normalized_content)
            groups = self._parse_groups(normalized_content)
            junctions = self._parse_junctions(normalized_content)
            edges = self._parse_edges(normalized_content)

            # Validate and cross-reference
            self._validate_references(services, groups, junctions, edges)

            # Build final structure
            result = {
                'services': services,
                'groups': groups,
                'junctions': junctions,
                'edges': edges,
                'metadata': {
                    'service_count': len(services),
                    'group_count': len(groups),
                    'junction_count': len(junctions),
                    'edge_count': len(edges)
                }
            }

            self.logger.info(f"Parsed architecture: {result['metadata']}")
            return result

        except Exception as e:
            self.logger.error(f"Architecture parsing failed: {str(e)}")
            raise ValueError(f"Failed to parse architecture content: {str(e)}")

    def _normalize_content(self, content: str) -> str:
        """Normalize content by removing comments and extra whitespace."""
        lines = []
        for line in content.split('\n'):
            # Remove comments
            comment_pos = line.find('%%')
            if comment_pos >= 0:
                line = line[:comment_pos]

            line = line.strip()
            if line and not line.startswith('architecture'):
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
            icon = match[1].strip()
            label = match[2].strip()
            group = match[3].strip() if match[3] else None

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

        # Pattern: group name(icon)[Label]
        pattern = r'group\s+([A-Za-z0-9_-]+)\(([^)]+)\)\[([^\]]+)\]'

        matches = re.findall(pattern, content, re.MULTILINE)

        for match in matches:
            group_id = match[0]
            icon = match[1].strip()
            label = match[2].strip()

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

        # Complex edge patterns with directions
        edge_patterns = [
            # source:R --> L:target
            (r'([A-Za-z0-9_-]+):([LRTB])\s*(--?>)\s*([LRTB]):([A-Za-z0-9_-]+)', 'directional_solid'),
            # source:R <-- L:target
            (r'([A-Za-z0-9_-]+):([LRTB])\s*(<--?)\s*([LRTB]):([A-Za-z0-9_-]+)', 'directional_reverse'),
            # source:R <--> L:target
            (r'([A-Za-z0-9_-]+):([LRTB])\s*(<--?>)\s*([LRTB]):([A-Za-z0-9_-]+)', 'directional_bidirectional'),
            # source:T -- B:target (line only)
            (r'([A-Za-z0-9_-]+):([LRTB])\s*(--)\s*([LRTB]):([A-Za-z0-9_-]+)', 'directional_line'),
            # Fallback: simple arrows without directions
            (r'([A-Za-z0-9_-]+)\s*(--?>)\s*([A-Za-z0-9_-]+)', 'simple_solid'),
            (r'([A-Za-z0-9_-]+)\s*(<--?)\s*([A-Za-z0-9_-]+)', 'simple_reverse'),
        ]

        for pattern, edge_type in edge_patterns:
            matches = re.findall(pattern, content, re.MULTILINE)

            for match in matches:
                edge = self._create_edge_from_match(match, edge_type)
                if edge:
                    edges.append(edge)
                    self.logger.debug(f"Parsed edge: {edge.source}:{edge.source_direction} -> {edge.target}:{edge.target_direction}")

        return edges

    def _create_edge_from_match(self, match: Tuple, edge_type: str) -> Optional[EdgeDefinition]:
        """Create EdgeDefinition from regex match based on edge type."""
        try:
            if edge_type.startswith('directional'):
                # Format: (source, source_dir, arrow, target_dir, target)
                source = match[0]
                source_dir = match[1]
                arrow = match[2]
                target_dir = match[3]
                target = match[4]

                # Determine arrow type
                if edge_type == 'directional_solid':
                    arrow_type = 'solid'
                elif edge_type == 'directional_reverse':
                    arrow_type = 'reverse'
                    # Swap source and target for reverse arrows
                    source, target = target, source
                    source_dir, target_dir = target_dir, source_dir
                elif edge_type == 'directional_bidirectional':
                    arrow_type = 'bidirectional'
                elif edge_type == 'directional_line':
                    arrow_type = 'line'
                else:
                    arrow_type = 'solid'

                return EdgeDefinition(
                    source=source,
                    target=target,
                    source_direction=source_dir,
                    target_direction=target_dir,
                    arrow_type=arrow_type
                )

            elif edge_type.startswith('simple'):
                # Format: (source, arrow, target)
                source = match[0]
                arrow = match[1]
                target = match[2]

                if edge_type == 'simple_reverse':
                    # Swap for reverse arrows
                    source, target = target, source
                    arrow_type = 'solid'
                else:
                    arrow_type = 'solid'

                return EdgeDefinition(
                    source=source,
                    target=target,
                    arrow_type=arrow_type
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
                service.group = None

        for junction in junctions.values():
            if junction.group and junction.group not in groups:
                self.logger.warning(f"Junction {junction.id} references unknown group: {junction.group}")
                junction.group = None

        # Update group service lists
        for service in services.values():
            if service.group and service.group in groups:
                groups[service.group].services.append(service.id)
```

### 2. Complete Architecture Converter (`architecture_converter.py`)

Update the `parse_mermaid_source` method:

```python
async def parse_mermaid_source(self, mermaid_content: str) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """
    Parse architecture diagram source code.

    Returns nodes and edges in the format expected by the base converter.
    """
    try:
        self.logger.info("Parsing architecture diagram source")

        # Import parser
        from .parsing.architecture_parser import ArchitectureParser

        # Parse architecture content
        parser = ArchitectureParser()
        parsed_data = parser.parse_architecture_content(mermaid_content)

        # Convert to base converter format
        nodes = {}
        edges = []

        # Convert services to nodes
        for service_id, service in parsed_data['services'].items():
            nodes[service_id] = {
                'id': service_id,
                'label': service.label,
                'icon': service.icon,
                'hasIcon': bool(service.icon),
                'type': 'service',
                'group': service.group
            }

        # Convert groups to nodes (they can have visual representation)
        for group_id, group in parsed_data['groups'].items():
            nodes[group_id] = {
                'id': group_id,
                'label': group.label,
                'icon': group.icon,
                'hasIcon': bool(group.icon),
                'type': 'group',
                'services': group.services
            }

        # Convert junctions to nodes
        for junction_id, junction in parsed_data['junctions'].items():
            nodes[junction_id] = {
                'id': junction_id,
                'label': junction_id,  # Junctions typically don't have separate labels
                'icon': None,
                'hasIcon': False,
                'type': 'junction',
                'group': junction.group
            }

        # Convert edges
        for edge in parsed_data['edges']:
            edges.append({
                'source': edge.source,
                'target': edge.target,
                'source_direction': edge.source_direction,
                'target_direction': edge.target_direction,
                'dashed': edge.arrow_type in ['dashed', 'line'],
                'bidirectional': edge.arrow_type == 'bidirectional',
                'arrow_type': edge.arrow_type
            })

        self.logger.info(f"Converted to base format: {len(nodes)} nodes, {len(edges)} edges")
        return nodes, edges

    except Exception as e:
        self.logger.error(f"Architecture source parsing failed: {str(e)}")
        raise ValueError(f"Failed to parse architecture source: {str(e)}")
```

### 3. Enhanced Draw.io XML Generation

Update the `build_drawio_xml` method to handle architecture-specific features:

```python
async def build_drawio_xml(
    self,
    nodes: Dict[str, Any],
    edges: List[Dict[str, Any]],
    positions: Dict[str, Dict[str, float]],
    icon_service_url: Optional[str] = None,
    width: int = 1000,
    height: int = 600
) -> Tuple[str, Dict[str, Any]]:
    """Build Draw.io XML with architecture-specific enhancements."""
    try:
        # Create root mxGraphModel element
        root = ET.Element('mxGraphModel',
                          dx='1466', dy='827', grid='1', gridSize='10', guides='1', tooltips='1',
                          connect='1', arrows='1', fold='1', page='1', pageScale='1',
                          pageWidth=str(width), pageHeight=str(height), math='0', shadow='0')

        root_el = ET.SubElement(root, 'root')
        ET.SubElement(root_el, 'mxCell', id='0')
        ET.SubElement(root_el, 'mxCell', id='1', parent='0')

        # Track conversion statistics
        stats = {
            'nodes_converted': 0,
            'edges_converted': 0,
            'icons_attempted': 0,
            'icons_successful': 0,
            'groups_created': 0,
            'junctions_created': 0
        }

        # Create nodes with architecture-specific styling
        x_offset = 100
        for i, (node_id, node_info) in enumerate(nodes.items()):
            position = positions.get(node_id, {
                'x': x_offset + (i * 150),
                'y': 100,
                'w': 80,
                'h': 50
            })

            # Create node with type-specific styling
            await self._create_architecture_node(
                root_el, node_id, node_info, position, icon_service_url, stats
            )

            stats['nodes_converted'] += 1

        # Create edges with directional support
        await self._create_architecture_edges(root_el, edges, stats)

        # Convert to XML string and wrap in Draw.io format
        mx_xml = ET.tostring(root, encoding='unicode')
        drawio_xml = self._wrap_as_drawio(mx_xml)

        # Calculate success rates
        stats['icon_success_rate'] = (
            (stats['icons_successful'] / stats['icons_attempted'] * 100)
            if stats['icons_attempted'] > 0 else 100.0
        )

        return drawio_xml, stats

    except Exception as e:
        self.logger.error(f"Failed to build architecture Draw.io XML: {str(e)}")
        raise ValueError(f"Failed to build architecture Draw.io XML: {str(e)}")

async def _create_architecture_node(
    self,
    root_el: ET.Element,
    node_id: str,
    node_info: Dict[str, Any],
    position: Dict[str, float],
    icon_service_url: Optional[str],
    stats: Dict[str, int]
):
    """Create a node with architecture-specific styling."""
    label = node_info['label']
    node_type = node_info.get('type', 'service')

    # Determine style based on node type
    if node_type == 'service':
        style = await self._get_service_style(node_info, icon_service_url, stats)
        # Services are typically larger
        position['w'] = max(position.get('w', 80), 120)
        position['h'] = max(position.get('h', 50), 100)

    elif node_type == 'junction':
        style = "shape=ellipse;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;"
        # Junctions are small
        position['w'] = 20
        position['h'] = 20
        stats['junctions_created'] += 1

    elif node_type == 'group':
        # Groups are typically rendered as containers/backgrounds
        style = "rounded=1;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;dashed=1;"
        # Groups are larger to contain services
        position['w'] = max(position.get('w', 200), 200)
        position['h'] = max(position.get('h', 150), 150)
        stats['groups_created'] += 1

    else:
        # Default service style
        style = "shape=rectangle;rounded=2;whiteSpace=wrap;html=1;"

    # Create the cell
    cell_id = f"node-{node_id}"
    cell = ET.SubElement(root_el, 'mxCell',
                        id=cell_id,
                        value=self._escape_xml(label),
                        style=style,
                        vertex='1',
                        parent='1')

    geometry = ET.SubElement(cell, 'mxGeometry',
                           x=str(position['x']),
                           y=str(position['y']),
                           width=str(position['w']),
                           height=str(position['h']))
    geometry.set('as', 'geometry')

async def _get_service_style(
    self,
    node_info: Dict[str, Any],
    icon_service_url: Optional[str],
    stats: Dict[str, int]
) -> str:
    """Get styling for service nodes, potentially with icons."""
    if node_info.get('hasIcon') and node_info.get('icon') and icon_service_url:
        stats['icons_attempted'] += 1
        icon_svg = await self.fetch_icon_svg(node_info['icon'], icon_service_url)
        if icon_svg:
            stats['icons_successful'] += 1
            # Service with icon
            style = "shape=image;imageBackground=none;imageBorder=none;whiteSpace=wrap;html=1;"
            style += "verticalLabelPosition=bottom;verticalAlign=top;labelPosition=center;align=center;"
            style += f"image={self._escape_xml(icon_svg)}"
            return style

    # Service without icon
    return "shape=rectangle;rounded=2;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;"

async def _create_architecture_edges(
    self,
    root_el: ET.Element,
    edges: List[Dict[str, Any]],
    stats: Dict[str, int]
):
    """Create edges with architecture-specific directional support."""
    edge_id = 1000

    for edge in edges:
        source_id = f"node-{edge['source']}"
        target_id = f"node-{edge['target']}"

        # Build style based on edge properties
        style = 'endArrow=block;html=1;rounded=0;'

        if edge.get('dashed', False):
            style += 'dashed=1;dashPattern=3 3;'

        if edge.get('bidirectional', False):
            style += 'startArrow=block;'

        # Add directional exit/entry points if specified
        if edge.get('source_direction') or edge.get('target_direction'):
            style += self._get_directional_style(edge)

        edge_elem = ET.SubElement(root_el, 'mxCell',
                                 id=str(edge_id),
                                 style=style,
                                 edge='1',
                                 parent='1',
                                 source=source_id,
                                 target=target_id)

        geometry = ET.SubElement(edge_elem, 'mxGeometry', relative='1')
        geometry.set('as', 'geometry')

        # Add waypoints for directional edges if needed
        if edge.get('source_direction') or edge.get('target_direction'):
            self._add_directional_waypoints(geometry, edge)

        stats['edges_converted'] += 1
        edge_id += 1

def _get_directional_style(self, edge: Dict[str, Any]) -> str:
    """Get additional styling for directional edges."""
    style = ""

    # Add exit/entry point styling based on directions
    source_dir = edge.get('source_direction')
    target_dir = edge.get('target_direction')

    if source_dir:
        if source_dir == 'R':
            style += 'exitX=1;exitY=0.5;exitDx=0;exitDy=0;'
        elif source_dir == 'L':
            style += 'exitX=0;exitY=0.5;exitDx=0;exitDy=0;'
        elif source_dir == 'T':
            style += 'exitX=0.5;exitY=0;exitDx=0;exitDy=0;'
        elif source_dir == 'B':
            style += 'exitX=0.5;exitY=1;exitDx=0;exitDy=0;'

    if target_dir:
        if target_dir == 'R':
            style += 'entryX=1;entryY=0.5;entryDx=0;entryDy=0;'
        elif target_dir == 'L':
            style += 'entryX=0;entryY=0.5;entryDx=0;entryDy=0;'
        elif target_dir == 'T':
            style += 'entryX=0.5;entryY=0;entryDx=0;entryDy=0;'
        elif target_dir == 'B':
            style += 'entryX=0.5;entryY=1;entryDx=0;entryDy=0;'

    return style

def _add_directional_waypoints(self, geometry: ET.Element, edge: Dict[str, Any]):
    """Add intermediate waypoints for better edge routing."""
    # For now, let Draw.io handle automatic routing
    # Could be enhanced with specific waypoint calculation based on directions
    pass

# Keep existing icon and XML utility methods
async def fetch_icon_svg(self, icon_ref: str, icon_service_url: str) -> Optional[str]:
    """Fetch and clean SVG icon from icon service."""
    # Implementation from original service - keep unchanged
    # ... (existing implementation)

def _wrap_as_drawio(self, mx_xml: str) -> str:
    """Wrap mxGraphModel XML in Draw.io format."""
    # Implementation from original service - keep unchanged
    # ... (existing implementation)

def _escape_xml(self, text: str) -> str:
    """Escape text for XML content."""
    import html
    return html.escape(text)
```

## ✅ Testing Strategy

### Test Files to Create

```text
export-service/tests/
├── test_architecture_parser.py
├── test_service_parsing.py
├── test_group_parsing.py
├── test_junction_parsing.py
├── test_edge_parsing.py
└── fixtures/
    └── architecture_samples.py
```

### Architecture Test Data (`fixtures/architecture_samples.py`)

```python
"""Test data for architecture diagram parsing."""

# Complete architecture diagram
ARCHITECTURE_COMPLETE = """
architecture-beta
  service input(azure:files)[Input]
  group mft(logos:progress)[Gainwell MFT]
  service sftp(material-icon-theme:folder-content-open)[SFTP] in mft

  group genius(logos:gainwell-arrow-green)[Gainwell Genius]
  service landing(aws:AmazonSimpleStorageServiceS3ObjectLock)[Input Storage] in genius
  service clamav(logos:clamav-logo)[Antivirus] in genius
  service enrich(dbx:data-transformation-ref)[Enrichment] in genius
  service warehouse(dbx:data-warehouse-red)[SQL Warehouse] in genius
  service powerbi(azure:power-bi-embedded)[Power BI] in genius
  service portal(logos:gainwell-arrow-green)[Portal] in genius
  junction junctionPBI in genius

  service user(flat-color-icons:businesswoman)[User]

  input:R --> L:sftp
  sftp:R --> L:landing
  landing:R --> L:clamav
  clamav:R --> L:enrich
  enrich:R --> L:warehouse
  warehouse:R <-- L:portal
  warehouse:T -- B:junctionPBI
  junctionPBI:R --> L:powerbi
  powerbi:B <-- T:portal
  portal:R <-- L:user
"""

# Individual component tests
ARCHITECTURE_SERVICES_ONLY = """
architecture-beta
  service input(azure:files)[Input]
  service sftp(material-icon-theme:folder-content-open)[SFTP]
  service warehouse(dbx:data-warehouse-red)[SQL Warehouse]
"""

ARCHITECTURE_WITH_GROUPS = """
architecture-beta
  group mft(logos:progress)[Gainwell MFT]
  service sftp(material-icon-theme:folder-content-open)[SFTP] in mft
  service landing(aws:AmazonSimpleStorageServiceS3ObjectLock)[Input Storage] in mft
"""

ARCHITECTURE_WITH_JUNCTIONS = """
architecture-beta
  group genius(logos:gainwell-arrow-green)[Gainwell Genius]
  junction junctionPBI in genius
  junction standalone
"""

ARCHITECTURE_EDGE_TYPES = """
architecture-beta
  service A(icon)[Service A]
  service B(icon)[Service B]
  service C(icon)[Service C]
  service D(icon)[Service D]

  A:R --> L:B
  B:T -- B:C
  C:L <-- R:D
  A:B <--> T:D
"""
```

### Key Test Cases

1. **Service Parsing**
   - Service with icon and label
   - Service with group membership
   - Service without group

2. **Group Parsing**
   - Group definition with icon
   - Group membership validation
   - Multiple services in group

3. **Junction Parsing**
   - Junction with group membership
   - Standalone junction
   - Junction in edges

4. **Edge Parsing**
   - Directional edges (R, L, T, B)
   - Different arrow types
   - Bidirectional connections
   - Line connections

5. **Integration Testing**
   - Complete architecture diagrams
   - Error handling for invalid syntax
   - Reference validation

## 🚀 Implementation Steps

### Step 1: Create Parsing Infrastructure

```bash
mkdir -p export-service/app/services/diagram_converters/parsing
touch export-service/app/services/diagram_converters/parsing/__init__.py
```

### Step 2: Implement Parsers

1. Create main architecture parser
2. Implement component parsers (service, group, junction, edge)
3. Add validation and error handling

### Step 3: Complete Architecture Converter

1. Implement `parse_mermaid_source` method
2. Enhance `build_drawio_xml` for architecture features
3. Add architecture-specific styling

### Step 4: Testing

1. Create comprehensive test suite
2. Test individual components and integration
3. Validate against real architecture diagrams

## 🎯 Success Criteria

- [ ] Complete architecture diagram syntax parsing
- [ ] Service, group, and junction definitions handled
- [ ] Directional edges properly parsed and rendered
- [ ] Icon references and group membership working
- [ ] Draw.io XML generated with proper architecture styling
- [ ] All edge types (solid, dashed, bidirectional) supported
- [ ] Comprehensive test coverage for all syntax features

## 📋 Deliverables

1. Complete architecture parsing system
2. Enhanced Draw.io XML generation with architecture features
3. Support for all architecture diagram syntax elements
4. Comprehensive test suite with real examples
5. Error handling and validation
6. Documentation updates

## 🔗 Next Phase

Phase 3 will focus on integration testing, performance optimization, and production deployment of the complete multi-algorithm architecture.