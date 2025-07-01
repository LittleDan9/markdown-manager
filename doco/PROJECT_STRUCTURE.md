# Proposed Project Structure

## New Directory Layout

```
markdown-manager/
├── frontend/                    # Current frontend code
│   ├── src/
│   │   ├── index.html
│   │   ├── assets/
│   │   ├── js/
│   │   └── styles/
│   ├── package.json
│   ├── webpack.config.js
│   └── dist/                    # Build output
├── backend/                     # New FastAPI backend
│   ├── pyproject.toml          # Poetry configuration
│   ├── poetry.lock
│   ├── README.md
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py             # FastAPI app
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   └── v1/
│   │   │       ├── __init__.py
│   │   │       └── endpoints/
│   │   │           ├── __init__.py
│   │   │           └── health.py
│   │   └── core/
│   │       ├── __init__.py
│   │       └── config.py
│   └── tests/
├── nginx/                       # Nginx configuration
│   ├── nginx.conf              # Main nginx config for this project
│   └── sites-available/
│       └── littledan.com
├── deploy/                      # Deployment scripts
│   ├── deploy.sh               # Updated deployment script
│   ├── deploy.js               # Node.js deployment script
│   └── deploy.config.js
├── docker/                      # Optional: Docker configurations
│   ├── Dockerfile.frontend
│   ├── Dockerfile.backend
│   └── docker-compose.yml
├── README.md                    # Updated project README
└── .gitignore                   # Updated gitignore
```

## Key Benefits

1. **Clear Separation**: Frontend and backend are clearly separated
2. **Scalable**: Easy to add more backend services or frontend applications
3. **Maintainable**: Each component has its own dependencies and configuration
4. **Deployable**: Nginx config is versioned and can be deployed automatically
5. **Modern**: Uses Poetry for Python dependency management, uvicorn for ASGI

## Deployment Strategy

1. **Frontend**: Build with webpack, deploy to `/var/www/littledan.com/`
2. **Backend**: Deploy to `/opt/markdown-manager-api/`, run with systemd service
3. **Nginx**: Deploy config changes and restart nginx only when config changes
4. **Process**: Single deploy script handles all components with appropriate checks
