#!/usr/bin/env python3
import re

content = '''# Phase 6 Test with Advanced Diagrams

This document tests the diagram conversion workflow.

## Architecture Diagram

```mermaid
architecture-beta
    group api(cloud)[API Layer]

    service db(database)[Database] in api
    service cache(disk)[Cache] in api

    db:L -- R:cache
```

## Custom Icon Diagram

```mermaid
flowchart LR
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]

    classDef startClass fill:#e1f5fe,stroke:#01579b,stroke-width:2px,icon:aws:compute
    classDef actionClass fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,icon:azure:storage

    class A startClass
    class C,D actionClass
```'''

# Test the Mermaid block extraction
pattern = r'```mermaid\n(.*?)\n```'
blocks = []
for match in re.finditer(pattern, content, re.DOTALL):
    blocks.append({
        'code': match.group(1).strip(),
        'start': match.start(),
        'end': match.end()
    })

print(f'Found {len(blocks)} Mermaid blocks')
for i, block in enumerate(blocks):
    print(f'Block {i}: {block["code"][:50]}...')

# Test advanced pattern detection
advanced_patterns = [
    r'architecture-beta',
    r'icon\s*:\s*["\']?\w+:',
]

for i, block in enumerate(blocks):
    print(f'Block {i} advanced features:')
    for j, pattern in enumerate(advanced_patterns):
        if re.search(pattern, block['code'], re.IGNORECASE):
            print(f'  - Pattern {j} ({pattern}) matched')