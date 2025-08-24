#!/bin/bash

# Minimal production icon installation using curl
# For servers without Node.js - installs a basic icon set

set -e

API_URL=${1:-"http://localhost:8000"}

echo "🚀 Installing minimal icon set for production..."
echo "API URL: $API_URL"

# Test API connectivity
if ! curl -f -s "$API_URL/health" > /dev/null; then
    echo "❌ Cannot connect to API at $API_URL"
    exit 1
fi

echo "✅ API connected"

# Clear existing packs
echo "Clearing existing icon packs..."
EXISTING_PACKS=$(curl -s "$API_URL/icons/packs" | jq -r '.packs[]?.name // empty' 2>/dev/null || echo "")

if [ -n "$EXISTING_PACKS" ]; then
    while IFS= read -r pack_name; do
        if [ -n "$pack_name" ]; then
            echo "Deleting pack: $pack_name"
            curl -X DELETE "$API_URL/icons/packs/$pack_name" -s > /dev/null || true
        fi
    done <<< "$EXISTING_PACKS"
fi

# Install minimal AWS icon pack
echo "Installing minimal AWS icon pack..."

AWS_PACK_JSON='{
  "pack_data": {
    "name": "aws-minimal",
    "display_name": "AWS Services (Minimal)",
    "category": "cloud",
    "description": "Essential AWS service icons",
    "icons": {
      "lambda": {
        "search_terms": "lambda aws serverless function compute",
        "icon_data": {
          "body": "<path d=\"M12 2L2 7v10l10 5 10-5V7L12 2z\"/>",
          "viewBox": "0 0 24 24",
          "width": 24,
          "height": 24
        }
      },
      "s3": {
        "search_terms": "s3 aws storage bucket cloud",
        "icon_data": {
          "body": "<path d=\"M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z\"/>",
          "viewBox": "0 0 24 24",
          "width": 24,
          "height": 24
        }
      },
      "ec2": {
        "search_terms": "ec2 aws compute server instance virtual",
        "icon_data": {
          "body": "<path d=\"M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z\"/>",
          "viewBox": "0 0 24 24",
          "width": 24,
          "height": 24
        }
      }
    }
  },
  "mapping_config": {
    "name": "name",
    "display_name": "display_name",
    "category": "category",
    "description": "description",
    "icons_data": "icons"
  },
  "package_type": "json"
}'

RESPONSE=$(curl -X POST "$API_URL/icons/packs" \
  -H "Content-Type: application/json" \
  -d "$AWS_PACK_JSON" \
  -s)

if echo "$RESPONSE" | jq -e '.icon_count' > /dev/null 2>&1; then
    ICON_COUNT=$(echo "$RESPONSE" | jq -r '.icon_count')
    echo "✅ Installed AWS minimal pack: $ICON_COUNT icons"
else
    echo "❌ Failed to install AWS pack"
    echo "Response: $RESPONSE"
    exit 1
fi

# Install minimal logos pack
echo "Installing minimal logos pack..."

LOGOS_PACK_JSON='{
  "pack_data": {
    "name": "logos-minimal",
    "display_name": "Technology Logos (Minimal)",
    "category": "logos",
    "description": "Essential technology and brand logos",
    "icons": {
      "docker": {
        "search_terms": "docker container technology logo",
        "icon_data": {
          "body": "<path d=\"M4 7v2h2V7H4zm3 0v2h2V7H7zm3 0v2h2V7h-2zm3 0v2h2V7h-2zm3 0v2h2V7h-2zm0-3v2h2V4h-2zm-3 0v2h2V4h-2zm-3 0v2h2V4h-2z\"/>",
          "viewBox": "0 0 24 24",
          "width": 24,
          "height": 24
        }
      },
      "kubernetes": {
        "search_terms": "kubernetes k8s container orchestration logo",
        "icon_data": {
          "body": "<path d=\"M12 2l9 5v10l-9 5-9-5V7l9-5z\"/>",
          "viewBox": "0 0 24 24",
          "width": 24,
          "height": 24
        }
      },
      "postgresql": {
        "search_terms": "postgresql postgres database sql logo",
        "icon_data": {
          "body": "<path d=\"M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z\"/>",
          "viewBox": "0 0 24 24",
          "width": 24,
          "height": 24
        }
      }
    }
  },
  "mapping_config": {
    "name": "name",
    "display_name": "display_name",
    "category": "category",
    "description": "description",
    "icons_data": "icons"
  },
  "package_type": "json"
}'

RESPONSE=$(curl -X POST "$API_URL/icons/packs" \
  -H "Content-Type: application/json" \
  -d "$LOGOS_PACK_JSON" \
  -s)

if echo "$RESPONSE" | jq -e '.icon_count' > /dev/null 2>&1; then
    ICON_COUNT=$(echo "$RESPONSE" | jq -r '.icon_count')
    echo "✅ Installed logos minimal pack: $ICON_COUNT icons"
else
    echo "❌ Failed to install logos pack"
    echo "Response: $RESPONSE"
    exit 1
fi

# Verify installation
echo "Verifying installation..."
PACK_COUNT=$(curl -s "$API_URL/icons/packs" | jq -r '.total // 0' 2>/dev/null || echo "0")
echo "Total packs installed: $PACK_COUNT"

SEARCH_RESULT=$(curl -s "$API_URL/icons/search?q=aws&size=5" | jq -r '.total // 0' 2>/dev/null || echo "0")
echo "AWS search test: $SEARCH_RESULT icons found"

echo "✅ Minimal production icon installation complete!"
