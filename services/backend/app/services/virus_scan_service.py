"""
Virus scanning service using ClamAV.

Provides virus scanning of uploaded files via the ClamAV daemon using stream
scanning (INSTREAM command). Bytes are sent over the TCP socket — no shared
filesystem volume between the app and ClamAV container is required.

Operates in fail-closed mode: if ClamAV is unreachable, uploads are rejected.
"""
import logging
from dataclasses import dataclass
from typing import Optional

import pyclamd

from app.configs.settings import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class ScanResult:
    """Result of a virus scan."""

    status: str  # "clean", "infected", "error"
    detail: Optional[str] = None


class VirusScanService:
    """ClamAV virus scanning service."""

    def __init__(self):
        self.host = getattr(settings, "clamav_host", "clamav")
        self.port = int(getattr(settings, "clamav_port", 3310))
        self._clamd: Optional[pyclamd.ClamdNetworkSocket] = None

    def _get_connection(self) -> pyclamd.ClamdNetworkSocket:
        """Get or create a ClamAV connection."""
        if self._clamd is None:
            self._clamd = pyclamd.ClamdNetworkSocket(
                host=self.host, port=self.port, timeout=30
            )
        return self._clamd

    def is_available(self) -> bool:
        """Check if ClamAV daemon is reachable."""
        try:
            cd = self._get_connection()
            return cd.ping()
        except Exception:
            self._clamd = None
            return False

    def scan_stream(self, data: bytes) -> ScanResult:
        """
        Scan file bytes for viruses via ClamAV INSTREAM command.

        Args:
            data: Raw file bytes to scan.

        Returns:
            ScanResult with status and detail.

        Raises:
            ConnectionError: If ClamAV is not reachable (fail-closed).
        """
        try:
            cd = self._get_connection()

            if not cd.ping():
                self._clamd = None
                raise ConnectionError("ClamAV daemon is not responding")

            result = cd.scan_stream(data)

            if result is None:
                return ScanResult(status="clean")

            # result is dict like {'stream': ('FOUND', 'Eicar-Test-Signature')}
            stream_result = result.get("stream")
            if stream_result is None:
                return ScanResult(status="clean")

            status_code, signature = stream_result
            if status_code == "FOUND":
                logger.warning("Virus detected in upload: %s", signature)
                return ScanResult(status="infected", detail=signature)

            return ScanResult(status="clean")

        except ConnectionError:
            raise
        except Exception as e:
            logger.error("Virus scan failed: %s", e)
            self._clamd = None
            return ScanResult(status="error", detail=str(e))


virus_scan_service = VirusScanService()
