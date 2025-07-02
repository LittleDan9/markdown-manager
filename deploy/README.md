# Legacy Deployment Scripts

This directory contains the old complex deployment system that has been replaced
by the simple Makefile approach.

## Migration

**Old way:**
```bash
./deploy.sh production
./dev.sh --no-nginx
```

**New way:**
```bash
make deploy
make dev
```

The new Makefile approach is simpler, faster, and more maintainable.

These legacy scripts are kept for reference but should not be used for new development.
