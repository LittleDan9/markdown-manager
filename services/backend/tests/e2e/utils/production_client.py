"""Production client utilities for E2E testing."""
import time
from typing import Any, Dict, List

from httpx import AsyncClient, Response


class ProductionTestClient:
    """Wrapper around AsyncClient with E2E-specific utilities."""

    def __init__(self, client: AsyncClient):
        self.client = client
        self.response_times: List[float] = []

    async def request_with_timing(self, method: str, url: str, **kwargs) -> Response:
        """Make request and track response time."""
        start_time = time.time()
        response = await self.client.request(method, url, **kwargs)
        end_time = time.time()

        response_time = end_time - start_time
        self.response_times.append(response_time)

        return response

    async def get(self, url: str, **kwargs) -> Response:
        """GET request with timing."""
        return await self.request_with_timing("GET", url, **kwargs)

    async def post(self, url: str, **kwargs) -> Response:
        """POST request with timing."""
        return await self.request_with_timing("POST", url, **kwargs)

    async def put(self, url: str, **kwargs) -> Response:
        """PUT request with timing."""
        return await self.request_with_timing("PUT", url, **kwargs)

    async def delete(self, url: str, **kwargs) -> Response:
        """DELETE request with timing."""
        return await self.request_with_timing("DELETE", url, **kwargs)

    def get_average_response_time(self) -> float:
        """Calculate average response time."""
        return (
            sum(self.response_times) / len(self.response_times)
            if self.response_times
            else 0
        )

    def get_max_response_time(self) -> float:
        """Get maximum response time."""
        return max(self.response_times) if self.response_times else 0

    def reset_timing_stats(self) -> None:
        """Reset timing statistics."""
        self.response_times.clear()


async def assert_response_success(
    response: Response, expected_status: int = 200
) -> Dict[str, Any]:
    """Assert response is successful and return JSON data."""
    assert response.status_code == expected_status, (
        f"Expected status {expected_status}, got {response.status_code}. "
        f"Response: {response.text}"
    )

    try:
        return response.json()
    except ValueError:
        # Response might not be JSON (e.g., DELETE responses)
        return {}


async def assert_response_error(response: Response, expected_status: int) -> None:
    """Assert response has expected error status."""
    assert response.status_code == expected_status, (
        f"Expected error status {expected_status}, got {response.status_code}. "
        f"Response: {response.text}"
    )


def validate_schema_fields(data: Dict[str, Any], required_fields: List[str]) -> None:
    """Validate that response data contains required fields."""
    missing_fields = [field for field in required_fields if field not in data]
    assert not missing_fields, f"Missing required fields: {missing_fields}"


def validate_document_schema(doc_data: Dict[str, Any]) -> None:
    """Validate document response schema."""
    required_fields = ["id", "title", "content", "created_at", "updated_at"]
    validate_schema_fields(doc_data, required_fields)


def validate_category_schema(cat_data: Dict[str, Any]) -> None:
    """Validate category response schema."""
    required_fields = ["id", "name", "created_at", "updated_at"]
    validate_schema_fields(cat_data, required_fields)


def validate_dictionary_schema(dict_data: Dict[str, Any]) -> None:
    """Validate dictionary entry response schema."""
    required_fields = ["id", "word", "definition", "created_at", "updated_at"]
    validate_schema_fields(dict_data, required_fields)


def validate_user_schema(user_data: Dict[str, Any]) -> None:
    """Validate user response schema."""
    required_fields = ["id", "email", "created_at", "updated_at"]
    validate_schema_fields(user_data, required_fields)

    # Ensure sensitive fields are not present
    sensitive_fields = ["password", "hashed_password"]
    present_sensitive = [field for field in sensitive_fields if field in user_data]
    assert (
        not present_sensitive
    ), f"Sensitive fields present in response: {present_sensitive}"
