#!/usr/bin/env python3
# Enhanced Mermaid SVG → draw.io converter with icon service integration
# Author: ChatGPT

import argparse, html, json, re, urllib.parse, requests
from xml.etree import ElementTree as ET

def parse_mermaid_source(mermaid_content):
    """Parse the raw mermaid source to extract node information and icons."""
    nodes = {}
    edges = []

    # First, collect all content in one string for easier processing
    content = ' '.join(line.strip() for line in mermaid_content.strip().split('\n')
                      if line.strip() and not line.strip().startswith('flowchart')
                      and not line.strip().startswith('graph'))

    print(f"Processing content: {content}")

    # Parse node definitions with icons first
    # A@{ icon: "network:firewall", form: "", label: "Node" }
    icon_matches = re.findall(r'(\w+)@\{[^}]*icon:\s*"([^"]+)"[^}]*label:\s*"([^"]+)"[^}]*\}', content)
    for node_id, icon_ref, label in icon_matches:
        nodes[node_id] = {
            'id': node_id,
            'label': label,
            'icon': icon_ref,
            'hasIcon': True
        }
        print(f"Found icon node: {node_id} -> {label} ({icon_ref})")

    # Parse all edges and extract nodes from them
    edge_patterns = [
        (r'(\w+)(?:@\{[^}]*\})?\s*-->\s*(\w+)', False),  # solid arrow (A@{...} --> B or A --> B)
        (r'(\w+)(?:@\{[^}]*\})?\s*-\.-\s*(\w+)', True),   # dotted line
        (r'(\w+)(?:@\{[^}]*\})?\s*---\s*(\w+)', False),   # solid line
    ]

    for pattern, is_dashed in edge_patterns:
        matches = re.findall(pattern, content)
        for source, target in matches:
            # Add source node if not already present
            if source not in nodes:
                nodes[source] = {
                    'id': source,
                    'label': source,
                    'icon': None,
                    'hasIcon': False
                }
                print(f"Found regular node from edge: {source}")

            # Add target node if not already present
            if target not in nodes:
                nodes[target] = {
                    'id': target,
                    'label': target,
                    'icon': None,
                    'hasIcon': False
                }
                print(f"Found regular node from edge: {target}")

            edges.append({
                'source': source,
                'target': target,
                'dashed': is_dashed
            })
            print(f"Found edge: {source} -> {target} (dashed: {is_dashed})")

    return nodes, edges

def clean_svg_for_drawio(svg_content):
    """Clean SVG content to make it compatible with draw.io."""
    import re

    # Create a minimal, clean SVG by extracting just the path elements
    # Find all path elements
    paths = re.findall(r'<path[^>]*d="[^"]*"[^>]*>', svg_content)

    if not paths:
        # Fallback to simple shape if no paths found
        return '<svg width="24" height="24" viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" fill="#d94723" stroke="#e1e1e1" stroke-width="1"/></svg>'

    # Create a clean SVG with just the essential paths
    clean_paths = []
    for path in paths:
        # Clean up the path by removing problematic attributes
        clean_path = re.sub(r'\s+(?:inkscape|sodipodi):[^=]*="[^"]*"', '', path)
        clean_paths.append(clean_path)

    # Construct minimal, hardened SVG for draw.io compatibility
    svg_header = '<svg width="80" height="80" viewBox="0 0 161.47 100.69" xmlns="http://www.w3.org/2000/svg">'
    svg_footer = '</svg>'

    # Add transform group to position correctly
    group_start = '<g transform="translate(-630.34 -504.88)">'
    group_end = '</g>'

    clean_svg = svg_header + group_start + ''.join(clean_paths) + group_end + svg_footer

    return clean_svg

def fetch_icon_svg(icon_ref, icon_service_url=None):
    """Fetch the SVG for an icon from the icon service."""
    if not icon_service_url:
        return None

    try:
        # Parse icon reference: "network:firewall" -> pack="network", id="firewall"
        if ':' not in icon_ref:
            return None

        pack, icon_id = icon_ref.split(':', 1)

        # Construct URL to fetch raw SVG
        url = f"{icon_service_url}/api/icons/packs/{pack}/contents/{icon_id}/raw"

        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            # Clean and prepare the SVG for draw.io
            svg_content = clean_svg_for_drawio(response.text)
            # Use percent-encoded SVG (no base64, no semicolons)
            from urllib.parse import quote
            payload = quote(svg_content, safe='')  # FULLY encoded
            return f"data:image/svg+xml,{payload}"  # no ;base64

    except Exception as e:
        print(f"Warning: Could not fetch icon {icon_ref}: {e}")

    return None

def parse_transform_translate(transform_str):
    if not transform_str: return (0.0, 0.0)
    m = re.search(r'translate\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)', transform_str)
    return (float(m.group(1)), float(m.group(2))) if m else (0.0, 0.0)

def extract_text(node_g):
    texts = []
    for t in node_g.findall('.//{http://www.w3.org/2000/svg}text'):
        txt = ''.join(t.itertext()).strip()
        if txt: texts.append(txt)
    return texts[0] if texts else ''

def get_rect_size(node_g):
    rect = node_g.find(".//{http://www.w3.org/2000/svg}rect[@class='basic label-container']")
    if rect is None:
        rects = node_g.findall('.//{http://www.w3.org/2000/svg}rect')
        for r in rects:
            if r.get('width') and r.get('height'):
                rect = r; break
    if rect is not None:
        try:
            w = float(rect.get('width')); h = float(rect.get('height'))
            x = float(rect.get('x', '0')); y = float(rect.get('y', '0'))
            return w, h, x, y
        except: pass

    # Default size for icon nodes
    return 80.0, 80.0, -40.0, -40.0

def extract_svg_positions(svg_file):
    """Extract positioning information from the rendered SVG."""
    ET.register_namespace('', 'http://www.w3.org/2000/svg')
    root = ET.parse(svg_file).getroot()
    ns = {'svg': 'http://www.w3.org/2000/svg'}

    positions = {}

    for g in root.findall('.//svg:g[@class]', ns):
        cls = g.get('class', '')
        if 'node' not in cls.split() and 'icon-shape' not in cls.split():
            continue

        gid = g.get('id')
        if not gid:
            continue

        # Extract node name from ID (flowchart-A-0 -> A)
        m = re.match(r'flowchart-([A-Za-z0-9_]+)-\d+', gid)
        if not m:
            continue

        node_name = m.group(1)

        # Get position and size
        tx, ty = parse_transform_translate(g.get('transform', ''))
        w, h, rx, ry = get_rect_size(g)
        x, y = tx + rx, ty + ry

        positions[node_name] = {
            'x': x, 'y': y, 'w': w, 'h': h
        }

    return positions

def build_mxgraph_enhanced(mermaid_nodes, mermaid_edges, svg_positions, icon_service_url=None, width=1000, height=600):
    """Build mxGraph XML using both mermaid source and SVG positioning."""
    root = ET.Element('mxGraphModel', dx='1466', dy='827', grid='1', gridSize='10', guides='1', tooltips='1',
                      connect='1', arrows='1', fold='1', page='1', pageScale='1', pageWidth=str(width),
                      pageHeight=str(height), math='0', shadow='0')
    root_el = ET.SubElement(root, 'root')
    ET.SubElement(root_el, 'mxCell', id='0')
    ET.SubElement(root_el, 'mxCell', id='1', parent='0')

    # Create nodes
    x_offset = 100  # For nodes without SVG positions
    for i, (node_id, node_info) in enumerate(mermaid_nodes.items()):
        label = node_info['label']

        # Get position from SVG, use calculated defaults if not found
        if node_id in svg_positions:
            pos = svg_positions[node_id]
        else:
            # Calculate position for nodes not in SVG (like missing B node)
            pos = {'x': x_offset + (i * 150), 'y': 100, 'w': 80, 'h': 50}
            print(f"Using calculated position for {node_id}: {pos}")

        # Determine style based on whether node has icon
        if node_info['hasIcon'] and node_info['icon']:
            # Try to fetch clean icon SVG
            icon_svg = fetch_icon_svg(node_info['icon'], icon_service_url)
            if icon_svg:
                # Fix A: Put image= LAST to avoid semicolon collision in data URI
                # Position text at bottom center for icon nodes
                style = "shape=image;imageBackground=none;imageBorder=none;whiteSpace=wrap;html=1;"
                style += "verticalLabelPosition=bottom;verticalAlign=top;labelPosition=center;align=center;"
                style += f"image={html.escape(icon_svg)}"  # image LAST, no trailing ';'
                # Make icon nodes larger for better visibility
                pos['w'] = max(pos['w'], 80)
                pos['h'] = max(pos['h'], 80)
            else:
                # Fallback for failed icon fetch
                style = "shape=hexagon;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;"
        else:
            # Regular rectangular node
            style = "shape=rectangle;rounded=2;whiteSpace=wrap;html=1;"

        # Create the cell
        cell_id = f"node-{node_id}"
        v = ET.SubElement(root_el, 'mxCell', id=cell_id, value=html.escape(label),
                         style=style, vertex='1', parent='1')
        geo = ET.SubElement(v, 'mxGeometry', x=str(pos['x']), y=str(pos['y']),
                           width=str(pos['w']), height=str(pos['h']))
        geo.set('as', 'geometry')

    # Create edges
    eid = 1000
    for edge in mermaid_edges:
        source_id = f"node-{edge['source']}"
        target_id = f"node-{edge['target']}"

        style = 'endArrow=block;html=1;rounded=0;'
        if edge['dashed']:
            style += 'dashed=1;dashPattern=3 3;'

        edge_elem = ET.SubElement(root_el, 'mxCell', id=str(eid), style=style,
                                 edge='1', parent='1', source=source_id, target=target_id)
        geo = ET.SubElement(edge_elem, 'mxGeometry', relative='1')
        geo.set('as', 'geometry')
        eid += 1

    return ET.tostring(root, encoding='unicode')

def wrap_as_drawio(mx_xml):
    mxfile = ET.Element('mxfile', host='app.diagrams.net', version='24.7.5')
    diag = ET.SubElement(mxfile, 'diagram', id='0', name='Page-1')
    diag.append(ET.fromstring(mx_xml))
    return ET.tostring(mxfile, encoding='unicode')

def main():
    parser = argparse.ArgumentParser(description='Enhanced Mermaid to draw.io converter')
    parser.add_argument('--svg', required=True, help='Input SVG file (rendered mermaid)')
    parser.add_argument('--mermaid', required=True, help='Input Mermaid source file')
    parser.add_argument('--out', required=True, help='Output file base name')
    parser.add_argument('--icon-service', help='Icon service base URL (e.g., http://localhost:8000)')
    args = parser.parse_args()

    # Parse the mermaid source
    with open(args.mermaid, 'r', encoding='utf-8') as f:
        mermaid_content = f.read()

    mermaid_nodes, mermaid_edges = parse_mermaid_source(mermaid_content)
    print(f"Parsed {len(mermaid_nodes)} nodes and {len(mermaid_edges)} edges from Mermaid source")

    # Extract positions from rendered SVG
    svg_positions = extract_svg_positions(args.svg)
    print(f"Extracted positions for {len(svg_positions)} nodes from SVG")

    # Build the draw.io XML
    mx_xml = build_mxgraph_enhanced(mermaid_nodes, mermaid_edges, svg_positions, args.icon_service)

    # Write output
    with open(f"{args.out}.drawio", 'w', encoding='utf-8') as f:
        f.write(wrap_as_drawio(mx_xml))

    print(f"Generated {args.out}.drawio")

if __name__ == '__main__': main()