# GitHub Organization Repository Management

This document explains how to configure GitHub OAuth for organizations with many repositories.

## Problem

When a user connects a GitHub account that has access to large organizations (e.g., 1,500+ repositories), the system would attempt to sync all repositories, which is:
- Slow and resource-intensive
- May hit API rate limits
- Creates unnecessary clutter

## Solution

The system now includes intelligent repository filtering that automatically detects large organizations and applies sensible defaults.

## Environment Configuration

### For Production Deployment

Add these environment variables to your production configuration:

```bash
# GitHub OAuth Scope - choose one:
GITHUB_OAUTH_SCOPE=public_repo    # Public repositories only (default)
GITHUB_OAUTH_SCOPE=repo           # Public + private repositories

# Repository Filtering (for large organizations)
GITHUB_MAX_REPOS_PER_ACCOUNT=50   # Maximum repositories to sync per account
GITHUB_MIN_UPDATED_DAYS=180       # Only sync repos updated in last N days
GITHUB_INCLUDE_FORKS=false        # Include forked repositories
GITHUB_EXCLUDE_ARCHIVED=true      # Exclude archived repositories
```

### Recommended Settings by Use Case

#### Individual Users or Small Teams
```bash
GITHUB_OAUTH_SCOPE=public_repo
GITHUB_MAX_REPOS_PER_ACCOUNT=100
GITHUB_MIN_UPDATED_DAYS=365
GITHUB_INCLUDE_FORKS=true
GITHUB_EXCLUDE_ARCHIVED=true
```

#### Large Organizations
```bash
GITHUB_OAUTH_SCOPE=repo           # If private repos needed
GITHUB_MAX_REPOS_PER_ACCOUNT=25   # Strict limit
GITHUB_MIN_UPDATED_DAYS=90        # Only recently active repos
GITHUB_INCLUDE_FORKS=false        # Skip forks
GITHUB_EXCLUDE_ARCHIVED=true      # Skip archived
```

#### Development/Testing
```bash
GITHUB_OAUTH_SCOPE=public_repo
GITHUB_MAX_REPOS_PER_ACCOUNT=10
GITHUB_MIN_UPDATED_DAYS=30
GITHUB_INCLUDE_FORKS=false
GITHUB_EXCLUDE_ARCHIVED=true
```

## How It Works

1. **Smart Detection**: When syncing repositories, the system first fetches 10 repositories
2. **Filtering Decision**: If 10+ repositories are found, it assumes this is a large organization
3. **Filtered Sync**: Uses the configured filters to sync only relevant repositories
4. **Fallback**: For smaller accounts, syncs all repositories normally

## Benefits

- **Performance**: Only syncs relevant repositories
- **User Experience**: Reduces clutter from inactive/archived repos
- **Resource Management**: Prevents overwhelming the system
- **Flexibility**: Configurable per deployment environment

## User Control

Users can:
- Manually sync additional repositories via the UI
- See which repositories were filtered out
- Re-sync with different parameters if needed

## API Rate Limits

The filtering approach helps stay within GitHub's API rate limits:
- **Without filtering**: Could use 15+ API calls per large organization
- **With filtering**: Typically uses 2-5 API calls per organization

## Monitoring

Check application logs for filtering messages:
```
Large organization detected. Syncing 25 filtered repositories (max 50)
```