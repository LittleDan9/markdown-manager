"""Test data fixtures for Draw.io export service tests."""

from typing import Dict, Any, List

# Sample Mermaid source code for testing
MERMAID_FLOWCHART_BASIC = """
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Process A]
    B -->|No| D[Process B]
    C --> E[End]
    D --> E
"""

MERMAID_FLOWCHART_WITH_ICONS = """
graph TD
    A[User] --> B{Authentication}
    B -->|Success| C[🏠 Dashboard]
    B -->|Fail| D[❌ Error Page]
    C --> E[📊 Analytics]
    C --> F[⚙️ Settings]
"""

MERMAID_SEQUENCE_BASIC = """
sequenceDiagram
    participant A as Alice
    participant B as Bob
    A->>B: Hello Bob!
    B-->>A: Hello Alice!
    A->>B: How are you?
    B-->>A: I'm good, thanks!
"""

MERMAID_ARCHITECTURE_AWS = """
graph TB
    subgraph "AWS Cloud"
        direction TB
        LB[Load Balancer]
        EC2[EC2 Instance]
        RDS[(RDS Database)]
        S3[S3 Bucket]
    end

    User[👤 User] --> LB
    LB --> EC2
    EC2 --> RDS
    EC2 --> S3
"""

# Sample SVG content (simplified for testing)
SVG_FLOWCHART_BASIC = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
  <g id="Start" transform="translate(50,50)">
    <rect width="100" height="40" rx="5" fill="#e1f5fe" stroke="#01579b"/>
    <text x="50" y="25" text-anchor="middle" fill="#01579b">Start</text>
  </g>
  <g id="Decision" transform="translate(200,100)">
    <polygon points="0,20 20,0 40,20 20,40" fill="#fff3e0" stroke="#e65100"/>
    <text x="20" y="25" text-anchor="middle" fill="#e65100">Decision</text>
  </g>
  <g id="ProcessA" transform="translate(100,200)">
    <rect width="100" height="40" rx="5" fill="#e8f5e8" stroke="#2e7d32"/>
    <text x="50" y="25" text-anchor="middle" fill="#2e7d32">Process A</text>
  </g>
  <g id="ProcessB" transform="translate(300,200)">
    <rect width="100" height="40" rx="5" fill="#e8f5e8" stroke="#2e7d32"/>
    <text x="50" y="25" text-anchor="middle" fill="#2e7d32">Process B</text>
  </g>
  <g id="End" transform="translate(200,280)">
    <rect width="80" height="40" rx="5" fill="#fce4ec" stroke="#c2185b"/>
    <text x="40" y="25" text-anchor="middle" fill="#c2185b">End</text>
  </g>
</svg>'''

SVG_WITH_ICONS = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 400">
  <g id="User" transform="translate(50,50)">
    <rect width="80" height="40" rx="5" fill="#e1f5fe" stroke="#01579b"/>
    <text x="40" y="25" text-anchor="middle" fill="#01579b">User</text>
  </g>
  <g id="Dashboard" transform="translate(200,150)">
    <rect width="100" height="40" rx="5" fill="#e8f5e8" stroke="#2e7d32"/>
    <text x="50" y="15" text-anchor="middle" fill="#2e7d32">🏠 Dashboard</text>
  </g>
  <g id="Analytics" transform="translate(150,250)">
    <rect width="100" height="40" rx="5" fill="#fff3e0" stroke="#e65100"/>
    <text x="50" y="15" text-anchor="middle" fill="#e65100">📊 Analytics</text>
  </g>
  <g id="Settings" transform="translate(300,250)">
    <rect width="100" height="40" rx="5" fill="#fce4ec" stroke="#c2185b"/>
    <text x="50" y="15" text-anchor="middle" fill="#c2185b">⚙️ Settings</text>
  </g>
</svg>'''

# Expected Draw.io XML structure (simplified)
EXPECTED_DRAWIO_XML_TEMPLATE = '''<mxfile host="app.diagrams.net" modified="2025-11-20T00:00:00.000Z" agent="DrawioExportService/24.7.5" version="24.7.5">
  <diagram name="Mermaid Diagram" id="test-diagram">
    <mxGraphModel dx="1000" dy="600" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1000" pageHeight="600">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <!-- Generated nodes and edges would be here -->
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>'''

# Mock icon SVG responses
MOCK_ICON_HOME = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path d="M12 2L2 7v10c0 5.55 3.84 10 9 10s9-4.45 9-10V7l-10-5z" fill="currentColor"/>
</svg>'''

MOCK_ICON_ANALYTICS = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" fill="currentColor"/>
</svg>'''

MOCK_ICON_SETTINGS = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97 0-.33-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1 0 .33.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66Z" fill="currentColor"/>
</svg>'''

# Test cases for quality assessment
QUALITY_TEST_CASES = [
    {
        "name": "perfect_conversion",
        "original_nodes": {"A": {}, "B": {}, "C": {}},
        "converted_nodes": 3,
        "original_edges": 2,
        "converted_edges": 2,
        "icons_attempted": 2,
        "icons_successful": 2,
        "expected_score_range": (90, 100)
    },
    {
        "name": "good_conversion",
        "original_nodes": {"A": {}, "B": {}, "C": {}, "D": {}},
        "converted_nodes": 4,
        "original_edges": 3,
        "converted_edges": 3,
        "icons_attempted": 3,
        "icons_successful": 2,
        "expected_score_range": (75, 89)
    },
    {
        "name": "fair_conversion",
        "original_nodes": {"A": {}, "B": {}, "C": {}, "D": {}, "E": {}},
        "converted_nodes": 4,  # Missing one node
        "original_edges": 4,
        "converted_edges": 3,  # Missing one edge
        "icons_attempted": 3,
        "icons_successful": 1,  # Low icon success
        "expected_score_range": (60, 74)
    },
    {
        "name": "poor_conversion",
        "original_nodes": {"A": {}, "B": {}, "C": {}, "D": {}, "E": {}},
        "converted_nodes": 2,  # Missing many nodes
        "original_edges": 4,
        "converted_edges": 1,  # Missing many edges
        "icons_attempted": 4,
        "icons_successful": 0,  # No icons successful
        "expected_score_range": (0, 59)
    }
]

# Error test scenarios
ERROR_TEST_SCENARIOS = [
    {
        "name": "invalid_mermaid_syntax",
        "mermaid_source": "invalid mermaid syntax @@@ error",
        "svg_content": SVG_FLOWCHART_BASIC,
        "expected_error": "Invalid Mermaid syntax"
    },
    {
        "name": "malformed_svg",
        "mermaid_source": MERMAID_FLOWCHART_BASIC,
        "svg_content": "<svg>malformed</invalid>",
        "expected_error": "Invalid SVG content"
    },
    {
        "name": "empty_inputs",
        "mermaid_source": "",
        "svg_content": "",
        "expected_error": "Empty input data"
    },
    {
        "name": "network_timeout",
        "mermaid_source": MERMAID_FLOWCHART_WITH_ICONS,
        "svg_content": SVG_WITH_ICONS,
        "icon_service_url": "http://timeout-service:9999",
        "expected_behavior": "graceful_degradation"
    }
]

# Performance test data
PERFORMANCE_TEST_DATA = {
    "large_flowchart": """
graph TD
    """ + "\n    ".join([f"N{i}[Node {i}] --> N{i+1}[Node {i+1}]" for i in range(100)]),

    "complex_architecture": """
graph TB
    subgraph "Frontend"
        """ + "\n        ".join([f"FE{i}[Frontend {i}]" for i in range(20)]) + """
    end
    subgraph "Backend"
        """ + "\n        ".join([f"BE{i}[Backend {i}]" for i in range(20)]) + """
    end
    subgraph "Database"
        """ + "\n        ".join([f"DB{i}[(Database {i})]" for i in range(10)]) + """
    end
    """ + "\n    ".join([f"FE{i} --> BE{i}" for i in range(10)]) + """
    """ + "\n    ".join([f"BE{i} --> DB{i//2}" for i in range(10)])
}

# Mock HTTP responses for icon service testing
MOCK_HTTP_RESPONSES = {
    "http://localhost:8000/api/icons/home": {
        "status_code": 200,
        "content": MOCK_ICON_HOME,
        "headers": {"content-type": "image/svg+xml"}
    },
    "http://localhost:8000/api/icons/packs/general/contents/home/raw": {
        "status_code": 200,
        "content": MOCK_ICON_HOME,
        "headers": {"content-type": "image/svg+xml"}
    },
    "http://localhost:8000/api/icons/analytics": {
        "status_code": 200,
        "content": MOCK_ICON_ANALYTICS,
        "headers": {"content-type": "image/svg+xml"}
    },
    "http://localhost:8000/api/icons/packs/general/contents/analytics/raw": {
        "status_code": 200,
        "content": MOCK_ICON_ANALYTICS,
        "headers": {"content-type": "image/svg+xml"}
    },
    "http://localhost:8000/api/icons/settings": {
        "status_code": 200,
        "content": MOCK_ICON_SETTINGS,
        "headers": {"content-type": "image/svg+xml"}
    },
    "http://localhost:8000/api/icons/packs/general/contents/settings/raw": {
        "status_code": 200,
        "content": MOCK_ICON_SETTINGS,
        "headers": {"content-type": "image/svg+xml"}
    },
    "http://timeout-service:9999/api/icons/any": {
        "status_code": "timeout",
        "content": None,
        "headers": {}
    },
    "http://error-service:8001/api/icons/any": {
        "status_code": 404,
        "content": "Not Found",
        "headers": {"content-type": "text/plain"}
    }
}

# Expected test results for validation
EXPECTED_TEST_RESULTS = {
    "mermaid_parsing": {
        "basic_flowchart_nodes": 3,  # C, D, E (nodes found from plain arrows)
        "basic_flowchart_edges": 2,  # C->E, D->E (connections without decorations)
        "with_icons_nodes": 4,       # User, Dashboard, Analytics, Settings
        "sequence_participants": 2    # Alice, Bob
    },
    "svg_positioning": {
        "start_node_x": 50,
        "start_node_y": 50,
        "decision_node_x": 200,
        "decision_node_y": 100
    },
    "quality_thresholds": {
        "excellent": 90,
        "good": 75,
        "fair": 60,
        "poor": 0
    }
}