#!/usr/bin/env python3
"""Update export service endpoints to cleaner structure."""

import re

def update_endpoints():
    """Update the export service endpoints."""
    file_path = "/home/dlittle/code/markdown-manager/export-service/app/main.py"

    # Read the file
    with open(file_path, 'r') as f:
        content = f.read()

    # Update endpoints
    content = re.sub(r'@app\.post\("/generate-pdf"\)', '@app.post("/document/pdf")', content)
    content = re.sub(r'@app\.post\("/export-diagram-svg"\)', '@app.post("/diagram/svg")', content)
    content = re.sub(r'@app\.post\("/export-diagram-png"\)', '@app.post("/diagram/png")', content)

    # Write back
    with open(file_path, 'w') as f:
        f.write(content)

    print("Updated export service endpoints:")
    print("- /generate-pdf -> /document/pdf")
    print("- /export-diagram-svg -> /diagram/svg")
    print("- /export-diagram-png -> /diagram/png")

if __name__ == "__main__":
    update_endpoints()