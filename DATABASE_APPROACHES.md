# Database Backup/Restore Approaches Comparison

## Current Approach: Remote Operational Environment
**Files:** `db-backup-prod.sh`, `db-restore-prod.sh`, `setup-remote-ops.sh`

**How it works:**
1. Sets up a separate Python environment on the remote server (`~/markdown-manager-ops`)
2. Installs Python packages (asyncpg, sqlalchemy, alembic) on remote server
3. Copies backup/restore scripts to remote server
4. SSH to remote server and runs the scripts there
5. Downloads the backup files back to local machine

**Pros:**
- All database operations happen on the remote server
- Minimal data transfer (only final backup files)

**Cons:**
- Requires setting up and maintaining remote operational environment
- More complex setup and troubleshooting
- Dependencies must be installed on remote server
- Scripts must be kept in sync between local and remote

## New Approach: SSH Port Forwarding
**Files:** `db-backup-prod-ssh.sh`, `db-restore-prod-ssh.sh`

**How it works:**
1. SSH to remote server and extract DATABASE_URL from environment file
2. Parse DATABASE_URL to get database host, port, credentials
3. Set up SSH port forwarding: `localhost:5433 -> db_host:db_port`
4. Run backup/restore scripts locally using forwarded connection
5. Use local Python environment and dependencies

**Pros:**
- ✅ No remote environment setup required
- ✅ Uses existing local Python environment
- ✅ Simpler architecture - just SSH + port forwarding
- ✅ No need to sync scripts to remote server
- ✅ Easier to debug (runs locally)
- ✅ No additional packages needed on remote server

**Cons:**
- Slightly more network traffic (database connection stays open longer)
- Requires local Python environment with asyncpg

## Recommendation

The SSH port forwarding approach is much simpler and cleaner:

```bash
# Old way (complex):
make setup-remote-ops      # One-time setup
make db-backup-ops         # Backup via remote ops

# New way (simple):
make db-backup-ssh         # Backup via SSH port forwarding
```

The old operational environment approach was overkill for this use case.
