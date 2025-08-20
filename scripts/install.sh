#!/usr/bin/env bash

FRONTEND_DIR=$1
API_DIR=$2
PDF_DIR=$3
export PYTHON_PATH=/usr/bin/python
source ./scripts/colors.sh

echo "$YELLOW📦 Installing dependencies...$NC"
pushd $FRONTEND_DIR && npm install && popd
pushd $API_DIR && ~/.local/bin/poetry lock && ~/.local/bin/poetry install --no-root && popd
pushd $PDF_DIR && ~/.local/bin/poetry lock && ~/.local/bin/poetry install --no-root && ~/.local/bin/poetry run playwright install-deps && ~/.local/bin/poetry run playwright install chromium && popd
echo "$GREEN✅ All dependencies installed$NC"