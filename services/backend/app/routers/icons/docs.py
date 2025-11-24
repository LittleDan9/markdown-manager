"""
OpenAPI documentation for Icon API endpoints.
Externalized documentation to keep router files manageable.
"""

# Common responses for all icon endpoints
COMMON_RESPONSES = {
    404: {"description": "Icon or pack not found"},
    500: {"description": "Internal server error"}
}

# Icon Pack Endpoints Documentation
ICON_PACKS_DOCS = {
    "get": {
        "summary": "List all icon packs",
        "description": """
        Retrieve a list of all available icon packs in the system.

        This endpoint returns metadata for all installed icon packs including:
        - Pack name and display name
        - Category classification
        - Icon count per pack
        - Installation status

        **Use cases:**
        - Populate pack selection dropdowns
        - Get overview of available icon libraries
        - Check pack installation status
        """,
        "responses": {
            200: {
                "description": "Successfully retrieved icon packs",
                "content": {
                    "application/json": {
                        "example": {
                            "packs": [
                                {
                                    "name": "aws-icons",
                                    "display_name": "AWS Icons",
                                    "category": "cloud",
                                    "icon_count": 825,
                                    "description": "Official AWS service icons"
                                }
                            ],
                            "total": 1
                        }
                    }
                }
            }
        }
    },
    "post": {
        "summary": "Install a new icon pack",
        "description": """
        Install a new icon pack from various sources with flexible data mapping.

        **Supported Package Types:**
        - **json**: Iconify JSON format
        - **npm**: NPM package with icon data
        - **zip**: Compressed archive with SVG files
        - **directory**: Local directory with icon files

        **Example Request Body:**
        ```json
        {
            "pack_data": {
                "name": "my-custom-pack",
                "display_name": "My Custom Icons",
                "category": "custom",
                "icons": {
                    "home": {
                        "body": "<path d='M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z'/>",
                        "width": 24,
                        "height": 24
                    },
                    "star": {
                        "body": (
                            "<path d='M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 "
                            "2 9.27l6.91-1.01L12 2z'/>"
                        ),
                        "width": 24,
                        "height": 24
                    },
                    "settings": {
                        "body": "<circle cx='12' cy='12' r='2'/><circle cx='12' cy='12' r='8'/>",
                        "width": 24,
                        "height": 24
                    }
                }
            },
            "mapping_config": {
                "name_field": "name",
                "icons_field": "icons",
                "body_field": "body",
                "width_field": "width",
                "height_field": "height"
            },
            "package_type": "json"
        }
        ```
        """,
        "responses": {
            200: {
                "description": "Icon pack successfully installed",
                "content": {
                    "application/json": {
                        "example": {
                            "name": "custom-icons",
                            "display_name": "Custom Icon Set",
                            "category": "custom",
                            "icon_count": 3
                        }
                    }
                }
            },
            400: {"description": "Invalid pack data or configuration"},
            409: {"description": "Pack already exists"}
        }
    },
    "put": {
        "summary": "Update an existing icon pack",
        "description": """
        Update an existing icon pack with new icons or modified configuration.

        **Safety Features:**
        - Atomic updates (all or nothing)
        - Automatic rollback on failure
        - Cache invalidation
        """,
        "responses": {
            200: {"description": "Icon pack successfully updated"},
            404: {"description": "Icon pack not found"},
            400: {"description": "Invalid update data"}
        }
    },
    "delete": {
        "summary": "Delete an icon pack",
        "description": """
        Permanently delete an icon pack and all its associated icons.

        **⚠️ WARNING: This action is IRREVERSIBLE**
        """,
        "responses": {
            200: {"description": "Deletion result (success or not found)"},
            500: {"description": "Deletion failed due to server error"}
        }
    }
}

# Icon Search Documentation
ICON_SEARCH_DOCS = {
    "summary": "Search icons with filters and pagination",
    "description": """
    Search for icons across all packs with powerful filtering and pagination.

    **Filtering Options:**
    - **Text Search (q)**: Search in icon names, descriptions, and tags
    - **Pack Filter**: Limit search to specific icon pack
    - **Category Filter**: Filter by icon category

    **Search Examples:**
    - Find AWS EC2 icons: `?q=ec2&pack=aws-icons`
    - Get all logos: `?category=logos&size=50`
    - Browse first page: `?page=0&size=24`
    """,
    "responses": {
        200: {
            "description": "Search results with pagination info",
            "content": {
                "application/json": {
                    "example": {
                        "icons": [
                            {
                                "key": "ec2",
                                "pack": {"name": "aws-icons", "display_name": "AWS Icons"},
                                "icon_data": {"body": "<path d='...'/>", "viewBox": "0 0 24 24"}
                            }
                        ],
                        "total": 1,
                        "page": 0,
                        "size": 24
                    }
                }
            }
        },
        422: {"description": "Invalid search parameters"}
    }
}

# Icon Metadata Documentation
ICON_METADATA_DOCS = {
    "summary": "Get detailed metadata for a specific icon",
    "description": """
    Retrieve comprehensive metadata for a specific icon by pack name and key.

    **Returns:**
    - Icon SVG data (body, viewBox, dimensions)
    - Pack information and categorization
    - Usage statistics and popularity
    """,
    "responses": {
        200: {"description": "Icon metadata successfully retrieved"},
        404: {"description": "Icon not found"}
    }
}

# Icon SVG Documentation
ICON_SVG_DOCS = {
    "summary": "Get SVG content for an icon",
    "description": """
    Retrieve the complete SVG markup for a specific icon, ready for direct rendering.

    **Features:**
    - Returns complete SVG with proper XML headers
    - Includes caching headers for performance
    - Automatically tracks usage statistics
    """,
    "responses": {
        200: {"description": "SVG content successfully retrieved"},
        404: {"description": "Icon SVG not found"}
    }
}

# Cache Management Documentation
CACHE_DOCS = {
    "stats": {
        "summary": "Get cache performance statistics",
        "description": "Retrieve detailed statistics about the icon cache performance."
    },
    "warm": {
        "summary": "Warm cache with popular icons",
        "description": "Pre-load the cache with the most popular icons for improved performance."
    },
    "clear": {
        "summary": "Clear all cache entries",
        "description": "Clear all cached icon data to free memory or force fresh data loading."
    }
}

# Statistics Documentation
STATISTICS_DOCS = {
    "summary": "Get comprehensive icon usage statistics",
    "description": """
    Retrieve detailed statistics about icon packs, usage patterns, and system metrics.

    **Statistics Include:**
    - Pack overview and category breakdown
    - Popular icons with access counts
    - Usage trends and analytics
    """
}
