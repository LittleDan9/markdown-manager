# Docker Compose (Dev) — Core Services

```yaml
services:
  nginx:
    image: nginx:stable
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    ports: ["80:80"]
    depends_on: [frontend, backend, linting, spell, export]

  redis:
    image: redis:7
    command: ["redis-server", "--appendonly", "yes"]
    volumes: ["./redis-data:/data"]
    ports: ["6379:6379"]

  backend:
    build: ./backend
    environment: [DATABASE_URL=postgres://...]

  identity-relay:
    image: yourorg/outbox-relay:latest
    environment:
      OUTBOX_DSN: ${IDENTITY_DSN}
      OUTBOX_TABLE: identity.outbox
      BUS_KIND: redis
      BUS_URL: redis://redis:6379
      BUS_SUBJECT: identity.user.v1
      DLQ_SUBJECT: identity.user.v1.dlq
    depends_on: [backend, redis]

  linting:
    build: ./services/linting
    environment: [LINTING_DSN=postgres://...]

  linting-worker:
    build: ./services/linting
    command: ["node", "worker/consumer.js"]  # or python consumer
    environment:
      REDIS_URL: redis://redis:6379
      STREAM: identity.user.v1
      GROUP: linting_group
      CONSUMER: worker-1
      LINTING_DSN: ${LINTING_DSN}
    depends_on: [redis, linting]

  spell:
    build: ./services/spell
    environment: [SPELL_DSN=postgres://...]

  spell-worker:
    build: ./services/spell
    command: ["node", "worker/consumer.js"]
    environment:
      REDIS_URL: redis://redis:6379
      STREAM: identity.user.v1
      GROUP: spell_group
      CONSUMER: worker-1
      SPELL_DSN: ${SPELL_DSN}
    depends_on: [redis, spell]

  export:
    build: ./services/export
```
