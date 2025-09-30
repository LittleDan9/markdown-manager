#!/usr/bin/env bash

FRONTEND_DIR=$1
API_DIR=$2
PDF_DIR=$3
LINT_DIR=$4
EXIT_CODE=0

export PYTHON_PATH=/usr/bin/python
source ./scripts/colors.sh

echo ""
echo "$YELLOW📦 Installing frontend dependencies...$NC"
pushd $FRONTEND_DIR > /dev/null
npm install
if [ $? -ne 0 ]; then
  echo "$RED❌ Failed to install frontend dependencies$NC"
  EXIT_CODE=1
else
  echo "$GREEN✅ Frontend dependencies installed$NC"
fi
popd > /dev/null

echo ""
echo "$YELLOW📦 Installing API dependencies...$NC"
pushd $API_DIR > /dev/null

~/.local/bin/poetry lock && ~/.local/bin/poetry install --no-root

if [ ! -f ".env" ]; then
  echo ""
  echo "$BLUE🔧 Creating sample .env file.$NC"

  cat > .env <<EOF
ENVIRONMENT=development
DEBUG=False
HOST=0.0.0.0
PORT=8000
PROJECT_NAME=Markdown Manager API
API_DESCRIPTION=API for managing markdown documents, categories, and users.
API_VERSION=1.0.0
DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/markdown_manager
DATABASE_ECHO=False
SECRET_KEY=your-secret-key-here-change-in-production-make-it-long-and-random
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
SECURE_COOKIES=False
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
FROM_EMAIL=no-reply@example.com
SMTP_USE_TLS=True
DEFAULT_PAGE_SIZE=20
MAX_PAGE_SIZE=100
EXPORT_SERVICE_URL=http://export-service:8001
MARKDOWN_LINT_SERVICE_URL=http://markdown-lint-service:8002
EOF

fi

if [ $? -ne 0 ]; then
  echo "$RED❌ Failed to install API dependencies$NC"
  EXIT_CODE=2
else
  echo "$GREEN✅ API dependencies installed$NC"
fi
popd > /dev/null

echo ""
echo "$YELLOW📦 Installing PDF dependencies...$NC"
pushd $PDF_DIR > /dev/null

~/.local/bin/poetry lock && \
~/.local/bin/poetry install --no-root && \
~/.local/bin/poetry run playwright install chromium && \
~/.local/bin/poetry run playwright install-deps chromium

if [ $? -ne 0 ]; then
  echo "$RED❌ Failed to install PDF dependencies$NC"
  EXIT_CODE=3
else
  echo "$GREEN✅ PDF dependencies installed$NC"
fi
popd > /dev/null

echo ""
echo "$YELLOW📦 Installing markdown lint dependencies...$NC"
pushd $LINT_DIR > /dev/null

npm install

if [ $? -ne 0 ]; then
  echo "$RED❌ Failed to install markdown lint dependencies$NC"
  EXIT_CODE=4
else
  echo "$GREEN✅ Markdown lint dependencies installed$NC"
fi
popd > /dev/null

echo ""

if [ $EXIT_CODE -eq 0 ]; then
  echo "$GREEN✅ All dependencies installed$NC"
else
  echo "$RED❌ Some dependencies failed to install$NC"
  exit $EXIT_CODE
fi