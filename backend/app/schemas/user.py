"""User schemas for API requests and responses."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class UserBase(BaseModel):
    """Base user schema."""

    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    display_name: Optional[str] = None
    bio: Optional[str] = None


class UserCreate(UserBase):
    """User creation schema."""

    password: str


class UserUpdate(BaseModel):
    """User update schema."""

    first_name: Optional[str] = None
    last_name: Optional[str] = None
    display_name: Optional[str] = None
    bio: Optional[str] = None
    sync_preview_scroll_enabled: Optional[bool] = None
    autosave_enabled: Optional[bool] = None


class UserUpdatePassword(BaseModel):
    """Password update schema."""

    current_password: str
    new_password: str


class PasswordResetRequest(BaseModel):
    """Password reset request schema."""

    email: EmailStr


class PasswordResetConfirm(BaseModel):
    """Password reset confirmation schema."""

    token: str
    new_password: str


class UserLogin(BaseModel):
    """User login schema."""

    email: EmailStr
    password: str


class UserResponse(UserBase):
    """User response schema."""

    id: int
    is_active: bool
    is_verified: bool
    mfa_enabled: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    full_name: str
    sync_preview_scroll_enabled: bool
    autosave_enabled: bool

    class Config:
        """Pydantic config."""

        from_attributes = True


class Token(BaseModel):
    """Token response schema."""

    access_token: str
    token_type: str
    user: UserResponse


class TokenData(BaseModel):
    """Token data schema."""

    email: Optional[str] = None


class MFASetupRequest(BaseModel):
    """MFA setup initiation request."""

    pass  # No fields needed for setup initiation


class MFASetupResponse(BaseModel):
    """MFA setup response with QR code data."""

    qr_code_data_url: str  # Base64 encoded QR code image
    secret: str  # The TOTP secret for manual entry
    backup_codes: list[str]  # One-time backup codes


class MFAVerifyRequest(BaseModel):
    """MFA verification request."""

    totp_code: str  # 6-digit TOTP code


class MFAToggleRequest(BaseModel):
    """MFA enable/disable request."""

    totp_code: str  # Required to enable/disable
    current_password: str  # Required for security


class LoginMFARequest(BaseModel):
    """Second step MFA login request."""

    email: EmailStr  # To identify the user
    password: str  # Original password for re-verification
    code: str  # 6-digit TOTP code or backup code


class LoginResponse(BaseModel):
    """Login response that may require MFA."""

    mfa_required: bool
    access_token: Optional[str] = None
    token_type: Optional[str] = None
    user: Optional[UserResponse] = None
