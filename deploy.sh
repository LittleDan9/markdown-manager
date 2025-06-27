#!/bin/bash
set -e

echo "Building production assets..."
npx webpack --mode production

echo "Deploying to server..."
echo "$(hostname)"
if [[ "$(hostname)" == "Danbian" ]]; then
    destination="/var/www/littledan.com/"
else
    destination="dlittle@10.0.1.51:/var/www/littledan.com/"
fi

rsync -r --no-perms --no-times --no-group dist/ "$destination"
echo "Deployment complete!"
