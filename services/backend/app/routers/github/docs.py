"""
OpenAPI documentation for GitHub API endpoints.
Externalized documentation to keep router files manageable.
"""

# Common responses for all GitHub endpoints
COMMON_RESPONSES = {
    401: {"description": "Authentication required"},
    403: {"description": "Access forbidden"},
    404: {"description": "Resource not found"},
    500: {"description": "Internal server error"}
}

# GitHub OAuth Authentication Documentation
GITHUB_AUTH_DOCS = {
    "get_auth_url": {
        "summary": "Generate GitHub OAuth authorization URL",
        "description": """
        Generate a GitHub OAuth authorization URL for connecting a user's GitHub account.

        **Flow:**
        1. Frontend calls this endpoint to get authorization URL
        2. User is redirected to GitHub OAuth page
        3. User grants permissions
        4. GitHub redirects to callback URL with authorization code

        **Security:**
        - State parameter includes CSRF protection
        - User ID is encoded in state for callback processing

        **Returns:**
        - Authorization URL for GitHub OAuth
        - State parameter for CSRF protection
        """,
        "responses": {
            200: {
                "description": "Authorization URL generated successfully",
                "content": {
                    "application/json": {
                        "example": {
                            "authorization_url": "https://github.com/login/oauth/authorize?client_id=...",
                            "state": "123:random_csrf_token"
                        }
                    }
                }
            }
        }
    },
    "oauth_callback": {
        "summary": "Handle GitHub OAuth callback",
        "description": """
        Process the OAuth callback from GitHub after user authorization.

        **Flow:**
        1. GitHub redirects user here with authorization code
        2. Exchange code for access token
        3. Fetch user info from GitHub
        4. Create or update GitHub account record
        5. Schedule background repository sync
        6. Display success/error page

        **Background Processing:**
        - Repository sync happens asynchronously
        - User sees immediate feedback
        - Repositories are available after sync completes

        **Returns HTML page with:**
        - Success message and auto-close script
        - Error message for failures
        """,
        "responses": {
            200: {
                "description": "OAuth callback processed successfully",
                "content": {
                    "text/html": {
                        "example": "HTML page with success message"
                    }
                }
            },
            400: {
                "description": "OAuth callback failed",
                "content": {
                    "text/html": {
                        "example": "HTML page with error message"
                    }
                }
            }
        }
    }
}

# GitHub Accounts Management Documentation
GITHUB_ACCOUNTS_DOCS = {
    "list": {
        "summary": "List connected GitHub accounts",
        "description": """
        Retrieve all GitHub accounts connected to the authenticated user.

        **Features:**
        - Includes repository count for each account
        - Shows last sync timestamp
        - Account status and metadata

        **Use Cases:**
        - Display connected accounts in UI
        - Account management interface
        - Repository browsing preparation
        """,
        "responses": {
            200: {
                "description": "Accounts retrieved successfully",
                "content": {
                    "application/json": {
                        "example": [
                            {
                                "id": 1,
                                "github_id": 12345,
                                "username": "johndoe",
                                "display_name": "John Doe",
                                "email": "john@example.com",
                                "avatar_url": "https://github.com/avatars/...",
                                "is_active": True,
                                "repository_count": 15,
                                "last_sync": "2025-08-28T10:30:00Z",
                                "created_at": "2025-08-28T09:00:00Z"
                            }
                        ]
                    }
                }
            }
        }
    },
    "disconnect": {
        "summary": "Disconnect a GitHub account",
        "description": """
        Disconnect and remove a GitHub account from the user's profile.

        **⚠️ WARNING: This action is IRREVERSIBLE**

        **Side Effects:**
        - All repositories from this account are removed
        - Linked documents lose GitHub metadata
        - Access tokens are invalidated
        - Sync history is preserved but account is deactivated

        **Security:**
        - Only account owner can disconnect
        - Validates account ownership before deletion
        """,
        "responses": {
            200: {
                "description": "Account disconnected successfully",
                "content": {
                    "application/json": {
                        "example": {"message": "GitHub account disconnected successfully"}
                    }
                }
            },
            404: {"description": "GitHub account not found or not owned by user"}
        }
    }
}

# GitHub Repositories Management Documentation
GITHUB_REPOSITORIES_DOCS = {
    "list": {
        "summary": "List GitHub repositories",
        "description": """
        List repositories for a specific GitHub account or all connected accounts.

        **Query Parameters:**
        - `account_id` (optional): Filter by specific GitHub account
        - If omitted, returns repositories from all connected accounts

        **Repository Information:**
        - Basic repository metadata
        - Access permissions
        - Default branch information
        - Sync status and settings

        **Use Cases:**
        - Repository selection for file import
        - Repository management interface
        - Sync status monitoring
        """,
        "responses": {
            200: {
                "description": "Repositories retrieved successfully",
                "content": {
                    "application/json": {
                        "example": [
                            {
                                "id": 1,
                                "repo_full_name": "user/repository",
                                "repo_name": "repository",
                                "repo_owner": "user",
                                "description": "A sample repository",
                                "default_branch": "main",
                                "is_private": False,
                                "is_enabled": True,
                                "account_username": "johndoe"
                            }
                        ]
                    }
                }
            },
            404: {"description": "GitHub account not found"}
        }
    },
    "sync": {
        "summary": "Sync repositories from GitHub",
        "description": """
        Fetch and sync repositories from GitHub for a specific account.

        **Process:**
        1. Fetch repositories from GitHub API
        2. Create new repository records
        3. Update existing repository metadata
        4. Update account's last sync timestamp

        **Features:**
        - Handles repository renames and transfers
        - Updates metadata (description, default branch, etc.)
        - Preserves local settings (enabled status, etc.)

        **Rate Limiting:**
        - Respects GitHub API rate limits
        - May take time for accounts with many repositories
        """,
        "responses": {
            200: {
                "description": "Repositories synced successfully",
                "content": {
                    "application/json": {
                        "example": [
                            {
                                "id": 1,
                                "github_repo_id": 123456,
                                "repo_full_name": "user/repository",
                                "repo_name": "repository",
                                "is_enabled": True
                            }
                        ]
                    }
                }
            },
            404: {"description": "GitHub account not found"}
        }
    },
    "get_branches": {
        "summary": "Get repository branches",
        "description": """
        Retrieve all branches for a specific GitHub repository.

        **Branch Information:**
        - Branch name
        - Latest commit SHA
        - Default branch indicator

        **Use Cases:**
        - Branch selection for file import
        - Commit target selection
        - Branch comparison operations
        """,
        "responses": {
            200: {
                "description": "Branches retrieved successfully",
                "content": {
                    "application/json": {
                        "example": [
                            {
                                "name": "main",
                                "commit_sha": "abc123...",
                                "is_default": True
                            },
                            {
                                "name": "feature-branch",
                                "commit_sha": "def456...",
                                "is_default": False
                            }
                        ]
                    }
                }
            },
            404: {"description": "Repository not found or access denied"}
        }
    }
}

# GitHub Files and Content Documentation
GITHUB_FILES_DOCS = {
    "browse": {
        "summary": "Browse repository files",
        "description": """
        Browse files and directories in a GitHub repository at a specific path.

        **Features:**
        - Directory traversal
        - File metadata (size, type, etc.)
        - Download URLs for files
        - SHA hashes for integrity

        **File Types:**
        - Directories: Use for navigation
        - Files: Use for content preview/import

        **Use Cases:**
        - File browser interface
        - Import file selection
        - Repository exploration
        """,
        "responses": {
            200: {
                "description": "Repository contents retrieved successfully",
                "content": {
                    "application/json": {
                        "example": [
                            {
                                "name": "README.md",
                                "path": "README.md",
                                "type": "file",
                                "size": 1024,
                                "download_url": "https://raw.githubusercontent.com/...",
                                "sha": "abc123..."
                            },
                            {
                                "name": "docs",
                                "path": "docs",
                                "type": "dir",
                                "size": 0,
                                "download_url": None,
                                "sha": "def456..."
                            }
                        ]
                    }
                }
            },
            404: {"description": "Repository not found or path does not exist"}
        }
    },
    "get_contents": {
        "summary": "Get repository contents at specific path",
        "description": """
        Retrieve detailed contents of a repository directory or file.

        **Parameters:**
        - `path`: Directory or file path
        - `branch`: Target branch (default: main)

        **Returns:**
        - Raw GitHub API response
        - Supports both files and directories
        - Includes download URLs and metadata

        **Use Cases:**
        - Detailed file information
        - Content analysis
        - Integration with GitHub API responses
        """,
        "responses": {
            200: {
                "description": "Contents retrieved successfully",
                "content": {
                    "application/json": {
                        "example": "Raw GitHub API response"
                    }
                }
            },
            400: {"description": "Failed to fetch repository contents"},
            404: {"description": "Repository not found or access denied"}
        }
    },
    "check_document_exists": {
        "summary": "Check if document exists for GitHub file",
        "description": """
        Check if a local document already exists for a specific GitHub file.

        **Prevents Duplicates:**
        - Avoids importing the same file multiple times
        - Shows existing document information
        - Helps with conflict resolution

        **Use Cases:**
        - Pre-import validation
        - Duplicate prevention
        - Document relationship tracking
        """,
        "responses": {
            200: {
                "description": "Check completed successfully",
                "content": {
                    "application/json": {
                        "examples": {
                            "exists": {
                                "summary": "Document exists",
                                "value": {
                                    "exists": True,
                                    "document_id": 42,
                                    "document_name": "My Document"
                                }
                            },
                            "not_exists": {
                                "summary": "Document does not exist",
                                "value": {"exists": False}
                            }
                        }
                    }
                }
            },
            404: {"description": "Repository not found or access denied"}
        }
    }
}

# GitHub Synchronization Documentation
GITHUB_SYNC_DOCS = {
    "import": {
        "summary": "Import file from GitHub",
        "description": """
        Import a markdown file from GitHub as a new document.

        **Import Process:**
        1. Fetch file content from GitHub
        2. Create local document
        3. Set up GitHub metadata for sync
        4. Link to repository and branch

        **Features:**
        - Automatic category creation (repo/branch)
        - Content hash tracking for sync
        - Metadata preservation
        - Document name customization

        **GitHub Metadata:**
        - Repository ID and file path
        - Branch and commit SHA
        - Sync status tracking
        - Last sync timestamp

        **Use Cases:**
        - Initial file import
        - Creating local copies
        - Setting up sync relationships
        """,
        "responses": {
            200: {
                "description": "File imported successfully",
                "content": {
                    "application/json": {
                        "example": {
                            "id": 42,
                            "name": "Imported Document",
                            "content": "# Content from GitHub\n\nMarkdown content...",
                            "github_repository_id": 1,
                            "github_file_path": "docs/readme.md",
                            "github_branch": "main",
                            "github_sync_status": "synced"
                        }
                    }
                }
            },
            404: {"description": "Repository not found or file does not exist"}
        }
    },
    "get_status": {
        "summary": "Get document GitHub sync status",
        "description": """
        Check the synchronization status between a local document and its GitHub file.

        **Sync Status Types:**
        - `synced`: Local and remote are identical
        - `local_changes`: Local document has been modified
        - `remote_changes`: GitHub file has been updated
        - `conflict`: Both local and remote have changes

        **Change Detection:**
        - Content hash comparison for local changes
        - SHA comparison for remote changes
        - Handles legacy documents with SHA migration

        **Status Information:**
        - Repository and file details
        - Last sync timestamp
        - Conflict indicators
        - Remote content preview (if different)

        **Use Cases:**
        - Sync status indicators in UI
        - Conflict detection
        - Change tracking
        """,
        "responses": {
            200: {
                "description": "Status retrieved successfully",
                "content": {
                    "application/json": {
                        "example": {
                            "is_github_document": True,
                            "sync_status": "local_changes",
                            "has_local_changes": True,
                            "has_remote_changes": False,
                            "github_repository": "user/repo",
                            "github_branch": "main",
                            "github_file_path": "docs/file.md",
                            "last_sync": "2025-08-28T10:30:00Z",
                            "remote_content": None
                        }
                    }
                }
            },
            400: {"description": "Document is not linked to GitHub"},
            404: {"description": "Document not found"}
        }
    },
    "get_sync_history": {
        "summary": "Get document sync history",
        "description": """
        Retrieve synchronization history for a GitHub-linked document.

        **History Entries:**
        - Sync operation timestamps
        - Operation types (import, commit, pull)
        - Success/failure status
        - Commit SHAs and messages

        **Features:**
        - Chronological ordering (newest first)
        - Configurable limit (default: 10)
        - Detailed operation context

        **Use Cases:**
        - Sync audit trail
        - Troubleshooting sync issues
        - Operation history display
        """,
        "responses": {
            200: {
                "description": "History retrieved successfully",
                "content": {
                    "application/json": {
                        "example": [
                            {
                                "id": 1,
                                "operation_type": "commit",
                                "status": "success",
                                "commit_sha": "abc123...",
                                "commit_message": "Update documentation",
                                "created_at": "2025-08-28T10:30:00Z"
                            }
                        ]
                    }
                }
            },
            400: {"description": "Document is not linked to GitHub"},
            404: {"description": "Document not found"}
        }
    },
    "pull": {
        "summary": "Pull changes from GitHub",
        "description": """
        Pull remote changes from GitHub repository for a linked document.

        **Process:**
        1. Fetch current file content from GitHub
        2. Compare with local document content
        3. Handle conflicts or merge changes
        4. Update local document if successful

        **Conflict Resolution:**
        - Returns conflict details if both local and remote changes exist
        - Allows force overwrite with `force_overwrite` parameter
        - Provides conflict resolution endpoint for manual merge

        **Use Cases:**
        - Sync document with latest GitHub changes
        - Resolve conflicts after collaborative editing
        - Force refresh from remote source
        """,
        "responses": {
            200: {
                "description": "Pull operation completed",
                "content": {
                    "application/json": {
                        "example": {
                            "success": True,
                            "message": "Document updated successfully",
                            "conflicts": False,
                            "changes_detected": True
                        }
                    }
                }
            },
            409: {
                "description": "Merge conflicts detected",
                "content": {
                    "application/json": {
                        "example": {
                            "success": False,
                            "message": "Conflicts detected",
                            "conflicts": True,
                            "local_content": "Local version...",
                            "remote_content": "Remote version..."
                        }
                    }
                }
            }
        }
    },
    "resolve_conflicts": {
        "summary": "Resolve merge conflicts",
        "description": """
        Resolve merge conflicts with user-provided resolved content.

        **Process:**
        1. Accept user's merged/resolved content
        2. Update local document
        3. Mark conflicts as resolved
        4. Update sync status

        **Requirements:**
        - Document must have pending conflicts
        - Resolved content should combine local and remote changes appropriately

        **Use Cases:**
        - Manual conflict resolution after pull operation
        - Custom merge strategies
        - Preserve specific content portions
        """,
        "responses": {
            200: {
                "description": "Conflicts resolved successfully",
                "content": {
                    "application/json": {
                        "example": {
                            "success": True,
                            "message": "Conflicts resolved successfully",
                            "document_updated": True
                        }
                    }
                }
            }
        }
    }
}

# GitHub Commits Documentation
GITHUB_COMMITS_DOCS = {
    "commit": {
        "summary": "Commit document changes to GitHub",
        "description": """
        Commit local document changes to the linked GitHub repository.

        **Commit Options:**
        - Custom commit message
        - Target branch selection
        - New branch creation
        - Force commit (override conflicts)

        **Conflict Handling:**
        - Automatic conflict detection
        - Remote change validation
        - Force override option
        - Clear error messages

        **Branch Operations:**
        - Commit to existing branch
        - Create new branch for changes
        - Branch name customization

        **Post-Commit Updates:**
        - Document metadata refresh
        - Sync status updates
        - Content hash updates
        - Timestamp recording

        **Use Cases:**
        - Publishing local changes
        - Creating pull requests
        - Collaborative editing workflows
        """,
        "responses": {
            200: {
                "description": "Changes committed successfully",
                "content": {
                    "application/json": {
                        "example": {
                            "success": True,
                            "commit_sha": "abc123def456...",
                            "commit_url": "https://github.com/user/repo/commit/abc123...",
                            "branch": "main",
                            "message": "File committed successfully"
                        }
                    }
                }
            },
            400: {"description": "Document is not linked to GitHub or commit failed"},
            404: {"description": "Document or repository not found"},
            409: {
                "description": "Conflict: Remote file has been modified",
                "content": {
                    "application/json": {
                        "example": {
                            "detail": "Remote file has been modified since last sync. Use force_commit=true to override."
                        }
                    }
                }
            }
        }
    }
}

# Request/Response Schema Documentation
GITHUB_SCHEMA_EXAMPLES = {
    "GitHubImportRequest": {
        "example": {
            "repository_id": 1,
            "file_path": "docs/readme.md",
            "branch": "main",
            "document_name": "Project README",
            "category_id": 2
        },
        "description": "Data required to import a file from GitHub"
    },
    "GitHubCommitRequest": {
        "example": {
            "commit_message": "Update documentation with latest changes",
            "branch": "main",
            "create_new_branch": False,
            "new_branch_name": None,
            "force_commit": False
        },
        "description": "Data required to commit changes to GitHub"
    },
    "GitHubStatusResponse": {
        "example": {
            "is_github_document": True,
            "sync_status": "synced",
            "has_local_changes": False,
            "has_remote_changes": False,
            "github_repository": "user/repository",
            "github_branch": "main",
            "github_file_path": "docs/file.md",
            "last_sync": "2025-08-28T10:30:00Z"
        },
        "description": "GitHub synchronization status for a document"
    }
}

# Error Response Examples
GITHUB_ERROR_EXAMPLES = {
    "GitHubNotConnected": {
        "example": {
            "detail": "No GitHub accounts connected. Please connect a GitHub account first."
        }
    },
    "RepositoryNotFound": {
        "example": {
            "detail": "Repository not found or access denied"
        }
    },
    "SyncConflict": {
        "example": {
            "detail": "Remote file has been modified since last sync. Use force_commit=true to override."
        }
    },
    "RateLimitExceeded": {
        "example": {
            "detail": "GitHub API rate limit exceeded. Please try again later."
        }
    }
}

# Pull Requests Endpoint Documentation
GITHUB_PULL_REQUESTS_DOCS = {
    "create_pull_request": {
        "summary": "Create a pull request",
        "description": """
        Create a new pull request in a GitHub repository.

        **Process:**
        1. Validate repository access
        2. Create pull request via GitHub API
        3. Return pull request details

        **Requirements:**
        - Repository must be accessible to user
        - Head and base branches must exist
        - User must have repository permissions

        **Use Cases:**
        - Propose changes for review
        - Collaborate with team members
        - Submit contributions to projects
        """,
        "responses": {
            201: {
                "description": "Pull request created successfully",
                "content": {
                    "application/json": {
                        "example": {
                            "number": 42,
                            "title": "Feature: Add new functionality",
                            "body": "This PR adds new functionality...",
                            "state": "open",
                            "html_url": "https://github.com/user/repo/pull/42",
                            "head_branch": "feature-branch",
                            "base_branch": "main",
                            "created_at": "2025-08-28T10:30:00Z"
                        }
                    }
                }
            }
        }
    },
    "get_pull_requests": {
        "summary": "List pull requests",
        "description": """
        Retrieve pull requests for a GitHub repository.

        **Filtering Options:**
        - State: open, closed, all
        - Repository scope
        - Date ranges (when supported)

        **Information Provided:**
        - Pull request metadata
        - Author information
        - Status and state
        - Creation/update timestamps

        **Use Cases:**
        - Review management
        - Track contribution activity
        - Monitor repository health
        - Project management
        """,
        "responses": {
            200: {
                "description": "Pull requests retrieved successfully",
                "content": {
                    "application/json": {
                        "example": [
                            {
                                "number": 42,
                                "title": "Feature: Add new functionality",
                                "state": "open",
                                "html_url": "https://github.com/user/repo/pull/42",
                                "created_at": "2025-08-28T10:30:00Z",
                                "updated_at": "2025-08-28T11:00:00Z",
                                "user_login": "contributor",
                                "user_avatar": "https://github.com/contributor.png"
                            }
                        ]
                    }
                }
            }
        }
    }
}
