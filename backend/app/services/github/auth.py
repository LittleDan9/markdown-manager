"""GitHub OAuth authentication service."""
import os
import time
from typing import Any, Dict

import httpx
from fastapi import HTTPException, status

from .base import BaseGitHubService


class GitHubAuthService(BaseGitHubService):
    """Service for GitHub OAuth authentication operations."""

    def __init__(self):
        """Initialize GitHub authentication service with OAuth configuration."""
        super().__init__()

        self.client_id = os.getenv("GITHUB_CLIENT_ID")
        self.client_secret = os.getenv("GITHUB_CLIENT_SECRET")
        self.redirect_uri = os.getenv("GITHUB_REDIRECT_URI")

        # Support both public-only and full repo access
        # Default to public_repo for security, but allow full repo access if needed
        github_scope = os.getenv("GITHUB_OAUTH_SCOPE", "public_repo")
        self.scope = f"{github_scope},user:email"

        if not all([self.client_id, self.client_secret, self.redirect_uri]):
            raise ValueError("GitHub OAuth environment variables not properly configured")

    def get_authorization_url(self, state: str) -> str:
        """Get OAuth authorization URL with forced account selection."""
        base_url = "https://github.com/login/oauth/authorize"
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "scope": self.scope,
            "state": state,
            "allow_signup": "true",
            # Add a timestamp to force fresh authorization
            "t": str(int(time.time())),
            "login": ""  # Force account selection
        }

        query_string = "&".join([f"{k}={v}" for k, v in params.items()])
        return f"{base_url}?{query_string}"

    def get_logout_url(self) -> str:
        """Get GitHub logout URL to clear existing session."""
        return "https://github.com/logout"

    def get_authorization_url_with_logout(self, state: str) -> Dict[str, str]:
        """Get both logout and authorization URLs for account switching."""
        return {
            "logout_url": self.get_logout_url(),
            "authorization_url": self.get_authorization_url(state)
        }

    async def exchange_code_for_token(self, code: str, state: str) -> Dict[str, Any]:
        """Exchange OAuth code for access token."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://github.com/login/oauth/access_token",
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code,
                    "redirect_uri": self.redirect_uri
                },
                headers={"Accept": "application/json"}
            )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to exchange code for token"
                )

            token_data = response.json()
            if "error" in token_data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"GitHub OAuth error: {token_data.get('error_description', token_data['error'])}"
                )

            return token_data

    async def validate_token(self, access_token: str) -> bool:
        """Validate if access token is still valid."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://api.github.com/user",
                    headers={
                        "Authorization": f"token {access_token}",
                        "Accept": "application/vnd.github.v3+json",
                        "User-Agent": "Markdown-Manager/1.0"
                    }
                )
                return response.status_code == 200
        except Exception:
            return False
