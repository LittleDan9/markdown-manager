#!/bin/bash

# Validate production category migration order
# Run this BEFORE applying the migration to production

echo "=== Production Category Validation ==="
echo "Checking category order that will be created by migration..."

# SSH to production and check current category strings
ssh dlittle@10.0.1.51 "cd markdown-manager && docker-compose exec -T db psql -U postgres -d markdown_manager -c \"
SELECT DISTINCT category, COUNT(*) as doc_count
FROM documents
WHERE category IS NOT NULL AND category != ''
GROUP BY category
ORDER BY category;
\""

echo ""
echo "Expected category ID assignments:"
echo "1: General"
echo "2: Genius"
echo "3: KS"
echo "4: MO"
echo "5: Portal"
echo ""
echo "✅ If the alphabetical order above matches expected IDs, migration is safe to proceed"
