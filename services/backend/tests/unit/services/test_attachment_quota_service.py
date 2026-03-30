"""Tests for attachment quota service."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.attachment_quota_service import (
    DEFAULT_QUOTA_BYTES,
    QuotaCheckResult,
    QuotaUsage,
    _format_bytes,
    check_quota,
    get_effective_quota,
    get_quota_usage,
    get_site_default_quota,
)


class TestFormatBytes:
    """Tests for the byte formatting helper."""

    def test_bytes(self):
        assert _format_bytes(500) == "500.0 B"

    def test_kilobytes(self):
        assert _format_bytes(1024) == "1.0 KB"

    def test_megabytes(self):
        assert _format_bytes(1024 * 1024) == "1.0 MB"

    def test_gigabytes(self):
        assert _format_bytes(1024 ** 3) == "1.0 GB"

    def test_terabytes(self):
        assert _format_bytes(1024 ** 4) == "1.0 TB"

    def test_zero(self):
        assert _format_bytes(0) == "0.0 B"


class TestQuotaDataclasses:
    """Tests for quota data models."""

    def test_quota_usage(self):
        usage = QuotaUsage(
            used_bytes=100,
            quota_bytes=1000,
            remaining_bytes=900,
            percentage_used=10.0,
        )
        assert usage.remaining_bytes == 900
        assert usage.percentage_used == 10.0

    def test_quota_check_allowed(self):
        usage = QuotaUsage(used_bytes=0, quota_bytes=1000, remaining_bytes=1000, percentage_used=0.0)
        result = QuotaCheckResult(allowed=True, usage=usage)
        assert result.allowed is True
        assert result.message is None

    def test_quota_check_denied(self):
        usage = QuotaUsage(used_bytes=950, quota_bytes=1000, remaining_bytes=50, percentage_used=95.0)
        result = QuotaCheckResult(allowed=False, usage=usage, message="Over limit")
        assert result.allowed is False
        assert result.message == "Over limit"


class TestGetSiteDefaultQuota:
    """Tests for site-wide default quota resolution."""

    async def test_returns_setting_value(self):
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = "1073741824"  # 1 GB
        mock_db.execute.return_value = mock_result

        quota = await get_site_default_quota(mock_db)
        assert quota == 1073741824

    async def test_returns_default_when_no_setting(self):
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        quota = await get_site_default_quota(mock_db)
        assert quota == DEFAULT_QUOTA_BYTES

    async def test_returns_default_on_invalid_value(self):
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = "not-a-number"
        mock_db.execute.return_value = mock_result

        quota = await get_site_default_quota(mock_db)
        assert quota == DEFAULT_QUOTA_BYTES


class TestGetEffectiveQuota:
    """Tests for per-user effective quota resolution."""

    async def test_user_override_takes_priority(self):
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = 2_000_000_000
        mock_db.execute.return_value = mock_result

        quota = await get_effective_quota(mock_db, user_id=1)
        assert quota == 2_000_000_000

    @patch("app.services.attachment_quota_service.get_site_default_quota")
    async def test_falls_back_to_site_default(self, mock_site_default):
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result
        mock_site_default.return_value = 500_000_000

        quota = await get_effective_quota(mock_db, user_id=1)
        assert quota == 500_000_000
        mock_site_default.assert_awaited_once_with(mock_db)


class TestGetQuotaUsage:
    """Tests for quota usage calculation."""

    @patch("app.services.attachment_quota_service.get_effective_quota")
    @patch("app.services.attachment_quota_service.attachment_crud")
    async def test_calculates_usage(self, mock_crud, mock_effective):
        mock_db = AsyncMock()
        mock_crud.get_user_total_size = AsyncMock(return_value=100_000_000)
        mock_effective.return_value = 500_000_000

        usage = await get_quota_usage(mock_db, user_id=1)
        assert usage.used_bytes == 100_000_000
        assert usage.quota_bytes == 500_000_000
        assert usage.remaining_bytes == 400_000_000
        assert usage.percentage_used == 20.0

    @patch("app.services.attachment_quota_service.get_effective_quota")
    @patch("app.services.attachment_quota_service.attachment_crud")
    async def test_remaining_never_negative(self, mock_crud, mock_effective):
        mock_db = AsyncMock()
        mock_crud.get_user_total_size = AsyncMock(return_value=600_000_000)
        mock_effective.return_value = 500_000_000

        usage = await get_quota_usage(mock_db, user_id=1)
        assert usage.remaining_bytes == 0  # clamped to 0

    @patch("app.services.attachment_quota_service.get_effective_quota")
    @patch("app.services.attachment_quota_service.attachment_crud")
    async def test_zero_quota_zero_percentage(self, mock_crud, mock_effective):
        mock_db = AsyncMock()
        mock_crud.get_user_total_size = AsyncMock(return_value=0)
        mock_effective.return_value = 0

        usage = await get_quota_usage(mock_db, user_id=1)
        assert usage.percentage_used == 0.0


class TestCheckQuota:
    """Tests for quota enforcement on upload."""

    @patch("app.services.attachment_quota_service.get_quota_usage")
    async def test_upload_allowed(self, mock_usage):
        mock_db = AsyncMock()
        mock_usage.return_value = QuotaUsage(
            used_bytes=100_000_000,
            quota_bytes=500_000_000,
            remaining_bytes=400_000_000,
            percentage_used=20.0,
        )

        result = await check_quota(mock_db, user_id=1, incoming_file_size=10_000_000)
        assert result.allowed is True
        assert result.message is None

    @patch("app.services.attachment_quota_service.get_quota_usage")
    async def test_upload_denied_exceeds_quota(self, mock_usage):
        mock_db = AsyncMock()
        mock_usage.return_value = QuotaUsage(
            used_bytes=490_000_000,
            quota_bytes=500_000_000,
            remaining_bytes=10_000_000,
            percentage_used=98.0,
        )

        result = await check_quota(mock_db, user_id=1, incoming_file_size=20_000_000)
        assert result.allowed is False
        assert "quota exceeded" in result.message.lower()

    @patch("app.services.attachment_quota_service.get_quota_usage")
    async def test_upload_exactly_fills_quota(self, mock_usage):
        mock_db = AsyncMock()
        mock_usage.return_value = QuotaUsage(
            used_bytes=490_000_000,
            quota_bytes=500_000_000,
            remaining_bytes=10_000_000,
            percentage_used=98.0,
        )

        # Exactly 10MB remaining, uploading 10MB — should be allowed (used + incoming == quota)
        result = await check_quota(mock_db, user_id=1, incoming_file_size=10_000_000)
        assert result.allowed is True
