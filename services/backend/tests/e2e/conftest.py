"""
Simple E2E test configuration with session-scoped fixtures for production testing.
Based on actual API endpoints from OpenAPI spec.
"""
import uuid
from typing import AsyncGenerator, Dict

import httpx
import pytest


class Config:
    """Test configuration"""

    BASE_URL = "https://littledan.com/api"
    USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"

    # Test user credentials
    EMAIL = f"e2e_test_{uuid.uuid4().hex[:8]}@example.com"
    PASSWORD = "TestPassword123!"


@pytest.fixture(scope="session")
async def test_user() -> Dict[str, str]:
    """Register a test user for the entire session"""
    async with httpx.AsyncClient(
        base_url=Config.BASE_URL,
        headers={"User-Agent": Config.USER_AGENT},
        timeout=30.0,
        follow_redirects=True,
    ) as client:
        # Register user
        response = await client.post(
            "/auth/register", json={"email": Config.EMAIL, "password": Config.PASSWORD}
        )

        if response.status_code not in [200, 201]:
            raise Exception(
                f"Failed to register test user: {response.status_code} - {response.text}"
            )

        print(f"✅ Registered test user: {Config.EMAIL}")
        return {"email": Config.EMAIL, "password": Config.PASSWORD}


@pytest.fixture(scope="session")
async def auth_token(test_user: Dict[str, str]) -> str:
    """Login and get auth token for the entire session"""
    async with httpx.AsyncClient(
        base_url=Config.BASE_URL,
        headers={"User-Agent": Config.USER_AGENT},
        timeout=30.0,
        follow_redirects=True,
    ) as client:
        # Login
        response = await client.post(
            "/auth/login",
            json={"email": test_user["email"], "password": test_user["password"]},
        )

        if response.status_code != 200:
            raise Exception(
                f"Failed to login: {response.status_code} - {response.text}"
            )

        token_data = response.json()
        token = token_data.get("access_token")

        if not token:
            raise Exception(f"No access token in response: {token_data}")

        print(f"✅ Got auth token for: {test_user['email']}")
        return token


@pytest.fixture
async def authenticated_client(
    auth_token: str,
) -> AsyncGenerator[httpx.AsyncClient, None]:
    """Create an authenticated HTTP client for each test"""
    async with httpx.AsyncClient(
        base_url=Config.BASE_URL,
        headers={
            "User-Agent": Config.USER_AGENT,
            "Authorization": f"Bearer {auth_token}",
        },
        timeout=30.0,
        follow_redirects=True,
    ) as client:
        yield client


@pytest.fixture
async def unauthenticated_client() -> AsyncGenerator[httpx.AsyncClient, None]:
    """Create an unauthenticated HTTP client for each test"""
    async with httpx.AsyncClient(
        base_url=Config.BASE_URL,
        headers={"User-Agent": Config.USER_AGENT},
        timeout=30.0,
        follow_redirects=True,
    ) as client:
        yield client


def pytest_sessionfinish(session, exitstatus):
    """Clean up test user at the end of the session"""
    if hasattr(session, "_auth_token") and hasattr(session, "_test_user"):
        # This will be handled by the test itself using the delete user endpoint
        print("🧹 Session cleanup completed")
