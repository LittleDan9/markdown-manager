#!/usr/bin/env python3
# Mermaid SVG → draw.io editable SVG converter
# Author: ChatGPT

import argparse, base64, html, json, re, urllib.parse
from xml.etree import ElementTree as ET

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
    
    # For icon nodes, look for path elements to estimate size
    paths = node_g.findall('.//{http://www.w3.org/2000/svg}path')
    if paths:
        # Use a reasonable default size for icon nodes
        return 80.0, 80.0, -40.0, -40.0
    
    return 120.0, 48.0, -60.0, -24.0

def extract_inner_svg_as_data_uri(node_g):
    # Look for nested SVG elements
    nested = node_g.find('.//{http://www.w3.org/2000/svg}svg')
    if nested is not None:
        # Clean up the nested SVG and make it simpler
        # Remove complex metadata and simplify
        svg_copy = ET.Element('{http://www.w3.org/2000/svg}svg')
        svg_copy.set('xmlns', 'http://www.w3.org/2000/svg')
        svg_copy.set('viewBox', nested.get('viewBox', '0 0 100 100'))
        svg_copy.set('width', '48')
        svg_copy.set('height', '48')
        
        # Copy only essential drawing elements, skip metadata
        for child in nested:
            if child.tag.endswith('}metadata'):
                continue
            svg_copy.append(child)
        
        # Create a clean SVG string without unnecessary attributes
        svg_str = ET.tostring(svg_copy, encoding='unicode')
        # URL encode instead of base64 for better compatibility
        encoded = urllib.parse.quote(svg_str)
        return f'data:image/svg+xml,{encoded}'
    
    # For icon nodes without nested SVG, try to create a simple geometric shape instead
    # This is more reliable than complex path extraction
    return None

def build_mxgraph(nodes, edges, width=1000, height=600):
    root = ET.Element('mxGraphModel', dx='1466', dy='827', grid='1', gridSize='10', guides='1', tooltips='1',
                      connect='1', arrows='1', fold='1', page='1', pageScale='1', pageWidth=str(width),
                      pageHeight=str(height), math='0', shadow='0')
    root_el = ET.SubElement(root, 'root')
    ET.SubElement(root_el, 'mxCell', id='0')
    ET.SubElement(root_el, 'mxCell', id='1', parent='0')
    for nid, info in nodes.items():
        label = info.get('label', '')
        img = info.get('imageURI')
        if img:
            # Use a more compatible image style for draw.io
            style = f"shape=image;image={html.escape(img)};imageBackground=none;imageBorder=none;whiteSpace=wrap;html=1;"
        elif info.get('iconFallback'):
            # Use a distinctive shape for icon nodes that couldn't be converted
            style = "shape=hexagon;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;"
        else:
            style = "shape=rectangle;rounded=2;whiteSpace=wrap;html=1;"
        v = ET.SubElement(root_el, 'mxCell', id=nid, value=html.escape(label), style=style, vertex='1', parent='1')
        geo = ET.SubElement(v, 'mxGeometry', x=str(info['x']), y=str(info['y']), width=str(info['w']), height=str(info['h']))
        geo.set('as', 'geometry')
    eid = 1000
    for e in edges:
        st = 'endArrow=block;html=1;rounded=0;'
        if e.get('dashed'): st += 'dashed=1;dashPattern=3 3;'
        edge = ET.SubElement(root_el, 'mxCell', id=str(eid), style=st, edge='1', parent='1', source=e['source'], target=e['target'])
        geo = ET.SubElement(edge, 'mxGeometry', relative='1')
        geo.set('as', 'geometry'); eid += 1
    return ET.tostring(root, encoding='unicode')

def wrap_as_drawio(mx_xml):
    mxfile = ET.Element('mxfile', host='app.diagrams.net', version='24.7.5')
    diag = ET.SubElement(mxfile, 'diagram', id='0', name='Page-1')
    diag.append(ET.fromstring(mx_xml))
    return ET.tostring(mxfile, encoding='unicode')

def wrap_as_editable_svg(mx_xml, width=1000, height=600):
    data_attr = html.escape(json.dumps({'dx':1466,'dy':827,'scale':1,'grid':1,'gridSize':10,'page':1,
                                        'pageWidth':width,'pageHeight':height,'graphModel':mx_xml}))
    return f"""<svg xmlns='http://www.w3.org/2000/svg' width='{width}' height='{height}' viewBox='0 0 {width} {height}'>
  <switch>
    <foreignObject width='100%' height='100%'>
      <div xmlns='http://www.w3.org/1999/xhtml' style='width:100%;height:100%;'>
        <div class='mxgraph' data-mxgraph='{data_attr}'></div>
      </div>
    </foreignObject>
    <text x='50%' y='50%' text-anchor='middle'>Viewer does not support embedded HTML.</text>
  </switch>
</svg>"""

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--in', dest='input_svg', required=True)
    parser.add_argument('--out', dest='out_base', required=True)
    args = parser.parse_args()

    ET.register_namespace('', 'http://www.w3.org/2000/svg')
    root = ET.parse(args.input_svg).getroot()
    ns = {'svg': 'http://www.w3.org/2000/svg'}

    nodes = {}
    for g in root.findall('.//svg:g[@class]', ns):
        cls = g.get('class','')
        # Accept both regular nodes and icon-shape nodes
        if 'node' not in cls.split() and 'icon-shape' not in cls.split(): continue
        gid = g.get('id') or f'node_{len(nodes)+1}'
        tx,ty = parse_transform_translate(g.get('transform',''))
        w,h,rx,ry = get_rect_size(g); x=tx+rx; y=ty+ry
        info={'label':extract_text(g),'x':x,'y':y,'w':w,'h':h}
        # Handle icon-shape nodes
        if 'icon-shape' in cls:
            uri=extract_inner_svg_as_data_uri(g)
            if uri: 
                info['imageURI']=uri
                # For icon nodes, make them a bit larger to accommodate the icon
                if info['w'] < 80:
                    info['w'] = 80
                if info['h'] < 80:
                    info['h'] = 80
            else:
                # Fallback: use a distinctive shape for icon nodes that can't be converted
                info['iconFallback'] = True
        nodes[gid]=info

    name_by_gid={}
    for gid in nodes:
        m=re.match(r'flowchart-([A-Za-z0-9_]+)-\d+',gid)
        if m: name_by_gid[m.group(1)]=gid

    edges=[]
    for p in root.findall('.//svg:path[@data-id]', ns):
        did=p.get('data-id') or p.get('id') or ''
        m=re.match(r'L_([A-Za-z0-9_]+)_([A-Za-z0-9_]+)_\d+',did)
        if not m: continue
        sname,tname=m.group(1),m.group(2)
        sgid,tgid=name_by_gid.get(sname),name_by_gid.get(tname)
        if sgid and tgid:
            dashed=('edge-pattern-dotted' in (p.get('class') or '')) or ('edge-pattern-dashed' in (p.get('class') or ''))
            edges.append({'source':sgid,'target':tgid,'dashed':dashed})

    width,height=1000,600
    vb=root.get('viewBox','')
    if vb:
        parts=[float(x) for x in vb.split()]
        if len(parts)==4: width=max(int(parts[2]+100),600); height=max(int(parts[3]+100),400)

    mx_xml=build_mxgraph(nodes,edges,width,height)
    with open(args.out_base+'.drawio','w',encoding='utf-8') as f: f.write(wrap_as_drawio(mx_xml))
    with open(args.out_base+'.editable.svg','w',encoding='utf-8') as f: f.write(wrap_as_editable_svg(mx_xml,width,height))

if __name__=='__main__': main()
