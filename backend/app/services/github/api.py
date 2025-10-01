"""GitHub API operations service."""
import base64
import hashlib
from typing import Any, Dict, List, Optional, Tuple

import httpx
from fastapi import HTTPException, status

from .base import BaseGitHubService


class GitHubAPIService(BaseGitHubService):
    """Service for direct GitHub API operations."""

    BASE_URL = "https://api.github.com"

    def __init__(self):
        """Initialize GitHub API service."""
        super().__init__()

    async def get_user_info(self, access_token: str) -> Dict[str, Any]:
        """Get authenticated user information."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/user",
                headers={
                    "Authorization": f"token {access_token}",
                    "Accept": "application/vnd.github.v3+json",
                    "User-Agent": "Markdown-Manager/1.0"
                }
            )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to get user info"
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
                f"{self.BASE_URL}/user/repos",
                params={
                    "type": "all",
                    "sort": "updated",
                    "direction": "desc",
                    "per_page": per_page,
                    "page": page
                },
                headers={
                    "Authorization": f"token {access_token}",
                    "Accept": "application/vnd.github.v3+json",
                    "User-Agent": "Markdown-Manager/1.0"
                }
            )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to get repositories"
                )

            return response.json()

    async def get_user_repositories_filtered(
        self,
        access_token: str,
        max_repos: int = 50,
        min_updated_days: int = 365,
        include_forks: bool = False,
        exclude_archived: bool = True,
        page: int = 1,
        per_page: int = 30
    ) -> List[Dict[str, Any]]:
        """Get user's repositories with filtering for large organizations."""
        from datetime import datetime, timedelta, timezone

        all_repos = []
        current_page = page
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=min_updated_days)

        async with httpx.AsyncClient() as client:
            while len(all_repos) < max_repos:
                response = await client.get(
                    f"{self.BASE_URL}/user/repos",
                    params={
                        "type": "all",
                        "sort": "updated",
                        "direction": "desc",
                        "per_page": per_page,
                        "page": current_page
                    },
                    headers={
                        "Authorization": f"token {access_token}",
                        "Accept": "application/vnd.github.v3+json",
                        "User-Agent": "Markdown-Manager/1.0"
                    }
                )

                if response.status_code != 200:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Failed to get repositories"
                    )

                repos = response.json()
                if not repos:  # No more repositories
                    break

                for repo in repos:
                    # Apply filters
                    if len(all_repos) >= max_repos:
                        break

                    # Skip forks if not wanted
                    if not include_forks and repo.get("fork", False):
                        continue

                    # Skip archived repos if not wanted
                    if exclude_archived and repo.get("archived", False):
                        continue

                    # Check update date
                    updated_at = datetime.fromisoformat(
                        repo.get("updated_at", "").replace('Z', '+00:00')
                    )
                    if updated_at < cutoff_date:
                        # Since repos are sorted by updated date, we can stop here
                        return all_repos

                    all_repos.append(repo)

                current_page += 1

        return all_repos

    async def get_user_organizations(self, access_token: str) -> List[Dict[str, Any]]:
        """Get organizations that the user belongs to."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/user/orgs",
                headers={
                    "Authorization": f"token {access_token}",
                    "Accept": "application/vnd.github.v3+json",
                    "User-Agent": "Markdown-Manager/1.0"
                }
            )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Failed to get user organizations: {response.text}"
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
        # Normalize path - GitHub API expects empty string for root, not "/"
        normalized_path = path.strip('/')

        async with httpx.AsyncClient() as client:
            url = f"{self.BASE_URL}/repos/{owner}/{repo}/contents"
            if normalized_path:
                url += f"/{normalized_path}"

            params = {"ref": ref}

            response = await client.get(
                url,
                params=params,
                headers={
                    "Authorization": f"token {access_token}",
                    "Accept": "application/vnd.github.v3+json",
                    "User-Agent": "Markdown-Manager/1.0"
                }
            )

            if response.status_code == 404:
                return []
            elif response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to get repository contents: {response.text}"
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
            response = await client.get(
                f"{self.BASE_URL}/repos/{owner}/{repo}/contents/{path}",
                params={"ref": ref},
                headers={
                    "Authorization": f"token {access_token}",
                    "Accept": "application/vnd.github.v3+json",
                    "User-Agent": "Markdown-Manager/1.0"
                }
            )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to get file content: {response.text}"
                )

            file_data = response.json()
            if file_data["type"] != "file":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Path does not point to a file"
                )

            # Decode base64 content
            content = base64.b64decode(file_data["content"]).decode("utf-8")
            sha = file_data["sha"]

            return content, sha

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
            # Encode content to base64
            encoded_content = base64.b64encode(content.encode("utf-8")).decode("utf-8")

            data = {
                "message": message,
                "content": encoded_content,
                "branch": branch
            }

            if sha:
                data["sha"] = sha

            response = await client.put(
                f"{self.BASE_URL}/repos/{owner}/{repo}/contents/{path}",
                json=data,
                headers={
                    "Authorization": f"token {access_token}",
                    "Accept": "application/vnd.github.v3+json",
                    "User-Agent": "Markdown-Manager/1.0"
                }
            )

            if response.status_code not in (200, 201):
                try:
                    error_data = response.json()
                except Exception:
                    error_data = {"message": response.text}
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to create/update file: {error_data.get('message', 'Unknown error')}"
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
                f"{self.BASE_URL}/repos/{owner}/{repo}/branches",
                headers={
                    "Authorization": f"token {access_token}",
                    "Accept": "application/vnd.github.v3+json",
                    "User-Agent": "Markdown-Manager/1.0"
                }
            )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail="Failed to get repository branches"
                )

            return response.json()

    def generate_content_hash(self, content: str) -> str:
        """Generate SHA-256 hash of content for comparison."""
        return hashlib.sha256(content.encode('utf-8')).hexdigest()

    def generate_git_blob_hash(self, content: str) -> str:
        """Generate Git blob SHA-1 hash compatible with GitHub."""
        import hashlib
        # Git blob format: "blob <size>\0<content>"
        blob_content = f"blob {len(content.encode('utf-8'))}\0".encode('utf-8') + content.encode('utf-8')
        return hashlib.sha1(blob_content).hexdigest()

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
                "Authorization": f"token {access_token}",
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "Markdown-Manager/1.0"
            }

            # Create branch if requested
            if create_branch and base_branch:
                await self._create_branch(client, headers, owner, repo, branch, base_branch)

            # Commit the file
            return await self.create_or_update_file(
                access_token, owner, repo, file_path, content, message, sha, branch
            )

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
        base_url = f"{self.BASE_URL}/repos/{owner}/{repo}/git/refs/heads/{base_branch}"
        response = await client.get(base_url, headers=headers)

        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Failed to get base branch {base_branch}"
            )

        base_data = response.json()
        base_sha = base_data["object"]["sha"]

        # Create new branch
        create_data = {
            "ref": f"refs/heads/{new_branch}",
            "sha": base_sha
        }

        create_url = f"{self.BASE_URL}/repos/{owner}/{repo}/git/refs"
        response = await client.post(create_url, json=create_data, headers=headers)

        if response.status_code != 201:
            error_data = response.json() if response.content else {"message": "Unknown error"}
            raise HTTPException(
                status_code=response.status_code,
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
            _, remote_sha = await self.get_file_content(
                access_token, owner, repo, file_path, branch
            )

            return {
                "exists": True,
                "up_to_date": remote_sha == local_sha,
                "remote_sha": remote_sha,
                "local_sha": local_sha
            }
        except HTTPException as e:
            if e.status_code == 404:
                return {
                    "exists": False,
                    "up_to_date": False,
                    "remote_sha": None,
                    "local_sha": local_sha
                }
            raise

    async def get_file_commits(
        self,
        access_token: str,
        owner: str,
        repo: str,
        file_path: str,
        branch: str = "main",
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get commit history for a specific file."""
        async with httpx.AsyncClient() as client:
            params = {
                "sha": branch,
                "path": file_path,
                "per_page": min(limit, 100)  # GitHub API max is 100
            }
            
            response = await client.get(
                f"{self.BASE_URL}/repos/{owner}/{repo}/commits",
                params=params,
                headers={
                    "Authorization": f"token {access_token}",
                    "Accept": "application/vnd.github.v3+json",
                    "User-Agent": "Markdown-Manager/1.0"
                }
            )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to get commit history: {response.text}"
                )

            commits_data = response.json()
            
            # Transform GitHub API response to our format
            commits = []
            for commit in commits_data:
                commits.append({
                    "hash": commit["sha"],
                    "short_hash": commit["sha"][:7],
                    "message": commit["commit"]["message"],
                    "author_name": commit["commit"]["author"]["name"],
                    "author_email": commit["commit"]["author"]["email"],
                    "date": commit["commit"]["author"]["date"],
                    "relative_date": self._format_relative_date(commit["commit"]["author"]["date"]),
                    "url": commit["html_url"],
                    "github_data": {
                        "author": commit.get("author", {}),
                        "committer": commit.get("committer", {}),
                        "stats": commit.get("stats", {}),
                        "files": commit.get("files", [])
                    }
                })
            
            return commits

    def _format_relative_date(self, iso_date: str) -> str:
        """Format ISO date to relative date string."""
        from datetime import datetime, timezone
        
        # Parse ISO date
        try:
            # Handle both with and without timezone info
            if iso_date.endswith('Z'):
                date = datetime.fromisoformat(iso_date[:-1] + '+00:00')
            elif '+' in iso_date or iso_date.count('-') > 2:
                date = datetime.fromisoformat(iso_date)
            else:
                date = datetime.fromisoformat(iso_date).replace(tzinfo=timezone.utc)
            
            now = datetime.now(timezone.utc)
            diff = now - date
            
            days = diff.days
            hours = diff.seconds // 3600
            minutes = (diff.seconds % 3600) // 60
            
            if days > 365:
                years = days // 365
                return f"{years} year{'s' if years > 1 else ''} ago"
            elif days > 30:
                months = days // 30
                return f"{months} month{'s' if months > 1 else ''} ago"
            elif days > 0:
                return f"{days} day{'s' if days > 1 else ''} ago"
            elif hours > 0:
                return f"{hours} hour{'s' if hours > 1 else ''} ago"
            elif minutes > 0:
                return f"{minutes} minute{'s' if minutes > 1 else ''} ago"
            else:
                return "just now"
                
        except Exception:
            return "unknown"

    async def commit_file_with_diagrams(
        self,
        access_token: str,
        owner: str,
        repo: str,
        file_path: str,
        content: str,
        message: str,
        branch: str,
        diagrams: List[Dict[str, Any]],
        sha: Optional[str] = None,
        create_branch: bool = False,
        base_branch: Optional[str] = None,
        diagram_path: str = "/.markdown-manager/diagrams/"
    ) -> Dict[str, Any]:
        """
        Commit file changes with associated diagram images to GitHub repository.
        
        Args:
            access_token: GitHub access token
            owner: Repository owner
            repo: Repository name
            file_path: Path to the main file being committed
            content: File content (already converted)
            message: Commit message
            branch: Target branch
            diagrams: List of diagram conversion objects
            sha: Current file SHA (for updates)
            create_branch: Whether to create branch if it doesn't exist
            base_branch: Base branch for new branch creation
            diagram_path: Path in repository for diagram images
            
        Returns:
            Dict containing commit information and uploaded diagram details
        """
        async with httpx.AsyncClient() as client:
            headers = {
                "Authorization": f"token {access_token}",
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "Markdown-Manager/1.0"
            }
            
            uploaded_diagrams = []
            errors = []
            
            try:
                # Create branch if requested
                if create_branch and base_branch:
                    await self._create_branch(client, headers, owner, repo, branch, base_branch)
                
                # Upload diagram images first
                for diagram in diagrams:
                    try:
                        if diagram.get('needs_upload', True):
                            diagram_file_path = f"{diagram_path.rstrip('/')}/{diagram['filename']}"
                            
                            # Convert image data to base64 if it's bytes
                            if isinstance(diagram['image_data'], bytes):
                                image_content = base64.b64encode(diagram['image_data']).decode('utf-8')
                            else:
                                image_content = diagram['image_data']
                            
                            # Check if diagram file already exists
                            existing_sha = await self._get_file_sha(
                                client, headers, owner, repo, diagram_file_path, branch
                            )
                            
                            # Upload diagram image
                            upload_result = await self.create_or_update_file(
                                access_token, owner, repo, diagram_file_path,
                                image_content, f"Add diagram image: {diagram['filename']}",
                                existing_sha, branch
                            )
                            
                            # Calculate size
                            if isinstance(diagram['image_data'], bytes):
                                size = len(diagram['image_data'])
                            else:
                                size = len(diagram['image_data'].encode())
                            
                            uploaded_diagrams.append({
                                'filename': diagram['filename'],
                                'path': diagram_file_path,
                                'hash': diagram['hash'],
                                'format': diagram['image_format'],
                                'sha': upload_result.get('content', {}).get('sha'),
                                'size': size
                            })
                            
                    except Exception as e:
                        error_msg = f"Failed to upload diagram {diagram.get('filename', 'unknown')}: {str(e)}"
                        errors.append(error_msg)
                        continue
                
                # Commit the main file
                main_commit = await self.create_or_update_file(
                    access_token, owner, repo, file_path, content, message, sha, branch
                )
                
                return {
                    'commit': main_commit,
                    'uploaded_diagrams': uploaded_diagrams,
                    'errors': errors,
                    'success': True,
                    'diagrams_uploaded': len(uploaded_diagrams),
                    'total_diagrams': len(diagrams)
                }
                
            except Exception as e:
                return {
                    'commit': None,
                    'uploaded_diagrams': uploaded_diagrams,
                    'errors': errors + [f"Main commit failed: {str(e)}"],
                    'success': False,
                    'diagrams_uploaded': len(uploaded_diagrams),
                    'total_diagrams': len(diagrams)
                }
    
    async def _get_file_sha(
        self,
        client: httpx.AsyncClient,
        headers: Dict[str, str],
        owner: str,
        repo: str,
        file_path: str,
        branch: str
    ) -> Optional[str]:
        """Get SHA of existing file, return None if file doesn't exist"""
        try:
            response = await client.get(
                f"{self.BASE_URL}/repos/{owner}/{repo}/contents/{file_path}",
                headers=headers,
                params={"ref": branch}
            )
            
            if response.status_code == 200:
                content = response.json()
                return content.get('sha')
            else:
                return None
                
        except Exception:
            return None
