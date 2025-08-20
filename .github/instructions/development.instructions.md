---
applyTo: '**/*'
---

# Development Environment Instructions

## Running the Application

### Start the Full Stack
```bash
docker compose up --build -d
```

### Check Container Status
```bash
docker compose ps
```

All containers should show "Up" status:
- `markdown-manager-frontend-1` - Frontend (Node.js/React)
- `markdown-manager-backend-1` - Backend API (Python/FastAPI)
- `markdown-manager-db-1` - PostgreSQL Database
- `markdown-manager-nginx-1` - Nginx Reverse Proxy
- `markdown-manager-pdf-service-1` - PDF Generation Service

## Application Access Points

### Direct Service Access (Recommended for Development)
- **Frontend**: http://localhost:3000 (bypasses nginx)
- **Backend API**: http://localhost:8000 (bypasses nginx)
- **PDF Service**: http://localhost:8001 (bypasses nginx)
- **Database**: localhost:5432 (direct PostgreSQL access)

### Via Nginx (Production-like)
- **Application**: http://localhost:80
- Note: Currently recommended to bypass nginx and use direct ports for development/debugging

## Debugging and Monitoring

### View Logs
```bash
# View logs for specific service
docker compose logs frontend --tail=20
docker compose logs backend --tail=20
docker compose logs pdf-service --tail=20
docker compose logs db --tail=20
docker compose logs nginx --tail=20

# Follow logs in real-time
docker compose logs frontend --follow

# View all service logs
docker compose logs --tail=50
```

### Container Management
```bash
# Restart specific service
docker compose restart frontend

# Rebuild and restart service
docker compose up --build frontend

# Stop all services
docker compose down

# Stop and remove volumes (full reset)
docker compose down -v
```

### Health Checks
```bash
# Check API health
curl http://localhost:8000/health

# Check PDF service health
curl http://localhost:8001/health

# Check database connectivity
docker compose exec db psql -U postgres -d markdown_manager -c "SELECT 1;"
```

## Frontend Development Testing

### Browser Console Testing
The frontend exposes global test functions for debugging:

```javascript
// Test auto-save with 30-second delay (default)
window.testAutoSave()

// Test auto-save with custom delay (gives time to switch to editor)
window.testAutoSave(10)  // 10 seconds

// Test manual save with notifications
window.testManualSave()
```

### Hot Reload
Frontend supports hot reload - changes to React components will automatically update in the browser.

### Performance Testing
Monitor webpack compilation times and bundle sizes in frontend logs.

## Backend Development Testing

### API Testing
```bash
# Test authentication endpoints
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "test123"}'

# Test document endpoints (requires auth token)
curl -H "Authorization: Bearer <token>" http://localhost:8000/documents/
```

### Database Operations
```bash
# Access database directly
docker compose exec db psql -U postgres -d markdown_manager

# Run migrations
docker compose exec backend alembic upgrade head

# View migration history
docker compose exec backend alembic history
```

## Common Development Tasks

### Environment Configuration
- Backend environment variables are in `backend/.env`
- Database credentials and connection strings configured via Docker Compose

### Code Changes
- **Frontend**: Changes trigger automatic webpack rebuild
- **Backend**: May require container restart for some changes
- **PDF Service**: Requires container restart for changes

### Debugging Steps
1. Check container status with `docker compose ps`
2. View service logs with `docker compose logs <service>`
3. Test direct service endpoints (bypass nginx)
4. Check browser console for frontend errors
5. Verify database connectivity if data issues occur

### Performance Monitoring
- Monitor frontend bundle sizes (webpack warnings in logs)
- Check backend response times via logs
- Monitor database query performance via backend logs

### File Watching and Auto-Reload
- Frontend: Webpack dev server provides hot reload
- Backend: FastAPI auto-reloads on Python file changes
- PDF Service: Manual restart required

## Troubleshooting

### Common Issues
1. **Port conflicts**: Ensure ports 3000, 8000, 8001, 5432, 80 are available
2. **Container failures**: Check logs and ensure all dependencies are met
3. **Database connection issues**: Verify PostgreSQL container is healthy
4. **Frontend build failures**: Check Node.js version compatibility
5. **CORS issues**: Use direct port access instead of nginx during development

### Reset Environment
```bash
# Complete reset (removes all data)
docker compose down -v
docker compose up --build -d

# Soft reset (preserves data)
docker compose restart
```

### Log Analysis
- Frontend logs show webpack compilation and React errors
- Backend logs show API requests, database queries, and Python errors
- PDF service logs show document generation status
- Database logs show connection and query information

## Best Practices for AI Agents

1. **Always check container status first** with `docker compose ps`
2. **Use direct port access** (3000, 8000, 8001) instead of nginx (80) for debugging
3. **Check logs immediately** after making changes or encountering issues
4. **Test with browser console functions** for frontend debugging
5. **Use curl commands** for API testing and verification
6. **Monitor compilation times** and bundle sizes for performance impact
7. **Restart containers** if behavior seems inconsistent after code changes
8. **Access browser at** http://localhost:3000 for development testing