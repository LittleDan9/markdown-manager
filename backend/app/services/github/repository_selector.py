"""GitHub repository selection and search service."""
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from app.models.github_models import GitHubAccount, GitHubRepositorySelection
from app.services.github.api import GitHubAPIService
from app.utils.datetime_helpers import parse_github_datetime, utc_now


class GitHubRepositorySelector:
    """Service for managing repository selections and searches."""

    def __init__(self):
        self.github_api = GitHubAPIService()

    async def search_available_repositories(
        self,
        github_account: GitHubAccount,
        search_query: Optional[str] = None,
        page: int = 1,
        per_page: int = 20,
        include_private: bool = True,
        organization: Optional[str] = None,
        language: Optional[str] = None,
        sort_by: str = "updated"
    ) -> Dict[str, Any]:
        """Search available repositories for a GitHub account."""

        # Get repositories from GitHub API - temporarily use basic method to test
        all_repos = []
        page_num = 1
        while len(all_repos) < 2000:  # Safety limit
            page_repos = await self.github_api.get_user_repositories(
                access_token=github_account.access_token,
                page=page_num,
                per_page=100
            )
            if not page_repos:
                break
            all_repos.extend(page_repos)
            page_num += 1

        github_repos = all_repos

        # Apply additional filters
        filtered_repos = []
        for repo in github_repos:
            # Skip private repos if not requested
            if repo.get('private', False) and not include_private:
                continue

            # Filter by organization if specified
            if organization:
                repo_owner = repo.get('owner', {}).get('login', '')
                if repo_owner.lower() != organization.lower():
                    continue

            # Filter by language if specified
            if language:
                repo_language = repo.get('language', '')
                if not repo_language or repo_language.lower() != language.lower():
                    continue

            # Apply search query
            if search_query:
                search_lower = search_query.lower()
                searchable_fields = [
                    repo.get('name', ''),
                    repo.get('full_name', ''),
                    repo.get('description', '') or '',
                    repo.get('language', '') or ''
                ]

                if not any(search_lower in field.lower() for field in searchable_fields):
                    continue

            filtered_repos.append(repo)

        # Sort repositories
        if sort_by == "updated":
            # Parse datetime strings for proper sorting
            def get_updated_datetime(repo):
                updated_str = repo.get('updated_at', '')
                if not updated_str:
                    return parse_github_datetime('1970-01-01T00:00:00Z')  # Very old date for repos without update time
                return parse_github_datetime(updated_str) or parse_github_datetime('1970-01-01T00:00:00Z')

            filtered_repos.sort(key=get_updated_datetime, reverse=True)
        elif sort_by == "name":
            filtered_repos.sort(key=lambda r: r.get('name', '').lower())
        elif sort_by == "stars":
            filtered_repos.sort(key=lambda r: r.get('stargazers_count', 0), reverse=True)

        # Paginate results
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        paginated_repos = filtered_repos[start_idx:end_idx]

        return {
            "repositories": paginated_repos,
            "total_count": len(filtered_repos),
            "page": page,
            "per_page": per_page,
            "total_pages": (len(filtered_repos) + per_page - 1) // per_page,
            "filters_applied": {
                "search_query": search_query,
                "organization": organization,
                "language": language,
                "include_private": include_private,
                "sort_by": sort_by
            }
        }

    async def get_selected_repositories(
        self,
        db: AsyncSession,
        github_account_id: int,
        active_only: bool = True
    ) -> List[GitHubRepositorySelection]:
        """Get user's currently selected repositories."""

        query = select(GitHubRepositorySelection).where(
            GitHubRepositorySelection.github_account_id == github_account_id
        )

        if active_only:
            query = query.where(GitHubRepositorySelection.is_active)

        # Temporarily remove ordering to avoid timezone comparison issues
        # query = query.order_by(GitHubRepositorySelection.selected_at.desc())

        result = await db.execute(query)
        return result.scalars().all()

    async def add_repository_selection(
        self,
        db: AsyncSession,
        github_account_id: int,
        repo_data: Dict[str, Any]
    ) -> GitHubRepositorySelection:
        """Add a repository to user's selections."""

        # Check if already selected
        existing = await db.execute(
            select(GitHubRepositorySelection).where(
                and_(
                    GitHubRepositorySelection.github_account_id == github_account_id,
                    GitHubRepositorySelection.github_repo_id == repo_data['id']
                )
            )
        )
        existing_selection = existing.scalar_one_or_none()

        if existing_selection:
            # Reactivate if it was deactivated
            if not existing_selection.is_active:
                existing_selection.is_active = True
                existing_selection.selected_at = utc_now()
                await db.commit()
            return existing_selection

        # Create new selection
        selection = GitHubRepositorySelection(
            github_account_id=github_account_id,
            github_repo_id=repo_data['id'],
            repo_name=repo_data['name'],
            repo_full_name=repo_data['full_name'],
            repo_owner=repo_data['owner']['login'],
            is_private=repo_data.get('private', False),
            description=repo_data.get('description'),
            language=repo_data.get('language'),
            default_branch=repo_data.get('default_branch', 'main'),
            repo_updated_at=parse_github_datetime(repo_data.get('updated_at'))
        )

        db.add(selection)
        await db.commit()
        await db.refresh(selection)

        return selection

    async def remove_repository_selection(
        self,
        db: AsyncSession,
        github_account_id: int,
        github_repo_id: int
    ) -> bool:
        """Remove a repository from user's selections."""

        selection = await db.execute(
            select(GitHubRepositorySelection).where(
                and_(
                    GitHubRepositorySelection.github_account_id == github_account_id,
                    GitHubRepositorySelection.github_repo_id == github_repo_id
                )
            )
        )
        selection_obj = selection.scalar_one_or_none()

        if selection_obj:
            selection_obj.is_active = False
            await db.commit()
            return True

        return False

    async def bulk_add_repository_selections(
        self,
        db: AsyncSession,
        github_account: GitHubAccount,
        repo_ids: List[int]
    ) -> Dict[str, Any]:
        """Add multiple repositories to user's selections."""

        # Get repository data from GitHub API
        github_repos = await self.github_api.get_user_repositories(
            access_token=github_account.access_token,
            per_page=100  # Get more repos per page
        )

        # Filter to only requested repos
        repos_to_add = [repo for repo in github_repos if repo['id'] in repo_ids]

        added_selections = []
        errors = []

        for repo_data in repos_to_add:
            try:
                selection = await self.add_repository_selection(
                    db, github_account.id, repo_data
                )
                added_selections.append(selection)
            except Exception as e:
                errors.append({
                    "repo_id": repo_data['id'],
                    "repo_name": repo_data['name'],
                    "error": str(e)
                })

        return {
            "added_count": len(added_selections),
            "added_repositories": [s.repo_full_name for s in added_selections],
            "errors": errors
        }

    async def update_repository_sync_status(
        self,
        db: AsyncSession,
        github_account_id: int,
        github_repo_id: int,
        sync_enabled: bool
    ) -> bool:
        """Enable/disable sync for a selected repository."""

        selection = await db.execute(
            select(GitHubRepositorySelection).where(
                and_(
                    GitHubRepositorySelection.github_account_id == github_account_id,
                    GitHubRepositorySelection.github_repo_id == github_repo_id,
                    GitHubRepositorySelection.is_active == True
                )
            )
        )
        selection_obj = selection.scalar_one_or_none()

        if selection_obj:
            selection_obj.sync_enabled = sync_enabled
            await db.commit()
            return True

        return False

    async def get_repository_statistics(
        self,
        db: AsyncSession,
        github_account_id: int
    ) -> Dict[str, Any]:
        """Get statistics about repository selections."""

        # Count total selections
        total_query = select(func.count(GitHubRepositorySelection.id)).where(
            and_(
                GitHubRepositorySelection.github_account_id == github_account_id,
                GitHubRepositorySelection.is_active == True
            )
        )
        total_result = await db.execute(total_query)
        total_selected = total_result.scalar()

        # Count sync-enabled selections
        sync_enabled_query = select(func.count(GitHubRepositorySelection.id)).where(
            and_(
                GitHubRepositorySelection.github_account_id == github_account_id,
                GitHubRepositorySelection.is_active == True,
                GitHubRepositorySelection.sync_enabled == True
            )
        )
        sync_enabled_result = await db.execute(sync_enabled_query)
        sync_enabled_count = sync_enabled_result.scalar()

        # Get language breakdown
        language_query = select(
            GitHubRepositorySelection.language,
            func.count(GitHubRepositorySelection.id)
        ).where(
            and_(
                GitHubRepositorySelection.github_account_id == github_account_id,
                GitHubRepositorySelection.is_active == True
            )
        ).group_by(GitHubRepositorySelection.language)

        language_result = await db.execute(language_query)
        language_breakdown = {
            lang or "Unknown": count for lang, count in language_result.fetchall()
        }

        return {
            "total_selected": total_selected,
            "sync_enabled": sync_enabled_count,
            "sync_disabled": total_selected - sync_enabled_count,
            "language_breakdown": language_breakdown
        }

    async def get_user_organizations(self, github_account: GitHubAccount) -> List[Dict[str, Any]]:
        """Get organizations that the user belongs to."""
        try:
            # Get user's organizations from GitHub API
            orgs = await self.github_api.get_user_organizations(
                access_token=github_account.access_token
            )

            # Format organization data
            organizations = []
            for org in orgs:
                organizations.append({
                    "login": org.get("login"),
                    "name": org.get("name") or org.get("login"),
                    "description": org.get("description"),
                    "avatar_url": org.get("avatar_url"),
                    "public_repos": org.get("public_repos", 0),
                    "total_private_repos": org.get("total_private_repos", 0)
                })

            # Sort by name for better UX
            organizations.sort(key=lambda x: x["name"].lower())

            return organizations

        except Exception as e:
            print(f"Error fetching organizations: {e}")
            raise e