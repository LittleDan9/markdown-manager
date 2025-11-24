"""
Unit tests for the Git service.
"""

import pytest
import tempfile
import shutil
import os
from pathlib import Path
from unittest.mock import patch, AsyncMock

from app.services.storage.git import Git, GitCommit


class TestGit:
    """Test cases for Git service."""

    @pytest.fixture
    def temp_storage(self):
        """Create a temporary directory for testing."""
        temp_dir = Path(tempfile.mkdtemp())

        # Set environment variable so service uses our temp directory
        original_root = os.environ.get('MARKDOWN_STORAGE_ROOT')
        os.environ['MARKDOWN_STORAGE_ROOT'] = str(temp_dir)

        yield temp_dir

        # Restore original environment
        if original_root is not None:
            os.environ['MARKDOWN_STORAGE_ROOT'] = original_root
        else:
            os.environ.pop('MARKDOWN_STORAGE_ROOT', None)

        shutil.rmtree(temp_dir)

    @pytest.fixture
    def git_service(self, temp_storage):
        """Create a Git service instance with temporary storage."""
        # Service will pick up MARKDOWN_STORAGE_ROOT from environment
        service = Git()
        yield service

    @pytest.mark.asyncio
    async def test_run_git_command_success(self, git_service, temp_storage):
        """Test successful git command execution."""
        repo_path = temp_storage / "test_repo"
        repo_path.mkdir()

        with patch('app.services.storage.git.operations.asyncio.create_subprocess_exec') as mock_exec:
            # Mock successful process
            mock_process = AsyncMock()
            mock_process.returncode = 0
            mock_process.communicate.return_value = (b"output", b"")
            mock_exec.return_value = mock_process

            success, stdout, stderr = await git_service.run_command(repo_path, ["status"])

            assert success is True
            assert stdout == "output"
            assert stderr == ""

    @pytest.mark.asyncio
    async def test_run_git_command_failure(self, git_service, temp_storage):
        """Test failed git command execution."""
        repo_path = temp_storage / "test_repo"
        repo_path.mkdir()

        with patch('app.services.storage.git.operations.asyncio.create_subprocess_exec') as mock_exec:
            # Mock failed process
            mock_process = AsyncMock()
            mock_process.returncode = 1
            mock_process.communicate.return_value = (b"", b"error message")
            mock_exec.return_value = mock_process

            success, stdout, stderr = await git_service.run_command(repo_path, ["status"])

            assert success is False
            assert stdout == ""
            assert stderr == "error message"

    @pytest.mark.asyncio
    async def test_initialize_repository_success(self, git_service, temp_storage):
        """Test successful repository initialization."""
        repo_path = temp_storage / "test_repo"

        with patch('app.services.storage.git.operations.run_git_command') as mock_git:
            # Mock successful git commands - the implementation calls these in sequence
            mock_git.side_effect = [
                (True, "", ""),  # git init
                (True, "", ""),  # git config user.name
                (True, "", ""),  # git config user.email
                (True, "", ""),  # git add .
                (True, "", ""),  # git commit
            ]

            result = await git_service.initialize(repo_path, "Initial commit")

            assert result is True
            assert repo_path.exists()

            # Verify all git commands were called
            assert mock_git.call_count == 5

            # Verify the sequence of calls
            calls = mock_git.call_args_list
            assert calls[0][0] == (repo_path, ["init"])
            assert calls[1][0] == (repo_path, ["config", "user.name", "Markdown Manager"])
            assert calls[2][0] == (repo_path, ["config", "user.email", "system@markdown-manager.local"])
            assert calls[3][0] == (repo_path, ["add", "."])
            assert calls[4][0] == (repo_path, ["commit", "-m", "Initial commit"])

    @pytest.mark.asyncio
    async def test_initialize_repository_init_failure(self, git_service, temp_storage):
        """Test repository initialization failure."""
        repo_path = temp_storage / "test_repo"

        with patch('app.services.storage.git.operations.run_git_command') as mock_git:
            # Mock git init failure
            mock_git.return_value = (False, "", "failed to init")

            result = await git_service.initialize(repo_path, "Initial commit")

            assert result is False
            # Only one call should be made (git init) before failure
            assert mock_git.call_count == 1
            assert mock_git.call_args_list[0][0] == (repo_path, ["init"])

    @pytest.mark.asyncio
    async def test_commit_changes_success(self, git_service, temp_storage):
        """Test successful commit."""
        repo_path = temp_storage / "test_repo"
        repo_path.mkdir()
        (repo_path / ".git").mkdir()

        with patch('app.services.storage.git.operations.run_git_command') as mock_git:
            # Mock git commands for successful commit
            mock_git.side_effect = [
                (True, "", ""),     # git add -A
                (False, "", ""),    # git diff --cached --quiet (False means there ARE changes)
                (True, "", ""),     # git commit
            ]

            result = await git_service.commit(repo_path, "Test commit")

            assert result is True

            # Verify git commands were called in correct order
            assert mock_git.call_count == 3
            calls = mock_git.call_args_list
            assert calls[0][0] == (repo_path, ["add", "-A"])
            assert calls[1][0] == (repo_path, ["diff", "--cached", "--quiet"])
            assert calls[2][0] == (repo_path, ["commit", "-m", "Test commit"])

    @pytest.mark.asyncio
    async def test_commit_changes_no_changes(self, git_service, temp_storage):
        """Test commit when no changes are staged."""
        repo_path = temp_storage / "test_repo"
        repo_path.mkdir()
        (repo_path / ".git").mkdir()

        with patch('app.services.storage.git.operations.run_git_command') as mock_git:
            # Mock git commands for no changes scenario
            mock_git.side_effect = [
                (True, "", ""),     # git add -A
                (True, "", ""),     # git diff --cached --quiet (True means NO changes)
            ]

            result = await git_service.commit(repo_path, "Test commit")

            assert result is True  # No changes is considered success

            # Should only call add and diff, not commit
            assert mock_git.call_count == 2
            calls = mock_git.call_args_list
            assert calls[0][0] == (repo_path, ["add", "-A"])
            assert calls[1][0] == (repo_path, ["diff", "--cached", "--quiet"])

    @pytest.mark.asyncio
    async def test_commit_changes_not_git_repo(self, git_service, temp_storage):
        """Test commit in directory that's not a git repository."""
        repo_path = temp_storage / "not_a_repo"
        repo_path.mkdir()

        result = await git_service.commit(repo_path, "Test commit")

        assert result is False

    @pytest.mark.asyncio
    async def test_get_repository_status_success(self, git_service, temp_storage):
        """Test getting repository status."""
        repo_path = temp_storage / "test_repo"
        repo_path.mkdir()
        (repo_path / ".git").mkdir()

        with patch('app.services.storage.git.history.run_git_command') as mock_git:
            # Mock git status commands
            mock_git.side_effect = [
                (True, "main", ""),  # git branch --show-current
                (True, "M  file1.md\n?? file2.md\nA  file3.md", ""),  # git status --porcelain
                (True, "abc123|Initial commit|Author|2023-01-01 12:00:00", ""),  # git log
            ]

            status = await git_service.status(repo_path)

            assert status["branch"] == "main"
            assert "file1.md" in status["staged_files"]
            assert "file3.md" in status["staged_files"]
            assert "file2.md" in status["untracked_files"]
            assert status["has_changes"] is True
            assert status["last_commit"]["hash"] == "abc123"
            assert status["last_commit"]["message"] == "Initial commit"

    @pytest.mark.asyncio
    async def test_get_repository_status_not_git_repo(self, git_service, temp_storage):
        """Test getting status of non-git directory."""
        repo_path = temp_storage / "not_a_repo"
        repo_path.mkdir()

        status = await git_service.status(repo_path)

        assert "error" in status
        assert status["error"] == "Not a git repository"

    @pytest.mark.asyncio
    async def test_get_file_history_success(self, git_service, temp_storage):
        """Test getting file history."""
        repo_path = temp_storage / "test_repo"
        repo_path.mkdir()
        (repo_path / ".git").mkdir()

        with patch('app.services.storage.git.history.run_git_command') as mock_git:
            # Mock git log output (split to stay under line limit)
            log_line1 = "abc123|Initial commit|Author|2023-01-01T12:00:00+00:00"
            log_line2 = "def456|Update file|Author2|2023-01-02T12:00:00+00:00"
            log_output = f"{log_line1}\n{log_line2}"
            mock_git.return_value = (True, log_output, "")

            commits = await git_service.file_history(repo_path, "test.md", limit=10)

            assert len(commits) == 2
            assert isinstance(commits[0], GitCommit)
            assert commits[0].hash == "abc123"
            assert commits[0].message == "Initial commit"
            assert commits[1].hash == "def456"
            assert commits[1].message == "Update file"

    @pytest.mark.asyncio
    async def test_get_file_history_not_git_repo(self, git_service, temp_storage):
        """Test getting file history in non-git directory."""
        repo_path = temp_storage / "not_a_repo"
        repo_path.mkdir()

        commits = await git_service.file_history(repo_path, "test.md")

        assert commits == []

    @pytest.mark.asyncio
    async def test_get_file_content_at_commit_success(self, git_service, temp_storage):
        """Test getting file content at specific commit."""
        repo_path = temp_storage / "test_repo"
        repo_path.mkdir()
        (repo_path / ".git").mkdir()

        with patch('app.services.storage.git.history.run_git_command') as mock_git:
            # Mock git show output
            mock_git.return_value = (True, "# Test Content\nThis is the content.", "")

            content = await git_service.file_at_commit(repo_path, "test.md", "abc123")

            assert content == "# Test Content\nThis is the content."

            # Verify correct git command was called
            expected_cmd = ["show", "abc123:test.md"]
            assert mock_git.call_args_list[0][0] == (repo_path, expected_cmd)

    @pytest.mark.asyncio
    async def test_get_file_content_at_commit_not_found(self, git_service, temp_storage):
        """Test getting file content when file doesn't exist at commit."""
        repo_path = temp_storage / "test_repo"
        repo_path.mkdir()
        (repo_path / ".git").mkdir()

        with patch('app.services.storage.git.history.run_git_command') as mock_git:
            # Mock git show failure
            mock_git.return_value = (False, "", "file not found")

            content = await git_service.file_at_commit(repo_path, "test.md", "abc123")

            assert content is None

    @pytest.mark.asyncio
    async def test_clone_repository_success(self, git_service, temp_storage):
        """Test successful repository cloning."""
        target_path = temp_storage / "cloned_repo"
        repo_url = "https://github.com/user/repo.git"

        with patch('app.services.storage.git.operations.asyncio.create_subprocess_exec') as mock_exec:
            # Mock successful clone process
            mock_process = AsyncMock()
            mock_process.returncode = 0
            mock_process.communicate.return_value = (b"Cloning...", b"")
            mock_exec.return_value = mock_process

            result = await git_service.clone(repo_url, target_path)

            assert result is True

            # Verify git clone command was called correctly
            expected_cmd = ["git", "clone", repo_url, str(target_path)]
            assert mock_exec.call_args[0] == tuple(expected_cmd)

    @pytest.mark.asyncio
    async def test_clone_repository_with_branch(self, git_service, temp_storage):
        """Test repository cloning with specific branch."""
        target_path = temp_storage / "cloned_repo"
        repo_url = "https://github.com/user/repo.git"
        branch = "feature-branch"

        with patch('app.services.storage.git.operations.asyncio.create_subprocess_exec') as mock_exec:
            # Mock successful clone process
            mock_process = AsyncMock()
            mock_process.returncode = 0
            mock_process.communicate.return_value = (b"Cloning...", b"")
            mock_exec.return_value = mock_process

            result = await git_service.clone(repo_url, target_path, branch)

            assert result is True

            # Verify git clone command included branch
            expected_cmd = ["git", "clone", "--branch", "feature-branch", "--single-branch", repo_url, str(target_path)]
            assert mock_exec.call_args[0] == tuple(expected_cmd)

    @pytest.mark.asyncio
    async def test_clone_repository_failure(self, git_service, temp_storage):
        """Test failed repository cloning."""
        target_path = temp_storage / "cloned_repo"
        repo_url = "https://github.com/user/nonexistent.git"

        with patch('app.services.storage.git.operations.asyncio.create_subprocess_exec') as mock_exec:
            # Mock failed clone process
            mock_process = AsyncMock()
            mock_process.returncode = 1
            mock_process.communicate.return_value = (b"", b"Repository not found")
            mock_exec.return_value = mock_process

            result = await git_service.clone(repo_url, target_path)

            assert result is False

    @pytest.mark.asyncio
    async def test_pull_changes_success(self, git_service, temp_storage):
        """Test successful pull changes."""
        repo_path = temp_storage / "test_repo"
        repo_path.mkdir()
        (repo_path / ".git").mkdir()

        with patch('app.services.storage.git.operations.run_git_command') as mock_git:
            # Mock successful pull
            mock_git.return_value = (True, "Already up to date.", "")

            result = await git_service.pull(repo_path)

            assert result is True

            # Verify git pull was called
            assert mock_git.call_args_list[0][0] == (repo_path, ["pull"])

    @pytest.mark.asyncio
    async def test_pull_changes_with_branch(self, git_service, temp_storage):
        """Test pull changes with specific branch."""
        repo_path = temp_storage / "test_repo"
        repo_path.mkdir()
        (repo_path / ".git").mkdir()
        branch = "feature-branch"

        with patch('app.services.storage.git.operations.run_git_command') as mock_git:
            # Mock successful checkout and pull
            mock_git.side_effect = [
                (True, "", ""),  # git checkout
                (True, "Already up to date.", ""),  # git pull
            ]

            result = await git_service.pull(repo_path, branch)

            assert result is True

            # Verify git checkout and pull were called
            assert mock_git.call_args_list[0][0] == (repo_path, ["checkout", branch])
            assert mock_git.call_args_list[1][0] == (repo_path, ["pull"])

    @pytest.mark.asyncio
    async def test_pull_changes_not_git_repo(self, git_service, temp_storage):
        """Test pull changes in non-git directory."""
        repo_path = temp_storage / "not_a_repo"
        repo_path.mkdir()

        result = await git_service.pull(repo_path)

        assert result is False


class TestGitCommit:
    """Test cases for GitCommit class."""

    def test_git_commit_creation(self):
        """Test GitCommit object creation."""
        from datetime import datetime

        commit_date = datetime(2023, 1, 1, 12, 0, 0)
        commit = GitCommit(
            hash="abc123",
            message="Test commit",
            author="Test Author",
            date=commit_date,
            files=["file1.md", "file2.md"]
        )

        assert commit.hash == "abc123"
        assert commit.message == "Test commit"
        assert commit.author == "Test Author"
        assert commit.date == commit_date
        assert commit.files == ["file1.md", "file2.md"]

    def test_git_commit_to_dict(self):
        """Test GitCommit to_dict method."""
        from datetime import datetime

        commit_date = datetime(2023, 1, 1, 12, 0, 0)
        commit = GitCommit(
            hash="abc123",
            message="Test commit",
            author="Test Author",
            date=commit_date,
            files=["file1.md"]
        )

        result = commit.to_dict()

        expected = {
            "hash": "abc123",
            "message": "Test commit",
            "author": "Test Author",
            "date": "2023-01-01T12:00:00",
            "files": ["file1.md"]
        }

        assert result == expected
