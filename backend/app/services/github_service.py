"""GitHub service for OAuth and API integration."""
import base64
import os
import time
from typing import Any, Dict, List, Optional, Tuple

import httpx
from fastapi import HTTPException, status


class GitHubService:
    """Service for GitHub OAuth and API operations."""

    def __init__(self):
        """Initialize GitHub service with OAuth configuration."""
        self.client_id = os.getenv("GITHUB_CLIENT_ID")
        self.client_secret = os.getenv("GITHUB_CLIENT_SECRET")
        self.redirect_uri = os.getenv("GITHUB_REDIRECT_URI")
        self.scope = "public_repo,user:email"  # Only public repos + email

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
            "t": str(int(time.time()))
        }

        query_string = "&".join([f"{k}={v}" for k, v in params.items()])
        return f"{base_url}?{query_string}"

    async def exchange_code_for_token(self, code: str, state: str) -> Dict[str, Any]:
        """Exchange OAuth code for access token."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://github.com/login/oauth/access_token",
                headers={"Accept": "application/json"},
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code,
                    "redirect_uri": self.redirect_uri,
                }
            )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to exchange code for token"
                )

            return response.json()

    async def get_user_info(self, access_token: str) -> Dict[str, Any]:
        """Get authenticated user information."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.github.com/user",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.github.v3+json"
                }
            )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid GitHub access token"
                )

            return response.json()

    async def get_user_repositories(
        self,
        access_token: str,
        page: int = 1,
        per_page: int = 30
    ) -> List[Dict[str, Any]]:
        """Get user's repositories."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.github.com/user/repos",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.github.v3+json"
                },
                params={
                    "type": "all",
                    "sort": "updated",
                    "page": page,
                    "per_page": per_page
                }
            )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Failed to fetch repositories"
                )

            return response.json()

    async def get_repository_contents(
        self,
        access_token: str,
        owner: str,
        repo: str,
        path: str = "",
        ref: str = "main"
    ) -> List[Dict[str, Any]]:
        """Get repository contents at specified path."""
        async with httpx.AsyncClient() as client:
            url = f"https://api.github.com/repos/{owner}/{repo}/contents/{path}"
            response = await client.get(
                url,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.github.v3+json"
                },
                params={"ref": ref} if ref != "main" else {}
            )

            if response.status_code == 404:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Repository or path not found"
                )
            elif response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to fetch repository contents"
                )

            data = response.json()
            return data if isinstance(data, list) else [data]

    async def get_file_content(
        self,
        access_token: str,
        owner: str,
        repo: str,
        path: str,
        ref: str = "main"
    ) -> Tuple[str, str]:
        """Get file content and SHA."""
        async with httpx.AsyncClient() as client:
            url = f"https://api.github.com/repos/{owner}/{repo}/contents/{path}"
            response = await client.get(
                url,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.github.v3+json"
                },
                params={"ref": ref} if ref != "main" else {}
            )

            if response.status_code == 404:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="File not found"
                )
            elif response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to fetch file content"
                )

            data = response.json()

            if data.get("type") != "file":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Path is not a file"
                )

            # Decode base64 content
            content = base64.b64decode(data["content"]).decode("utf-8")
            return content, data["sha"]

    async def create_or_update_file(
        self,
        access_token: str,
        owner: str,
        repo: str,
        path: str,
        content: str,
        message: str,
        sha: Optional[str] = None,
        branch: str = "main"
    ) -> Dict[str, Any]:
        """Create or update a file in the repository."""
        async with httpx.AsyncClient() as client:
            url = f"https://api.github.com/repos/{owner}/{repo}/contents/{path}"

            # Encode content as base64
            encoded_content = base64.b64encode(content.encode("utf-8")).decode("ascii")

            data = {
                "message": message,
                "content": encoded_content,
                "branch": branch
            }

            if sha:
                data["sha"] = sha

            response = await client.put(
                url,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.github.v3+json"
                },
                json=data
            )

            if response.status_code not in [200, 201]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Failed to update file: {response.text}"
                )

            return response.json()

    async def get_repository_branches(
        self,
        access_token: str,
        owner: str,
        repo: str
    ) -> List[Dict[str, Any]]:
        """Get repository branches."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/branches",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.github.v3+json"
                }
            )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to fetch repository branches"
                )

            return response.json()

    async def validate_token(self, access_token: str) -> bool:
        """Validate if access token is still valid."""
        try:
            await self.get_user_info(access_token)
            return True
        except HTTPException:
            return False
