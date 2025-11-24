# Test Samples for diagrams.net Conversion

This directory contains sample SVG files generated from Mermaid diagrams to test the diagrams.net conversion functionality.

## Test Cases

### 1. Basic Flowchart (`flowchart-basic.svg`)
- Simple flowchart with rectangles and decision diamond
- Basic connections and text labels
- Tests fundamental shape conversion

### 2. Complex Architecture (`architecture-aws.svg`)
- Architecture diagram with custom icons
- Multiple node types and connections
- Tests icon preservation and complex layouts

### 3. Sequence Diagram (`sequence-basic.svg`)
- Simple sequence diagram
- Tests line-based diagrams and text positioning

## Usage

Use these samples to test the `/diagram/diagramsnet` endpoint:

```bash
curl -X POST http://localhost:8001/diagram/diagramsnet \
  -H "Content-Type: application/json" \
  -d '{
    "svg_content": "$(cat test-samples/flowchart-basic.svg)",
    "format": "xml"
  }'
```

The response will include:
- Converted diagrams.net XML
- Quality assessment score
- Detailed conversion metrics