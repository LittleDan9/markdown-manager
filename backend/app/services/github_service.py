"""GitHub service for OAuth and API integration."""
import base64
import os
import time
from typing import Any, Dict, List, Optional, Tuple

import httpx
from fastapi import HTTPException, status

from app.services.github_cache_service import github_cache_service
from app.core.github_security import github_security


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
            "t": str(int(time.time())),
            # Force account selection by adding login parameter
            "login": ""  # Empty login forces account selection
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

    async def get_user_repositories_cached(
        self,
        access_token: str,
        account_id: int,
        force_refresh: bool = False,
        page: int = 1,
        per_page: int = 30
    ) -> List[Dict[str, Any]]:
        """Get user's repositories with caching."""
        
        async def fetch_repositories():
            return await self.get_user_repositories(access_token, page, per_page)

        try:
            repositories = await github_cache_service.get_or_fetch_repositories(
                account_id=account_id,
                fetch_func=fetch_repositories,
                force_refresh=force_refresh
            )
            
            # Sanitize the data for security
            return [github_security.sanitize_github_data(repo) for repo in repositories]
            
        except Exception as e:
            # If cache fails, fall back to direct API call
            print(f"Cache failed, falling back to direct API: {e}")
            repositories = await fetch_repositories()
            return [github_security.sanitize_github_data(repo) for repo in repositories]

    async def get_repository_contents(
        self,
        access_token: str,
        owner: str,
        repo: str,
        path: str = "",
        ref: str = "main"
    ) -> List[Dict[str, Any]]:
        """Get repository contents at specified path."""
        # Normalize path - GitHub API expects empty string for root, not "/"
        normalized_path = path.strip('/')
        
        async with httpx.AsyncClient() as client:
            url = f"https://api.github.com/repos/{owner}/{repo}/contents"
            if normalized_path:
                url += f"/{normalized_path}"
                
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

    async def get_repository_contents_cached(
        self,
        access_token: str,
        owner: str,
        repo: str,
        repo_id: int,
        path: str = "",
        ref: str = "main",
        force_refresh: bool = False
    ) -> List[Dict[str, Any]]:
        """Get repository contents with caching."""
        
        async def fetch_contents():
            return await self.get_repository_contents(access_token, owner, repo, path, ref)

        try:
            contents = await github_cache_service.get_or_fetch_file_list(
                repo_id=repo_id,
                path=path,
                branch=ref,
                fetch_func=fetch_contents,
                force_refresh=force_refresh
            )
            
            # Sanitize the data for security
            return [github_security.sanitize_github_data(item) for item in contents]
            
        except Exception as e:
            # If cache fails, fall back to direct API call
            print(f"Cache failed, falling back to direct API: {e}")
            contents = await fetch_contents()
            return [github_security.sanitize_github_data(item) for item in contents]

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
            params = {"ref": ref} if ref else {}
            response = await client.get(
                url,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.github.v3+json"
                },
                params=params
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

    def generate_content_hash(self, content: str) -> str:
        """Generate SHA-256 hash of content for comparison."""
        import hashlib
        return hashlib.sha256(content.encode('utf-8')).hexdigest()

    async def commit_file(
        self,
        access_token: str,
        owner: str,
        repo: str,
        file_path: str,
        content: str,
        message: str,
        branch: str,
        sha: Optional[str] = None,
        create_branch: bool = False,
        base_branch: Optional[str] = None
    ) -> Dict[str, Any]:
        """Commit file changes to GitHub repository."""
        async with httpx.AsyncClient() as client:
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github.v3+json"
            }

            # Create new branch if requested
            if create_branch and base_branch:
                await self._create_branch(client, headers, owner, repo, branch, base_branch)

            # Prepare commit data
            encoded_content = base64.b64encode(content.encode('utf-8')).decode('ascii')

            commit_data = {
                "message": message,
                "content": encoded_content,
                "branch": branch
            }

            # Include SHA for updates (not for new files)
            if sha:
                commit_data["sha"] = sha

            url = f"https://api.github.com/repos/{owner}/{repo}/contents/{file_path}"

            response = await client.put(url, json=commit_data, headers=headers)

            if response.status_code not in (200, 201):
                content_type = response.headers.get("content-type", "")
                if content_type.startswith("application/json"):
                    error_data = response.json()
                else:
                    error_data = {"message": response.text}

                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Failed to commit file: {error_data.get('message', 'Unknown error')}"
                )

            return response.json()

    async def _create_branch(
        self,
        client: httpx.AsyncClient,
        headers: Dict[str, str],
        owner: str,
        repo: str,
        new_branch: str,
        base_branch: str
    ) -> None:
        """Create a new branch from base branch."""
        # Get base branch SHA
        base_url = f"https://api.github.com/repos/{owner}/{repo}/git/refs/heads/{base_branch}"
        response = await client.get(base_url, headers=headers)

        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to get base branch {base_branch}"
            )

        base_data = response.json()
        base_sha = base_data["object"]["sha"]

        # Create new branch
        create_data = {
            "ref": f"refs/heads/{new_branch}",
            "sha": base_sha
        }

        create_url = f"https://api.github.com/repos/{owner}/{repo}/git/refs"
        response = await client.post(create_url, json=create_data, headers=headers)

        if response.status_code != 201:
            content_type = response.headers.get("content-type", "")
            if content_type.startswith("application/json"):
                error_data = response.json()
            else:
                error_data = {"message": response.text}

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to create branch {new_branch}: {error_data.get('message', 'Unknown error')}"
            )

    async def get_branches(
        self,
        access_token: str,
        owner: str,
        repo: str
    ) -> List[Dict[str, Any]]:
        """Get all branches for a repository."""
        return await self.get_repository_branches(access_token, owner, repo)

    async def check_file_status(
        self,
        access_token: str,
        owner: str,
        repo: str,
        file_path: str,
        branch: str,
        local_sha: str
    ) -> Dict[str, Any]:
        """Check if file has been updated on GitHub since last sync."""
        try:
            current_content, current_sha = await self.get_file_content(
                access_token, owner, repo, file_path, branch
            )

            # Generate hash of current remote content
            remote_content_hash = self.generate_content_hash(current_content)
            local_content_hash = local_sha

            return {
                "exists": True,
                "remote_sha": current_sha,
                "remote_content": current_content,
                "remote_content_hash": remote_content_hash,
                "has_remote_changes": remote_content_hash != local_content_hash,
                "content": current_content
            }
        except HTTPException as e:
            if e.status_code == 404:
                return {
                    "exists": False,
                    "remote_sha": None,
                    "remote_content": "",
                    "remote_content_hash": "",
                    "has_remote_changes": False,
                    "content": ""
                }
            raise
