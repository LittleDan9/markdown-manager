"""Helper functions for folder migration."""


def extract_root_folder(folder_path: str) -> str:
    """Extract root folder from full path."""
    parts = [p for p in folder_path.split('/') if p]
    if not parts:
        return '/'
    return f"/{parts[0]}"


def validate_folder_path(folder_path: str) -> bool:
    """Validate folder path format."""
    if not folder_path.startswith('/'):
        return False

    # Check for invalid characters
    invalid_chars = ['\\', ':', '*', '?', '"', '<', '>', '|']
    return not any(char in folder_path for char in invalid_chars)


def migrate_github_documents():
    """Special migration for GitHub documents to proper folder structure."""
    # This will be used in Phase 4
    pass
