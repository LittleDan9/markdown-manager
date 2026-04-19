# Nginx — Dual-Layer Architecture

This project uses two nginx instances in production. Understanding which layer is responsible for what makes config changes, debugging, and triage dramatically simpler.

## Request Flow

```
Internet (HTTPS)
    │
    ▼
Host nginx — port 443/80
  docs.littledan.com.conf.j2 (Ansible template → /etc/nginx/sites-available/docs.littledan.com.conf)
    │  TLS termination, security headers, rate limiting, bot blocking
    │  proxy_pass http://127.0.0.1:8080  (all paths)
    ▼
Container nginx — port 8080 (host) → 80 (container)
  nginx-prod.conf
    │  Path-based routing  ·  Path rewriting  ·  Static file serving
    ├──▶ backend:8000       /api/*  (catch-all)
    ├──▶ export:8001        /api/export/*  and  /export/*
    ├──▶ linting:8002       /api/markdown-lint/*
    ├──▶ spell-check:8003   /api/spell-check/*
    └──▶ /var/www/html      static SPA assets
```

## Responsibility Split

| Concern | Host nginx | Container nginx |
|---|---|---|
| TLS termination (Let's Encrypt) | ✔ | ✘ |
| HTTPS→HTTP redirect | ✔ | ✘ |
| Security headers (CSP, HSTS, X-Frame-Options) | ✔ | ✘ |
| Rate limiting | ✔ | ✘ |
| Bot / user-agent blocking | ✔ | ✘ |
| Query-string sanitisation | ✔ | ✘ |
| Request-method filtering | ✔ | ✘ |
| Sensitive-file blocking (.env, .git, etc.) | ✔ | ✘ |
| Connection limiting | ✔ | ✘ |
| Gzip toward client | ✔ | ✘ |
| Path-based routing to services | ✘ | ✔ |
| Path rewriting (/api/x/* → /*) | ✘ | ✔ |
| Static SPA file serving | ✘ | ✔ |
| Per-service timeout tuning | ✘ | ✔ |
| Per-endpoint body-size limits | ✘ | ✔ |
| Proxy buffering | ✘ | ✔ |
| Upstream DNS re-resolution | ✘ | ✔ |
| Gzip for static .gz files | ✘ | ✔ |

## Files

| File | Purpose |
|---|---|
| `nginx-prod.conf` | **Container nginx** — edit this to change service routing |
| `nginx-dev.conf` | **Dev nginx** — all-in-one config for local Docker Compose |
| `deployment/roles/nginx_host/templates/docs.littledan.com.conf.j2` | **Host nginx** (Ansible template, source of truth) — edit this to change security policy, rate limits, or access control |
| `conf.d/bot-blocking.conf` | Bot UA map — deployed to **host nginx only** |
| `conf.d/rate-limiting.conf` | Rate limit zones — deployed to **host nginx only** |
| `conf.d/main-config.conf` | Custom log format — deployed to **host nginx only** |
| `sites-available/littledan.com.conf` | **STALE** — see notice at top of that file |

> **Note:** `conf.d/` files are deployed to the **host** nginx by Ansible
> (`deployment/roles/nginx_host/tasks/main.yml`) but are **not** mounted into
> the container nginx. The container only gets `nginx-prod.conf` and the
> pre-built UI static files.

## Deploying Changes

### Host nginx (security policy, rate limits, headers)
```bash
# Deploy only the host nginx config — no service restarts
make deploy-nginx
```

### Container nginx (service routing, timeouts)
```bash
# Full deploy — rebuilds images and restarts the stack
make deploy

# Or reload just the container nginx after editing nginx-prod.conf
# (the file is bind-mounted, so a reload avoids a full redeploy):
make deploy-update
```

## Debugging Triage

**Problem: Request returns wrong status or is unexpectedly blocked**
1. Check host nginx logs first: `sudo tail -f /var/log/nginx/access.log`
   - 444 → blocked by bot-blocking or sensitive-file rule at host level
   - 429 → rate limited at host level
   - Anything else → request reached the container; check container logs
2. Check container nginx logs: `docker compose logs nginx --follow`
3. Check the upstream service logs: `docker compose logs backend --follow`

**Problem: Real client IP appears as 127.0.0.1 in backend logs**
- The container nginx passes `X-Real-IP` / `X-Forwarded-For` from the host
  nginx rather than overwriting them. If backend logs show `127.0.0.1`,
  verify the host nginx is setting `proxy_set_header X-Real-IP $remote_addr`.

**Problem: Security header is missing from response**
- Security headers (`X-Frame-Options`, `Content-Security-Policy`, `HSTS`, etc.)
  are added by the **host nginx**. They will not appear if the request was
  served directly from the container (e.g. `curl http://localhost:8080/`).

**Problem: API route 502 / service unreachable**
- Container nginx uses Docker DNS (`127.0.0.11`) to resolve service names.
  Confirm the target container is running: `docker compose ps`

## Why Two Layers?

A single nginx would require either:
- exposing the container directly to the internet (no TLS, no meaningful OS-level
  security isolation), or
- running Certbot certificate management inside the container (fragile, couples
  cert renewal to the app deploy cycle).

Two layers gives a clean split: the host handles _internet hygiene_; the
container handles _application routing_. Each can be updated independently —
changing rate limits doesn't require rebuilding Docker images, and changing
service routing doesn't require touching anything outside the Docker Compose
stack.
