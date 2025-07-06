"""User model."""
from typing import Any

from sqlalchemy import Boolean, Column, DateTime, String, Text
from sqlalchemy.orm import relationship

from .base import BaseModel


class User(BaseModel):
    """User model for authentication and profile management."""

    __tablename__ = "users"

    # Authentication fields
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)

    # Password reset fields
    reset_token: Any = Column(String(255), nullable=True)
    reset_token_expires: Any = Column(DateTime, nullable=True)

    # MFA fields
    mfa_enabled = Column(Boolean, default=False)
    totp_secret: Any = Column(String(255), nullable=True)  # Base32 encoded secret
    backup_codes: Any = Column(Text, nullable=True)  # JSON array of backup codes

    # Profile fields
    first_name: Any = Column(String(100))
    last_name: Any = Column(String(100))
    display_name: Any = Column(String(100))
    bio: Any = Column(Text)

    # Account status
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)

    # Relationship to documents
    documents: Any = relationship("Document", back_populates="owner")

    @property
    def full_name(self) -> str:
        """Get the user's full name."""
        first = getattr(self, "first_name", None)
        last = getattr(self, "last_name", None)
        display = getattr(self, "display_name", None)
        email = getattr(self, "email", "")

        if first and last:
            return f"{first} {last}"
        return display or email.split("@")[0] if email else "User"
