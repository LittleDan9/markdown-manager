"""GitHub Pull Request integration service."""
from typing import Any, Dict, List

import httpx
from fastapi import HTTPException

from .base import BaseGitHubService


class GitHubPRService(BaseGitHubService):
    """Service for GitHub Pull Request operations."""

    BASE_URL = "https://api.github.com"

    def __init__(self):
        """Initialize PR service."""
        super().__init__()

    async def create_pull_request(
        self,
        access_token: str,
        owner: str,
        repo: str,
        title: str,
        body: str,
        head_branch: str,
        base_branch: str = "main"
    ) -> Dict[str, Any]:
        """Create a pull request."""

        headers = {
            "Authorization": f"token {access_token}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "Markdown-Manager/1.0"
        }

        pr_data = {
            "title": title,
            "body": body,
            "head": head_branch,
            "base": base_branch
        }

        async with httpx.AsyncClient() as client:
            url = f"{self.BASE_URL}/repos/{owner}/{repo}/pulls"

            response = await client.post(url, json=pr_data, headers=headers)
            if response.status_code not in (200, 201):
                try:
                    error_data = response.json()
                except Exception:
                    error_data = {"message": response.text}
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to create pull request: {error_data.get('message', 'Unknown error')}"
                )

            return response.json()

    async def get_pull_requests(
        self,
        access_token: str,
        owner: str,
        repo: str,
        state: str = "open",
        per_page: int = 30
    ) -> List[Dict[str, Any]]:
        """Get pull requests for a repository."""

        headers = {
            "Authorization": f"token {access_token}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "Markdown-Manager/1.0"
        }

        params = {
            "state": state,
            "per_page": per_page,
            "sort": "updated",
            "direction": "desc"
        }

        async with httpx.AsyncClient() as client:
            url = f"{self.BASE_URL}/repos/{owner}/{repo}/pulls"

            response = await client.get(url, params=params, headers=headers)
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail="Failed to get pull requests"
                )

            return response.json()

    async def get_repository_contributors(
        self,
        access_token: str,
        owner: str,
        repo: str
    ) -> List[Dict[str, Any]]:
        """Get repository contributors."""

        headers = {
            "Authorization": f"token {access_token}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "Markdown-Manager/1.0"
        }

        async with httpx.AsyncClient() as client:
            url = f"{self.BASE_URL}/repos/{owner}/{repo}/contributors"

            response = await client.get(url, headers=headers)
            if response.status_code != 200:
                return []  # Return empty list if cannot get contributors

            return response.json()


# Global service instance
github_pr_service = GitHubPRService()
