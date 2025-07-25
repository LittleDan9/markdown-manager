#!/usr/bin/env bash

FRONTEND_DIR=$1
BACKEND_DIR=$2
export PYTHON_PATH=/usr/bin/python
source ./scripts/colors.sh

echo "$YELLOW📦 Installing dependencies...$NC"
pushd $FRONTEND_DIR && npm install && popd
pushd $BACKEND_DIR && ~/.local/bin/poetry lock && ~/.local/bin/poetry install --no-root && ~/.local/bin/poetry run playwright install-deps && ~/.local/bin/poetry run playwright install chromium && popd
echo "$GREEN✅ All dependencies installed$NC"