"""Application fixtures for testing."""
import os
from typing import AsyncGenerator, Generator

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.app_factory import create_app
from app.database import get_db


class TestApplicationManager:
    """Manages test application instances."""

    @staticmethod
    def create_test_app() -> FastAPI:
        """Create a test FastAPI application."""
        # Set test environment variables
        os.environ["GITHUB_CLIENT_ID"] = "test_client_id"
        os.environ["GITHUB_CLIENT_SECRET"] = "test_client_secret"
        os.environ["GITHUB_REDIRECT_URI"] = "http://localhost:8000/auth/github/callback"

        return create_app()


@pytest.fixture
def test_app() -> FastAPI:
    """Provide a test FastAPI application."""
    return TestApplicationManager.create_test_app()


@pytest.fixture
def sync_client(test_app: FastAPI, sync_db_session) -> Generator[TestClient, None, None]:
    """Provide a synchronous test client for unit tests."""

    def override_get_db():
        yield sync_db_session

    test_app.dependency_overrides[get_db] = override_get_db

    with TestClient(test_app) as client:
        yield client

    test_app.dependency_overrides.clear()


@pytest.fixture
async def async_client(test_app: FastAPI, async_db_session) -> AsyncGenerator[httpx.AsyncClient, None]:
    """Provide an asynchronous test client for integration tests."""

    async def override_get_db():
        yield async_db_session

    test_app.dependency_overrides[get_db] = override_get_db

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=test_app),
        base_url="http://test"
    ) as client:
        yield client

    test_app.dependency_overrides.clear()


@pytest.fixture
async def auth_client(test_app: FastAPI, async_db_session, test_user_data) -> AsyncGenerator[httpx.AsyncClient, None]:
    """Provide an authenticated asynchronous test client."""

    async def override_get_db():
        yield async_db_session

    test_app.dependency_overrides[get_db] = override_get_db

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=test_app),
        base_url="http://test"
    ) as client:
        # First register a user
        register_response = await client.post("/auth/register", json=test_user_data)

        if register_response.status_code == 200:
            # If registration succeeds, login to get token
            login_data = {
                "email": test_user_data["email"],
                "password": test_user_data["password"]
            }
            login_response = await client.post("/auth/login", json=login_data)

            if login_response.status_code == 200:
                token_data = login_response.json()
                access_token = token_data["access_token"]
                client.headers.update({"Authorization": f"Bearer {access_token}"})

        yield client

    test_app.dependency_overrides.clear()

