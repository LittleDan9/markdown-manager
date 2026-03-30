"""Test syntax highlighting endpoints."""
import pytest


async def test_highlight_endpoints_exist(sync_client):
    """Test that syntax highlighting endpoints exist."""
    response = await sync_client.get("/openapi.json")
    assert response.status_code == 200

    schema = response.json()
    paths = schema["paths"]

    # Look for highlight endpoints
    highlight_paths = [path for path in paths.keys() if path.startswith("/highlight")]

    # Should have some highlighting endpoints
    assert len(highlight_paths) > 0


async def test_highlight_languages_endpoint(sync_client):
    """Test languages endpoint if it exists."""
    # Try common syntax highlighting endpoints
    test_endpoints = [
        "/highlight/languages",
        "/highlight/themes",
        "/highlight/supported-languages",
    ]

    found_working_endpoint = False
    for endpoint in test_endpoints:
        response = await sync_client.get(endpoint)
        if response.status_code == 200:
            found_working_endpoint = True
            data = response.json()
            # Should return some kind of list or object
            assert data is not None
            break

    # At least one highlighting info endpoint should work
    # If none work, that's okay - we're testing structure, not full functionality
    assert found_working_endpoint  # Commented out for now


async def test_highlight_api_structure(sync_client):
    """Test that highlight endpoints follow expected patterns."""
    response = await sync_client.get("/openapi.json")
    schema = response.json()
    paths = schema["paths"]

    highlight_paths = [path for path in paths.keys() if path.startswith("/highlight")]

    # If highlight endpoints exist, test their structure
    if highlight_paths:
        # Should have proper HTTP methods defined
        for path in highlight_paths:
            path_info = paths[path]
            assert isinstance(path_info, dict)
            # Should have at least one HTTP method
            assert len(path_info) > 0
