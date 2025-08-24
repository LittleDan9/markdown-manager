---
applyTo: "**/*"
description: "Development environment setup, debugging, and best practices for contributors"
---

# Development Environment Instructions

This guide provides setup, debugging, and testing instructions for the **Markdown Manager** project.

---

## 🚀 Running the Application

### Start the Full Stack
```bash
docker compose up --build -d
```

### Check Container Status
```bash
docker compose ps
```

Expected containers (all should be "Up"):

- `markdown-manager-frontend-1` → Frontend (Node.js/React)
- `markdown-manager-backend-1` → Backend API (Python/FastAPI)
- `markdown-manager-db-1` → PostgreSQL Database
- `markdown-manager-nginx-1` → Nginx Reverse Proxy
- `markdown-manager-pdf-service-1` → PDF Generation Service

---

## 🌐 Application Access Points

### Direct Service Access (Recommended for Development)
- **Frontend** → [http://localhost:3000](http://localhost:3000)
- **Backend API** → [http://localhost:8000](http://localhost:8000)
- **PDF Service** → [http://localhost:8001](http://localhost:8001)
- **Database** → `localhost:5432`

### Via Nginx (Production-like)
- **App Entry Point** → [http://localhost:80](http://localhost:80)
⚠️ Note: Use direct ports for debugging.

---

## 🛠 Debugging and Monitoring

### Logs
```bash
docker compose logs frontend --tail=20
docker compose logs backend --tail=20
docker compose logs pdf-service --tail=20
docker compose logs db --tail=20
docker compose logs nginx --tail=20

# Follow logs in real time
docker compose logs frontend --follow
```

### Container Management
```bash
docker compose restart frontend
docker compose up --build frontend
docker compose down
docker compose down -v   # full reset
```

### Health Checks
```bash
curl http://localhost:8000/health
curl http://localhost:8001/health
docker compose exec db psql -U postgres -d markdown_manager -c "SELECT 1;"
```

---

## 🎨 Frontend Development

### Browser Console Testing
```javascript
window.testAutoSave()
window.testAutoSave(10)  // custom delay
window.testManualSave()
```

### Hot Reload
- **Frontend** → React + Webpack HMR
- **Backend** → FastAPI auto-reload
- **PDF Service** → Requires manual restart

---

## ⚙️ Backend Development

### API Testing
```bash
curl -X POST http://localhost:8000/auth/register   -H "Content-Type: application/json"   -d '{"email": "test@example.com", "password": "test123"}'

curl -H "Authorization: Bearer <token>" http://localhost:8000/documents/
```

### Database
```bash
docker compose exec db psql -U postgres -d markdown_manager
docker compose exec backend alembic upgrade head
docker compose exec backend alembic history
```

---

## 📌 Common Tasks

- Backend env vars → `backend/.env`
- Code changes → Auto-reload for frontend/backend, restart needed for PDF service
- Debug flow:
  1. `docker compose ps`
  2. `docker compose logs <service>`
  3. Test endpoints
  4. Browser console check
  5. Verify DB connectivity

---

## 🧩 Troubleshooting

### Frequent Issues
1. Port conflicts (3000, 8000, 8001, 5432, 80)
2. Container crashes → check logs
3. DB connection failures → ensure healthy DB
4. Node version mismatches → check compatibility
5. CORS issues → bypass nginx

### Resets
```bash
docker compose down -v   # full reset (removes data)
docker compose restart   # soft reset
```

---

## ✅ Best Practices for AI Agents & Contributors

1. Always run `docker compose ps` first
2. Use direct ports for debugging
3. Check logs immediately after issues
4. Use browser console test functions
5. Use `curl` for API verification
6. Monitor webpack and response times
7. Rely on hot reload for most code changes

---

📘 **End of Instructions**