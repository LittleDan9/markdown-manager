"""Enhanced security for GitHub integration."""
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession


class GitHubSecurityManager:
    """Security manager for GitHub integration."""

    def __init__(self):
        self.token_rotation_days = 30
        self.max_failed_requests = 5
        self.lockout_duration = timedelta(hours=1)

    def generate_state_token(self) -> str:
        """Generate a secure state token for OAuth."""
        return secrets.token_urlsafe(32)

    def validate_webhook_signature(self, payload: bytes, signature: str, secret: str) -> bool:
        """Validate GitHub webhook signature."""
        if not signature.startswith('sha256='):
            return False

        expected_signature = 'sha256=' + hmac.new(
            secret.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()

        return hmac.compare_digest(signature, expected_signature)

    async def check_token_freshness(
        self,
        db: AsyncSession,
        account: Any
    ) -> bool:
        """Check if token needs rotation."""
        if not hasattr(account, 'updated_at') or not account.updated_at:
            return False

        token_age = datetime.utcnow() - account.updated_at
        return token_age > timedelta(days=self.token_rotation_days)

    async def rotate_token_if_needed(
        self,
        db: AsyncSession,
        account: Any
    ) -> bool:
        """Rotate token if it's getting old."""
        needs_rotation = await self.check_token_freshness(db, account)

        if needs_rotation:
            # In a real implementation, you'd refresh the token here
            # For now, just mark that it needs rotation
            return True

        return False

    async def record_failed_request(
        self,
        db: AsyncSession,
        account_id: int,
        error_type: str = "api_error"
    ) -> None:
        """Record a failed API request."""
        # In a real implementation, you'd store this in a separate table
        # For now, this is a placeholder that logs the failure
        import logging
        logger = logging.getLogger("github_security")
        logger.warning(f"Failed GitHub request for account {account_id}: {error_type}")

    async def is_account_locked(
        self,
        db: AsyncSession,
        account_id: int
    ) -> bool:
        """Check if account is locked due to failed requests."""
        # In a real implementation, you'd check the failed requests table
        # For now, this always returns False
        return False

    def sanitize_github_data(self, data: dict) -> dict:
        """Sanitize GitHub API response data."""
        if not isinstance(data, dict):
            return data

        # Remove sensitive fields
        sensitive_fields = ['private_repos_count', 'total_private_repos', 'disk_usage']

        sanitized = data.copy()
        for field in sensitive_fields:
            sanitized.pop(field, None)

        # Validate URLs
        if 'html_url' in sanitized:
            if not sanitized['html_url'].startswith('https://github.com/'):
                sanitized.pop('html_url', None)

        # Sanitize nested objects
        for key, value in sanitized.items():
            if isinstance(value, dict):
                sanitized[key] = self.sanitize_github_data(value)
            elif isinstance(value, list):
                sanitized[key] = [
                    self.sanitize_github_data(item) if isinstance(item, dict) else item
                    for item in value
                ]

        return sanitized

    def validate_repository_access(
        self,
        account: Any,
        repository_full_name: str
    ) -> bool:
        """Validate that account has access to repository."""
        # This is a simplified check
        # In production, you'd verify against actual permissions

        if not hasattr(account, 'is_active') or not account.is_active:
            return False

        # Check if repository name is valid format
        if '/' not in repository_full_name:
            return False

        owner, repo = repository_full_name.split('/', 1)

        # Basic validation
        if not owner or not repo:
            return False

        # Check for suspicious patterns
        suspicious_patterns = ['..', '<script', 'javascript:', 'data:']
        full_name = repository_full_name.lower()

        for pattern in suspicious_patterns:
            if pattern in full_name:
                return False

        return True

    def validate_github_username(self, username: str) -> bool:
        """Validate GitHub username format."""
        if not username:
            return False

        # GitHub username rules:
        # - May only contain alphanumeric characters or single hyphens
        # - Cannot begin or end with a hyphen
        # - Maximum is 39 characters
        
        if len(username) > 39:
            return False

        if username.startswith('-') or username.endswith('-'):
            return False

        # Check for consecutive hyphens
        if '--' in username:
            return False

        # Check characters
        for char in username:
            if not (char.isalnum() or char == '-'):
                return False

        return True

    def validate_repository_name(self, repo_name: str) -> bool:
        """Validate GitHub repository name format."""
        if not repo_name:
            return False

        # GitHub repository name rules:
        # - Cannot start with a period or hyphen
        # - Cannot end with a period
        # - Cannot contain certain characters

        if repo_name.startswith('.') or repo_name.startswith('-'):
            return False

        if repo_name.endswith('.'):
            return False

        # Check for invalid characters
        invalid_chars = ['<', '>', ':', '"', '|', '?', '*', '\\', '/']
        for char in invalid_chars:
            if char in repo_name:
                return False

        return True

    async def audit_log_action(
        self,
        db: AsyncSession,
        user_id: int,
        action: str,
        resource: str,
        details: Optional[dict] = None
    ) -> None:
        """Log security-relevant actions."""
        # In production, you'd store this in an audit log table
        import logging

        logger = logging.getLogger("github_security")
        logger.info(
            f"GitHub action: user={user_id}, action={action}, "
            f"resource={resource}, details={details}"
        )

    def validate_file_path(self, file_path: str) -> bool:
        """Validate GitHub file path."""
        if not file_path:
            return False

        # Check for path traversal attempts
        if '..' in file_path:
            return False

        # Check for absolute paths
        if file_path.startswith('/'):
            return False

        # Check for null bytes or other suspicious characters
        suspicious_chars = ['\x00', '\r', '\n']
        for char in suspicious_chars:
            if char in file_path:
                return False

        return True

    def rate_limit_key(self, account_id: int, endpoint: str) -> str:
        """Generate rate limit key for specific endpoint."""
        return f"rate_limit:{account_id}:{endpoint}"

    async def check_endpoint_rate_limit(
        self,
        account_id: int,
        endpoint: str,
        max_requests: int = 100,
        window_minutes: int = 60
    ) -> bool:
        """Check rate limit for specific endpoint."""
        # This would integrate with the cache service for tracking
        # For now, just return True (allow all requests)
        return True


# Global security manager
github_security = GitHubSecurityManager()
