"""
OpenAPI documentation for Document API endpoints.
Externalized documentation to keep router files manageable.
"""

# Common responses for all document endpoints
COMMON_RESPONSES = {
    401: {"description": "Authentication required"},
    403: {"description": "Access forbidden"},
    404: {"description": "Document not found"},
    500: {"description": "Internal server error"}
}

# Document CRUD Endpoints Documentation
DOCUMENT_CRUD_DOCS = {
    "list": {
        "summary": "List user documents with filtering and pagination",
        "description": """
        Retrieve a paginated list of documents for the authenticated user.

        **Filtering Options:**
        - **Category Filter**: Filter by document category
        - **Pagination**: Control page size and offset

        **Returns:**
        - List of documents with metadata
        - Total count for pagination
        - Available categories for the user

        **Example Usage:**
        - Get all documents: `GET /documents/`
        - Filter by category: `GET /documents/?category=Work`
        - Paginate results: `GET /documents/?skip=20&limit=10`
        """,
        "responses": {
            200: {
                "description": "Successfully retrieved documents",
                "content": {
                    "application/json": {
                        "example": {
                            "documents": [
                                {
                                    "id": 1,
                                    "name": "Project Planning",
                                    "content": "# Project Overview\n\nThis is a sample document...",
                                    "category_id": 1,
                                    "category_name": "Work",
                                    "created_at": "2025-08-28T10:30:00Z",
                                    "updated_at": "2025-08-28T11:00:00Z",
                                    "user_id": 123,
                                    "is_shared": False,
                                    "share_token": None
                                }
                            ],
                            "total": 1,
                            "categories": ["General", "Work", "Personal"]
                        }
                    }
                }
            },
            422: {"description": "Invalid query parameters"}
        }
    },
    "create": {
        "summary": "Create a new document",
        "description": """
        Create a new document for the authenticated user with conflict detection.

        **Features:**
        - Enforces uniqueness of (name, category) per user
        - Automatic timestamp generation
        - Category validation

        **Conflict Handling:**
        Returns detailed information about existing documents with the same name/category.

        **Example Request:**
        ```json
        {
            "name": "Meeting Notes",
            "content": "# Team Meeting - Aug 28\\n\\n## Agenda\\n- Project updates",
            "category_id": 2
        }
        ```
        """,
        "responses": {
            200: {
                "description": "Document successfully created",
                "content": {
                    "application/json": {
                        "example": {
                            "id": 42,
                            "name": "Meeting Notes",
                            "content": "# Team Meeting - Aug 28\n\n## Agenda\n- Project updates",
                            "category_id": 2,
                            "category_name": "Work",
                            "created_at": "2025-08-28T12:00:00Z",
                            "updated_at": "2025-08-28T12:00:00Z",
                            "user_id": 123,
                            "is_shared": False,
                            "share_token": None
                        }
                    }
                }
            },
            400: {
                "description": "Document with this name and category already exists",
                "content": {
                    "application/json": {
                        "example": {
                            "detail": {
                                "detail": "A document with this name and category already exists.",
                                "conflict_type": "name_conflict",
                                "existing_document": {
                                    "id": 15,
                                    "name": "Meeting Notes",
                                    "category_name": "Work"
                                }
                            }
                        }
                    }
                }
            },
            422: {"description": "Invalid document data"}
        }
    },
    "get": {
        "summary": "Get a specific document by ID",
        "description": """
        Retrieve a specific document by its ID. Only the document owner can access it.

        **Security:**
        - Documents can only be accessed by their owner
        - Shared documents use separate public endpoints
        """,
        "responses": {
            200: {"description": "Document successfully retrieved"},
            404: {"description": "Document not found or access denied"}
        }
    },
    "update": {
        "summary": "Update an existing document",
        "description": """
        Update an existing document's content, name, or category.

        **Features:**
        - Partial updates supported
        - Automatic timestamp updates
        - Category change validation
        - Name conflict detection
        """,
        "responses": {
            200: {"description": "Document successfully updated"},
            404: {"description": "Document not found or access denied"},
            422: {"description": "Invalid update data"}
        }
    },
    "delete": {
        "summary": "Delete a document",
        "description": """
        Permanently delete a document. Only the document owner can delete it.

        **⚠️ WARNING: This action is IRREVERSIBLE**

        **Side Effects:**
        - If this was the user's current document, current_doc_id is cleared
        - Any sharing tokens are invalidated
        """,
        "responses": {
            200: {
                "description": "Document successfully deleted",
                "content": {
                    "application/json": {
                        "example": {"message": "Document deleted successfully"}
                    }
                }
            },
            404: {"description": "Document not found or access denied"}
        }
    }
}

# Current Document Management Documentation
CURRENT_DOCUMENT_DOCS = {
    "get": {
        "summary": "Get the user's current document",
        "description": """
        Retrieve the document that the user is currently working on.

        **Behavior:**
        - Returns null if no current document is set
        - Automatically clears current_doc_id if the document no longer exists
        - Only returns documents owned by the authenticated user
        """,
        "responses": {
            200: {
                "description": "Current document retrieved (may be null)",
                "content": {
                    "application/json": {
                        "examples": {
                            "with_document": {
                                "summary": "User has a current document",
                                "value": {
                                    "id": 5,
                                    "name": "Today's Tasks",
                                    "content": "# Tasks for August 28\n\n- [ ] Review PR\n- [ ] Update docs",
                                    "category_name": "Personal"
                                }
                            },
                            "no_document": {
                                "summary": "No current document set",
                                "value": None
                            }
                        }
                    }
                }
            }
        }
    },
    "set": {
        "summary": "Set the user's current document",
        "description": """
        Set which document the user is currently working on.

        **Validation:**
        - Document must exist and be owned by the user
        - Document ID must be valid

        **Use Cases:**
        - Remember the last opened document
        - Quick access to frequently edited documents
        - Cross-session document state persistence
        """,
        "responses": {
            200: {
                "description": "Current document successfully set",
                "content": {
                    "application/json": {
                        "example": {
                            "message": "Current document updated",
                            "current_doc_id": 5
                        }
                    }
                }
            },
            404: {"description": "Document not found or not owned by user"},
            422: {"description": "Invalid document ID"}
        }
    }
}

# Categories Management Documentation
CATEGORIES_DOCS = {
    "list": {
        "summary": "Get all categories for the current user",
        "description": """
        Retrieve all document categories used by the authenticated user.

        **Default Behavior:**
        - Always includes "General" category
        - Categories are automatically created when documents are assigned to them
        - Returns categories in alphabetical order
        """,
        "responses": {
            200: {
                "description": "Categories successfully retrieved",
                "content": {
                    "application/json": {
                        "example": ["General", "Personal", "Work", "Projects"]
                    }
                }
            }
        }
    },
    "create": {
        "summary": "Add a new category",
        "description": """
        Create a new document category for the authenticated user.

        **Features:**
        - Category names are case-sensitive
        - Duplicate categories are rejected
        - Categories are immediately available for document assignment

        **Restrictions:**
        - Category names cannot be empty
        - Category names cannot contain only whitespace
        """,
        "responses": {
            200: {
                "description": "Category successfully added",
                "content": {
                    "application/json": {
                        "example": ["General", "Personal", "Work", "Projects", "New Category"]
                    }
                }
            },
            400: {"description": "Category already exists or invalid name"},
            422: {"description": "Invalid category data"}
        }
    },
    "delete": {
        "summary": "Delete a category with migration options",
        "description": """
        Delete a document category with flexible document handling options.

        **Document Migration Options:**

        1. **Migrate to another category** (`migrate_to` parameter):
           ```
           DELETE /documents/categories/OldCategory?migrate_to=NewCategory
           ```

        2. **Migrate to "General"** (default behavior):
           ```
           DELETE /documents/categories/OldCategory
           ```

        3. **Delete all documents** in the category:
           ```
           DELETE /documents/categories/OldCategory?delete_docs=true
           ```

        **Restrictions:**
        - Cannot delete the "General" category
        - Migration target must be a valid existing category
        """,
        "responses": {
            200: {
                "description": "Category successfully deleted",
                "content": {
                    "application/json": {
                        "example": ["General", "Personal", "Projects"]
                    }
                }
            },
            400: {
                "description": "Cannot delete General category or category not found"
            },
            422: {"description": "Invalid migration parameters"}
        }
    }
}

# Document Sharing Documentation
SHARING_DOCS = {
    "enable": {
        "summary": "Enable sharing for a document",
        "description": """
        Generate a sharing token for a document, making it publicly accessible.

        **Features:**
        - Generates a unique, secure sharing token
        - Token allows read-only access to the document
        - No authentication required for shared document access

        **Security:**
        - Tokens are cryptographically secure
        - Only the document owner can enable sharing
        - Tokens can be revoked at any time

        **Use Cases:**
        - Share documents with external collaborators
        - Create public documentation links
        - Temporary document access for reviews
        """,
        "responses": {
            200: {
                "description": "Sharing successfully enabled",
                "content": {
                    "application/json": {
                        "example": {
                            "share_token": "abc123def456ghi789",
                            "is_shared": True
                        }
                    }
                }
            },
            404: {"description": "Document not found or access denied"}
        }
    },
    "disable": {
        "summary": "Disable sharing for a document",
        "description": """
        Revoke the sharing token for a document, making it private again.

        **Effects:**
        - Existing sharing token becomes invalid
        - Public access is immediately revoked
        - Document becomes private again

        **⚠️ WARNING:**
        All existing shared links will stop working immediately.
        """,
        "responses": {
            200: {
                "description": "Sharing successfully disabled",
                "content": {
                    "application/json": {
                        "example": {"message": "Document sharing disabled"}
                    }
                }
            },
            404: {"description": "Document not found or access denied"}
        }
    }
}

# Request/Response Schema Documentation
SCHEMA_EXAMPLES = {
    "DocumentCreate": {
        "example": {
            "name": "Project Requirements",
            "content": "# Requirements Document\n\n## Overview\nThis document outlines...",
            "category_id": 1
        },
        "description": "Data required to create a new document"
    },
    "DocumentUpdate": {
        "example": {
            "name": "Updated Project Requirements",
            "content": "# Updated Requirements Document\n\n## Overview\nThis document outlines the updated...",
            "category_id": 2
        },
        "description": "Data for updating an existing document (all fields optional)"
    },
    "Document": {
        "example": {
            "id": 1,
            "name": "Project Requirements",
            "content": "# Requirements Document\n\n## Overview\nThis document outlines...",
            "category_id": 1,
            "category_name": "Work",
            "created_at": "2025-08-28T10:30:00Z",
            "updated_at": "2025-08-28T11:00:00Z",
            "user_id": 123,
            "is_shared": False,
            "share_token": None
        },
        "description": "Complete document object with metadata"
    },
    "DocumentList": {
        "example": {
            "documents": [
                {
                    "id": 1,
                    "name": "Project Requirements",
                    "category_name": "Work",
                    "created_at": "2025-08-28T10:30:00Z",
                    "updated_at": "2025-08-28T11:00:00Z"
                }
            ],
            "total": 25,
            "categories": ["General", "Work", "Personal"]
        },
        "description": "Paginated list of documents with metadata"
    }
}

# Error Response Examples
ERROR_EXAMPLES = {
    "ValidationError": {
        "example": {
            "detail": [
                {
                    "loc": ["body", "name"],
                    "msg": "field required",
                    "type": "value_error.missing"
                }
            ]
        }
    },
    "ConflictError": {
        "example": {
            "detail": {
                "detail": "A document with this name and category already exists.",
                "conflict_type": "name_conflict",
                "existing_document": {
                    "id": 15,
                    "name": "Meeting Notes",
                    "category_name": "Work"
                }
            }
        }
    },
    "NotFoundError": {
        "example": {
            "detail": "Document not found"
        }
    }
}
