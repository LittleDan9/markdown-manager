// Test script for icon extraction patterns
function extractIconReferences(diagramSource) {
  const iconReferences = [];

  // Pattern to match icon references in architecture diagrams
  // Examples: icon:aws-icons:EC2, icon(aws-icons:S3), service(aws-icons:RDS), etc.
  const iconPatterns = [
    /icon\s*:\s*([^:\s\]]+)\s*:\s*([^)\s,\]]+)/gi,  // icon:pack:iconname (in brackets like [icon:pack:name])
    /icon\s*\(\s*([^:\s]+)\s*:\s*([^)\s,]+)\s*\)/gi,  // icon(pack:iconname)
    /service\s+\w+\s*\(\s*([^:\s]+)\s*:\s*([^)\s,]+)\s*\)/gi, // service name(pack:iconname) for architecture diagrams
    /\(\s*([^:\s]+)\s*:\s*([^)\s,]+)\s*\)/g, // Generic (pack:iconname) pattern
  ];

  iconPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(diagramSource)) !== null) {
      const pack = match[1].trim();
      const icon = match[2].trim();

      // Skip if it doesn't look like an icon pack reference
      if (pack.length === 0 || icon.length === 0) continue;

      // Avoid duplicates
      if (!iconReferences.some(ref => ref.pack === pack && ref.icon === icon)) {
        iconReferences.push({ pack, icon });
      }
    }
  });

  console.log(`Extracted ${iconReferences.length} icon references:`, iconReferences);
  return iconReferences;
}

// Test cases
const testDiagrams = [
  // Architecture diagram with icon references
  `architecture-beta
    group api(cloud)[API]
    service database(aws-icons:RDS) in api
    service web(aws-icons:EC2) in api
    service cache(aws-icons:ElastiCache) in api

    web:R --> database
    web:R --> cache`,

  // Simple flowchart with icons
  `flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[icon:aws-icons:S3]
    B -->|No| D[icon(logos:docker)]
    C --> E[End]
    D --> E`,

  // Mixed diagram
  `graph TD
    subgraph "AWS Cloud"
        service(aws-icons:EC2)
        storage[icon:aws-icons:S3]
    end

    user[User] --> service
    service --> storage`
];

console.log('Testing icon extraction patterns...\n');

testDiagrams.forEach((diagram, index) => {
  console.log(`Test ${index + 1}:`);
  console.log('Diagram:', diagram.replace(/\n/g, '\\n'));
  const icons = extractIconReferences(diagram);
  console.log('Extracted icons:', icons);
  console.log('---\n');
});
