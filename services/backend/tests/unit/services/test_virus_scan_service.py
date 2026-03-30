"""Tests for virus scanning service."""
from pathlib import Path
from unittest.mock import MagicMock, patch, PropertyMock

import pytest

from app.services.virus_scan_service import VirusScanService, ScanResult


class TestScanResult:
    """Tests for the ScanResult dataclass."""

    def test_clean_result(self):
        result = ScanResult(status="clean")
        assert result.status == "clean"
        assert result.detail is None

    def test_infected_result(self):
        result = ScanResult(status="infected", detail="Eicar-Test-Signature")
        assert result.status == "infected"
        assert result.detail == "Eicar-Test-Signature"

    def test_error_result(self):
        result = ScanResult(status="error", detail="Connection refused")
        assert result.status == "error"
        assert result.detail == "Connection refused"


class TestVirusScanServiceInit:
    """Tests for VirusScanService initialization."""

    @patch("app.services.virus_scan_service.get_settings")
    def test_default_host_and_port(self, mock_settings):
        settings = MagicMock()
        settings.clamav_host = "clamav"
        settings.clamav_port = 3310
        mock_settings.return_value = settings
        service = VirusScanService()
        assert service.host == "clamav"
        assert service.port == 3310
        assert service._clamd is None

    @patch("app.services.virus_scan_service.settings")
    def test_custom_host_and_port(self, mock_settings):
        mock_settings.clamav_host = "custom-host"
        mock_settings.clamav_port = "9999"
        service = VirusScanService()
        assert service.host == "custom-host"
        assert service.port == 9999


class TestIsAvailable:
    """Tests for ClamAV availability checks."""

    @patch("app.services.virus_scan_service.get_settings")
    def test_available_when_ping_succeeds(self, mock_settings):
        mock_settings.return_value = MagicMock(clamav_host="clamav", clamav_port=3310)
        service = VirusScanService()
        mock_clamd = MagicMock()
        mock_clamd.ping.return_value = True
        service._clamd = mock_clamd
        assert service.is_available() is True

    @patch("app.services.virus_scan_service.get_settings")
    def test_unavailable_when_ping_fails(self, mock_settings):
        mock_settings.return_value = MagicMock(clamav_host="clamav", clamav_port=3310)
        service = VirusScanService()
        mock_clamd = MagicMock()
        mock_clamd.ping.side_effect = Exception("Connection refused")
        service._clamd = mock_clamd
        assert service.is_available() is False
        assert service._clamd is None  # connection reset on failure


class TestScanFile:
    """Tests for file scanning functionality."""

    @pytest.fixture
    def service(self):
        with patch("app.services.virus_scan_service.get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(clamav_host="clamav", clamav_port=3310)
            svc = VirusScanService()
        return svc

    def test_clean_file(self, service):
        mock_clamd = MagicMock()
        mock_clamd.ping.return_value = True
        mock_clamd.scan_file.return_value = None  # None means clean
        service._clamd = mock_clamd

        result = service.scan_file(Path("/tmp/test.txt"))
        assert result.status == "clean"
        assert result.detail is None

    def test_infected_file(self, service):
        mock_clamd = MagicMock()
        mock_clamd.ping.return_value = True
        file_path = Path("/tmp/eicar.txt")
        mock_clamd.scan_file.return_value = {
            str(file_path): ("FOUND", "Eicar-Test-Signature")
        }
        service._clamd = mock_clamd

        result = service.scan_file(file_path)
        assert result.status == "infected"
        assert result.detail == "Eicar-Test-Signature"

    def test_clean_file_with_no_match_in_result(self, service):
        mock_clamd = MagicMock()
        mock_clamd.ping.return_value = True
        # Result dict exists but doesn't contain our file path
        mock_clamd.scan_file.return_value = {"/some/other/path": ("FOUND", "Virus")}
        service._clamd = mock_clamd

        result = service.scan_file(Path("/tmp/test.txt"))
        assert result.status == "clean"

    def test_daemon_not_responding_raises(self, service):
        mock_clamd = MagicMock()
        mock_clamd.ping.return_value = False
        service._clamd = mock_clamd

        with pytest.raises(ConnectionError, match="ClamAV daemon is not responding"):
            service.scan_file(Path("/tmp/test.txt"))

    def test_connection_error_propagates(self, service):
        mock_clamd = MagicMock()
        mock_clamd.ping.return_value = True
        mock_clamd.scan_file.side_effect = ConnectionError("Lost connection")
        service._clamd = mock_clamd

        with pytest.raises(ConnectionError):
            service.scan_file(Path("/tmp/test.txt"))

    def test_unexpected_error_returns_error_result(self, service):
        mock_clamd = MagicMock()
        mock_clamd.ping.return_value = True
        mock_clamd.scan_file.side_effect = RuntimeError("Unexpected failure")
        service._clamd = mock_clamd

        result = service.scan_file(Path("/tmp/test.txt"))
        assert result.status == "error"
        assert "Unexpected failure" in result.detail
        assert service._clamd is None  # connection reset
