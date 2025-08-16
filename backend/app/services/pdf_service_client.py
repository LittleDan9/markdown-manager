"""PDF Service HTTP Client."""
import logging
import os
from typing import Optional

import httpx
from fastapi import HTTPException

logger = logging.getLogger(__name__)


class PDFServiceClient:
    """HTTP client for communicating with the PDF service."""

    def __init__(self, pdf_service_url: Optional[str] = None):
        # Use environment variable or default to localhost for development
        self.base_url = pdf_service_url or os.getenv(
            "PDF_SERVICE_URL", "http://localhost:8001"
        )
        self.timeout = httpx.Timeout(30.0)  # 30 second timeout for PDF generation

    async def generate_pdf(
        self,
        html_content: str,
        document_name: str,
        is_dark_mode: bool = False,
        options: Optional[dict] = None,
    ) -> bytes:
        """Generate PDF by calling the PDF service."""
        try:
            logger.info(f"Requesting PDF generation for document: {document_name}")

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                payload = {
                    "html_content": html_content,
                    "document_name": document_name,
                    "is_dark_mode": is_dark_mode,
                    "options": options or {},
                }

                response = await client.post(
                    f"{self.base_url}/generate-pdf", json=payload
                )

                if response.status_code != 200:
                    error_detail = f"PDF service error: {response.status_code}"
                    try:
                        error_data = response.json()
                        error_detail = error_data.get("detail", error_detail)
                    except Exception:
                        pass

                    logger.error(f"PDF service failed: {error_detail}")
                    raise HTTPException(
                        status_code=503,
                        detail=f"PDF service unavailable: {error_detail}",
                    )

                pdf_bytes = response.content
                logger.info(f"PDF generated successfully, size: {len(pdf_bytes)} bytes")
                return pdf_bytes

        except httpx.TimeoutException:
            logger.error("PDF service timeout")
            raise HTTPException(status_code=504, detail="PDF generation timeout")
        except httpx.ConnectError:
            logger.error("Cannot connect to PDF service")
            raise HTTPException(
                status_code=503, detail="PDF service unavailable - connection failed"
            )
        except HTTPException:
            # Re-raise HTTPExceptions as-is
            raise
        except Exception as e:
            logger.error(f"Unexpected error calling PDF service: {str(e)}")
            raise HTTPException(
                status_code=500, detail=f"PDF generation failed: {str(e)}"
            )

    async def health_check(self) -> bool:
        """Check if the PDF service is healthy."""
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
                response = await client.get(f"{self.base_url}/health")
                return response.status_code == 200
        except Exception as e:
            logger.warning(f"PDF service health check failed: {e}")
            return False


# Global PDF service client instance
pdf_service_client = PDFServiceClient()
