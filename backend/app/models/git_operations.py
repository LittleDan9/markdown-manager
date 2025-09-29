"""
Git Operations Models

Models for tracking git operations, errors, and logging across all repository types.
"""

from typing import Optional
from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class GitOperationLog(BaseModel):
    """Log of git operations performed through the API."""

    __tablename__ = "git_operation_logs"

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=True, index=True)

    # Operation details
    operation_type = Column(String(50), nullable=False, index=True)  # commit, stash, branch, etc.
    repository_type = Column(String(20), nullable=False)  # local, github
    repository_path = Column(String(500), nullable=True)  # For local repos
    github_repository_id = Column(Integer, ForeignKey("github_repositories.id"), nullable=True)

    # Git command details
    git_command = Column(JSON, nullable=True)  # Array of git command parts
    success = Column(Boolean, nullable=False, default=False)

    # Output and error information
    stdout_output = Column(Text, nullable=True)
    stderr_output = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)  # Human-readable error summary

    # Additional context
    branch_name = Column(String(255), nullable=True)
    commit_hash = Column(String(40), nullable=True)
    operation_metadata = Column(JSON, nullable=True)  # Additional operation-specific data

    # Timing
    duration_ms = Column(Integer, nullable=True)  # Operation duration in milliseconds

    # Relationships
    user = relationship("User", back_populates="git_operation_logs")
    document = relationship("Document", back_populates="git_operation_logs")
    github_repository = relationship("GitHubRepository", back_populates="git_operation_logs")

    def __repr__(self):
        return f"<GitOperationLog(id={self.id}, operation='{self.operation_type}', success={self.success})>"

    def to_dict(self):
        """Convert to dictionary for API responses."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "document_id": self.document_id,
            "operation_type": self.operation_type,
            "repository_type": self.repository_type,
            "repository_path": self.repository_path,
            "github_repository_id": self.github_repository_id,
            "git_command": self.git_command,
            "success": self.success,
            "stdout_output": self.stdout_output,
            "stderr_output": self.stderr_output,
            "error_message": self.error_message,
            "branch_name": self.branch_name,
            "commit_hash": self.commit_hash,
            "operation_metadata": self.operation_metadata,
            "duration_ms": self.duration_ms,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

    @classmethod
    def create_log_entry(
        cls,
        user_id: int,
        operation_type: str,
        repository_type: str,
        success: bool,
        document_id: Optional[int] = None,
        repository_path: Optional[str] = None,
        github_repository_id: Optional[int] = None,
        git_command: Optional[list] = None,
        stdout_output: Optional[str] = None,
        stderr_output: Optional[str] = None,
        error_message: Optional[str] = None,
        branch_name: Optional[str] = None,
        commit_hash: Optional[str] = None,
        operation_metadata: Optional[dict] = None,
        duration_ms: Optional[int] = None
    ) -> "GitOperationLog":
        """Create a new git operation log entry."""
        return cls(
            user_id=user_id,
            document_id=document_id,
            operation_type=operation_type,
            repository_type=repository_type,
            repository_path=repository_path,
            github_repository_id=github_repository_id,
            git_command=git_command,
            success=success,
            stdout_output=stdout_output,
            stderr_output=stderr_output,
            error_message=error_message,
            branch_name=branch_name,
            commit_hash=commit_hash,
            operation_metadata=operation_metadata,
            duration_ms=duration_ms
        )
