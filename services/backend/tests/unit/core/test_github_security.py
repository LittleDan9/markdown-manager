"""Tests for GitHub security manager."""
import hashlib
import hmac
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.github_security import GitHubSecurityManager


class TestGitHubSecurityManager:
    """Tests for GitHubSecurityManager initialization and configuration."""

    @pytest.fixture
    def manager(self):
        return GitHubSecurityManager()

    def test_default_configuration(self, manager):
        assert manager.token_rotation_days == 30
        assert manager.max_failed_requests == 5
        assert manager.lockout_duration == timedelta(hours=1)


class TestGenerateStateToken:
    """Tests for OAuth state token generation."""

    @pytest.fixture
    def manager(self):
        return GitHubSecurityManager()

    def test_generates_non_empty_token(self, manager):
        token = manager.generate_state_token()
        assert token
        assert len(token) > 0

    def test_generates_unique_tokens(self, manager):
        tokens = {manager.generate_state_token() for _ in range(50)}
        assert len(tokens) == 50

    def test_token_is_url_safe(self, manager):
        token = manager.generate_state_token()
        # URL-safe base64 uses only these characters
        safe_chars = set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_=")
        assert all(c in safe_chars for c in token)


class TestValidateWebhookSignature:
    """Tests for GitHub webhook HMAC-SHA256 signature validation."""

    @pytest.fixture
    def manager(self):
        return GitHubSecurityManager()

    def _make_signature(self, payload: bytes, secret: str) -> str:
        """Helper: compute the correct sha256 signature."""
        digest = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
        return f"sha256={digest}"

    def test_valid_signature(self, manager):
        payload = b'{"action": "push"}'
        secret = "my-webhook-secret"
        sig = self._make_signature(payload, secret)
        assert manager.validate_webhook_signature(payload, sig, secret) is True

    def test_invalid_signature(self, manager):
        payload = b'{"action": "push"}'
        secret = "my-webhook-secret"
        assert manager.validate_webhook_signature(payload, "sha256=badhex", secret) is False

    def test_tampered_payload(self, manager):
        payload = b'{"action": "push"}'
        secret = "my-webhook-secret"
        sig = self._make_signature(payload, secret)
        tampered = b'{"action": "delete"}'
        assert manager.validate_webhook_signature(tampered, sig, secret) is False

    def test_wrong_secret(self, manager):
        payload = b'{"action": "push"}'
        sig = self._make_signature(payload, "correct-secret")
        assert manager.validate_webhook_signature(payload, sig, "wrong-secret") is False

    def test_missing_sha256_prefix(self, manager):
        payload = b'{"action": "push"}'
        digest = hmac.new(b"secret", payload, hashlib.sha256).hexdigest()
        assert manager.validate_webhook_signature(payload, digest, "secret") is False

    def test_sha1_prefix_rejected(self, manager):
        payload = b'{"action": "push"}'
        digest = hmac.new(b"secret", payload, hashlib.sha256).hexdigest()
        assert manager.validate_webhook_signature(payload, f"sha1={digest}", "secret") is False

    def test_empty_payload(self, manager):
        payload = b""
        secret = "secret"
        sig = self._make_signature(payload, secret)
        assert manager.validate_webhook_signature(payload, sig, secret) is True

    def test_large_payload(self, manager):
        payload = b"x" * 100_000
        secret = "secret"
        sig = self._make_signature(payload, secret)
        assert manager.validate_webhook_signature(payload, sig, secret) is True


class TestTokenFreshness:
    """Tests for token age checking and rotation."""

    @pytest.fixture
    def manager(self):
        return GitHubSecurityManager()

    async def test_fresh_token(self, manager):
        mock_db = AsyncMock()
        account = MagicMock()
        account.updated_at = datetime.utcnow() - timedelta(days=5)
        result = await manager.check_token_freshness(mock_db, account)
        assert result is False  # 5 days < 30 days, still fresh

    async def test_stale_token(self, manager):
        mock_db = AsyncMock()
        account = MagicMock()
        account.updated_at = datetime.utcnow() - timedelta(days=31)
        result = await manager.check_token_freshness(mock_db, account)
        assert result is True  # 31 days > 30 days, needs rotation

    async def test_no_updated_at(self, manager):
        mock_db = AsyncMock()
        account = MagicMock(spec=[])  # no attributes
        result = await manager.check_token_freshness(mock_db, account)
        assert result is False

    async def test_none_updated_at(self, manager):
        mock_db = AsyncMock()
        account = MagicMock()
        account.updated_at = None
        result = await manager.check_token_freshness(mock_db, account)
        assert result is False

    async def test_rotate_not_needed(self, manager):
        mock_db = AsyncMock()
        account = MagicMock()
        account.updated_at = datetime.utcnow() - timedelta(days=1)
        result = await manager.rotate_token_if_needed(mock_db, account)
        assert result is False

    async def test_rotate_needed(self, manager):
        mock_db = AsyncMock()
        account = MagicMock()
        account.updated_at = datetime.utcnow() - timedelta(days=31)
        result = await manager.rotate_token_if_needed(mock_db, account)
        assert result is True


class TestAccountLockout:
    """Tests for account lockout and failed request tracking."""

    @pytest.fixture
    def manager(self):
        return GitHubSecurityManager()

    async def test_is_account_locked_default(self, manager):
        mock_db = AsyncMock()
        result = await manager.is_account_locked(mock_db, account_id=1)
        assert result is False

    async def test_record_failed_request_does_not_raise(self, manager):
        mock_db = AsyncMock()
        # Should complete without error
        await manager.record_failed_request(mock_db, account_id=1, error_type="rate_limit")


class TestSanitizeGitHubData:
    """Tests for GitHub API response data sanitization."""

    @pytest.fixture
    def manager(self):
        return GitHubSecurityManager()

    def test_removes_sensitive_fields(self, manager):
        data = {
            "login": "user",
            "private_repos_count": 42,
            "total_private_repos": 42,
            "disk_usage": 12345,
            "html_url": "https://github.com/user",
        }
        result = manager.sanitize_github_data(data)
        assert "private_repos_count" not in result
        assert "total_private_repos" not in result
        assert "disk_usage" not in result
        assert result["login"] == "user"

    def test_preserves_safe_fields(self, manager):
        data = {"login": "user", "name": "Test", "avatar_url": "https://example.com/avatar.png"}
        result = manager.sanitize_github_data(data)
        assert result == data  # nothing removed

    def test_non_dict_passthrough(self, manager):
        assert manager.sanitize_github_data("not a dict") == "not a dict"
        assert manager.sanitize_github_data(42) == 42
        assert manager.sanitize_github_data(None) is None

    def test_does_not_mutate_original(self, manager):
        data = {"login": "user", "disk_usage": 100}
        manager.sanitize_github_data(data)
        assert "disk_usage" in data  # original unchanged

    def test_valid_github_url_preserved(self, manager):
        data = {"html_url": "https://github.com/user/repo"}
        result = manager.sanitize_github_data(data)
        assert result["html_url"] == "https://github.com/user/repo"
