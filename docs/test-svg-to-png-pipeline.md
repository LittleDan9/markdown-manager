# Phase 6 Test with Advanced Diagrams

This document tests the diagram conversion workflow.

## Architecture Diagram

![Diagram](.markdown-manager/diagrams/diagram_7ecb48beeb13.png)

<details>
<summary>📊 View diagram source (click to expand)</summary>

```mermaid
architecture-beta
    group api(cloud)[API Layer]
    
    service db(database)[Database] in api
    service cache(disk)[Cache] in api
    
    db:L -- R:cache
```
</details>

## Custom Icon Diagram

![Diagram](.markdown-manager/diagrams/diagram_653f09d423d3.png)

<details>
<summary>📊 View diagram source (click to expand)</summary>

```mermaid
flowchart LR
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    
    classDef startClass fill:#e1f5fe,stroke:#01579b,stroke-width:2px,icon:aws:compute
    classDef actionClass fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,icon:azure:storage
    
    class A startClass
    class C,D actionClass
```
</details>