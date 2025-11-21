"""Pytest configuration and fixtures for Draw.io export service tests."""

import asyncio
import os
from typing import Dict, Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import requests
from fastapi.testclient import TestClient

from app.app_factory import create_app
from app.services.mermaid_drawio_service import MermaidDrawioService
from app.services.drawio_quality_service import DrawioQualityService
from tests.fixtures.test_data import MOCK_HTTP_RESPONSES


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def app():
    """Create FastAPI application instance for testing."""
    os.environ["TESTING"] = "true"
    app = create_app()
    return app


@pytest.fixture
def client(app):
    """Create test client."""
    return TestClient(app)


@pytest.fixture
def mermaid_drawio_service():
    """Create MermaidDrawioService instance for testing."""
    return MermaidDrawioService()


@pytest.fixture
def drawio_quality_service():
    """Create DrawioQualityService instance for testing."""
    return DrawioQualityService()


@pytest.fixture
def mock_icon_service():
    """Mock icon service HTTP responses."""
    def mock_get(url, **kwargs):
        """Mock requests.get for icon service calls."""
        response = MagicMock()

        if url in MOCK_HTTP_RESPONSES:
            mock_resp = MOCK_HTTP_RESPONSES[url]
            if mock_resp["status_code"] == "timeout":
                raise requests.exceptions.Timeout("Connection timed out")

            response.status_code = mock_resp["status_code"]
            response.text = mock_resp["content"]
            response.content = mock_resp["content"].encode() if mock_resp["content"] else b""
            response.headers = mock_resp["headers"]
        else:
            # Default to 404 for unknown URLs
            response.status_code = 404
            response.text = "Not Found"
            response.content = b"Not Found"
            response.headers = {"content-type": "text/plain"}

        return response

    with patch('requests.get', side_effect=mock_get):
        yield mock_get


@pytest.fixture
def mock_playwright():
    """Mock Playwright browser operations for PNG generation."""
    mock_browser = AsyncMock()
    mock_page = AsyncMock()
    mock_context = AsyncMock()
    mock_svg_element = AsyncMock()

    # Configure the mock chain with proper async returns
    mock_browser.new_context.return_value = mock_context
    mock_context.new_page.return_value = mock_page
    mock_page.screenshot.return_value = b"mock_png_data"
    mock_page.query_selector.return_value = mock_svg_element
    mock_svg_element.screenshot.return_value = b"mock_svg_png_data"

    # Ensure browser.close() is properly mocked
    mock_browser.close = AsyncMock()

    # Mock page methods
    mock_page.set_content = AsyncMock()
    mock_page.wait_for_load_state = AsyncMock()

    async def mock_launch(**kwargs):
        return mock_browser

    # Mock the entire async_playwright context manager
    mock_playwright_ctx = AsyncMock()
    mock_playwright_ctx.chromium.launch = mock_launch

    with patch('playwright.async_api.async_playwright') as mock_pw:
        mock_pw.return_value.__aenter__.return_value = mock_playwright_ctx
        mock_pw.return_value.__aexit__.return_value = None
        yield {
            "playwright": mock_pw,
            "browser": mock_browser,
            "page": mock_page,
            "context": mock_context,
            "svg_element": mock_svg_element
        }


@pytest.fixture
def sample_environment():
    """Set up test environment variables."""
    test_env = {
        "ICON_SERVICE_URL": "http://localhost:8000",
        "DRAWIO_VERSION": "24.7.5",
        "DRAWIO_QUALITY_THRESHOLD": "60.0",
        "TESTING": "true"
    }

    # Store original values
    original_env = {}
    for key, value in test_env.items():
        original_env[key] = os.environ.get(key)
        os.environ[key] = value

    yield test_env

    # Restore original values
    for key, original_value in original_env.items():
        if original_value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = original_value


@pytest.fixture
def mock_logger():
    """Mock logger to capture and verify log messages."""
    with patch('logging.getLogger') as mock_get_logger:
        mock_logger_instance = MagicMock()
        mock_get_logger.return_value = mock_logger_instance
        yield mock_logger_instance


class AsyncContextManager:
    """Helper class for async context manager mocking."""

    def __init__(self, return_value):
        self.return_value = return_value

    async def __aenter__(self):
        return self.return_value

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass


@pytest.fixture
def mock_async_context():
    """Create async context manager for testing."""
    return AsyncContextManager


@pytest.fixture(autouse=True)
def clean_environment():
    """Ensure clean environment for each test."""
    # Clean up any lingering test environment variables
    test_vars = [
        "TESTING_ICON_SERVICE_FAIL",
        "TESTING_SVG_PARSE_FAIL",
        "TESTING_PNG_GENERATION_FAIL"
    ]

    for var in test_vars:
        os.environ.pop(var, None)

    yield

    # Clean up after test
    for var in test_vars:
        os.environ.pop(var, None)


@pytest.fixture
def performance_timer():
    """Timer fixture for performance testing."""
    import time

    class Timer:
        def __init__(self):
            self.start_time = None
            self.end_time = None

        def start(self):
            self.start_time = time.time()

        def stop(self):
            self.end_time = time.time()

        @property
        def elapsed(self):
            if self.start_time and self.end_time:
                return self.end_time - self.start_time
            return None

    return Timer()


@pytest.fixture
def memory_profiler():
    """Memory profiling fixture for performance testing."""
    import psutil
    import os

    class MemoryProfiler:
        def __init__(self):
            self.process = psutil.Process(os.getpid())
            self.initial_memory = None
            self.peak_memory = None

        def start(self):
            self.initial_memory = self.process.memory_info().rss / 1024 / 1024  # MB
            self.peak_memory = self.initial_memory

        def sample(self):
            current_memory = self.process.memory_info().rss / 1024 / 1024  # MB
            if current_memory > self.peak_memory:
                self.peak_memory = current_memory

        @property
        def memory_used(self):
            if self.initial_memory and self.peak_memory:
                return self.peak_memory - self.initial_memory
            return None

    return MemoryProfiler()


# Helper functions for test setup
def create_test_request(mermaid_source: str, svg_content: str, **kwargs) -> Dict[str, Any]:
    """Create a test request dictionary."""
    base_request = {
        "mermaid_source": mermaid_source,
        "svg_content": svg_content,
        "width": 1000,
        "height": 600,
        "is_dark_mode": False
    }
    base_request.update(kwargs)
    return base_request


def create_test_png_request(mermaid_source: str, svg_content: str, **kwargs) -> Dict[str, Any]:
    """Create a test PNG request dictionary."""
    base_request = {
        "mermaid_source": mermaid_source,
        "svg_content": svg_content,
        "transparent_background": True,
        "is_dark_mode": False
    }
    base_request.update(kwargs)
    return base_request


# Pytest markers for test organization
pytest.mark.unit = pytest.mark.unit
pytest.mark.integration = pytest.mark.integration
pytest.mark.performance = pytest.mark.performance
pytest.mark.slow = pytest.mark.slow