"""Authentication API routes."""
import secrets
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    authenticate_user,
    create_access_token,
    get_current_active_user,
)
from app.core.config import settings
from app.core.mfa import verify_backup_code, verify_totp_code
from app.crud import user as crud_user
from app.database import get_db
from app.models.user import User
from app.schemas.user import (
    LoginMFARequest,
    LoginResponse,
    PasswordResetConfirm,
    PasswordResetRequest,
    Token,
    UserCreate,
    UserLogin,
    UserResponse,
)

router = APIRouter()


@router.post("/register", response_model=UserResponse)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)) -> Any:
    """Register a new user."""
    # Check if user already exists
    existing_user = await crud_user.get_user_by_email(db, user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Create new user
    user = await crud_user.create_user(db, user_data)
    return user


@router.post("/login", response_model=LoginResponse)
async def login(user_credentials: UserLogin, db: AsyncSession = Depends(get_db)) -> Any:
    """Authenticate user and return access token (or require MFA)."""
    user = await authenticate_user(
        db, user_credentials.email, user_credentials.password
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user",
        )

    # Check if MFA is enabled
    if user.mfa_enabled:
        return LoginResponse(mfa_required=True)

    # Normal login flow (no MFA)
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )

    return LoginResponse(
        mfa_required=False,
        access_token=access_token,
        token_type="bearer",
        user=user,
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Get current user profile."""
    return current_user


@router.post("/password-reset-request")
async def request_password_reset(
    request_data: PasswordResetRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Request password reset by email."""
    # Check if user exists
    user = await crud_user.get_user_by_email(db, request_data.email)
    if not user:
        # Don't reveal if email exists or not for security
        return {"message": "If the email exists, a reset link has been sent"}

    # Generate reset token
    token = secrets.token_urlsafe(32)
    expires = datetime.utcnow() + timedelta(hours=1)  # Token expires in 1 hour

    # Save token to database
    await crud_user.create_password_reset_token(db, request_data.email, token, expires)

    # SMTP configuration (from settings)
    SMTP_HOST = settings.smtp_host
    SMTP_PORT = settings.smtp_port
    SMTP_USER = settings.smtp_user
    SMTP_PASS = settings.smtp_pass
    FROM_EMAIL = settings.from_email

    # Compose reset link
    reset_link = f"https://yourdomain.com/reset-password?reset_token={token}"
    subject = "Password Reset Request"
    body = (
        "Hello,\n\nTo reset your password, click the link below:\n"
        f"{reset_link}\n\nIf you did not request this, you can ignore this email."
    )

    # Send email (simple SMTP, fill in config above)
    import smtplib
    from email.mime.text import MIMEText

    try:
        msg = MIMEText(body)
        msg["Subject"] = subject
        msg["From"] = FROM_EMAIL
        msg["To"] = request_data.email

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(FROM_EMAIL, [request_data.email], msg.as_string())
    except Exception as e:
        # Log error, but don't reveal to user
        print(f"Error sending password reset email: {e}")

    # Only send debug_token if DEBUG_PASSWORD_RESET_TOKEN env var is set
    import os

    print("HI")
    debug_token = None
    print(os.getenv("DEBUG_PASSWORD_RESET_TOKEN", "NotFound"))
    if os.getenv("DEBUG_PASSWORD_RESET_TOKEN", "false").lower() == "true":
        debug_token = token

    response = {"message": "If the email exists, a reset link has been sent"}
    if debug_token:
        response["debug_token"] = debug_token
    return response


@router.post("/password-reset-confirm")
async def confirm_password_reset(
    reset_data: PasswordResetConfirm, db: AsyncSession = Depends(get_db)
) -> Any:
    """Confirm password reset with token."""
    success = await crud_user.reset_password_with_token(
        db, reset_data.token, reset_data.new_password
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    return {"message": "Password has been reset successfully"}


@router.post("/login-mfa", response_model=Token)
async def login_mfa(
    mfa_credentials: LoginMFARequest, db: AsyncSession = Depends(get_db)
) -> Any:
    """Complete MFA login with TOTP code."""
    # Re-authenticate the user (verify password again for security)
    user = await authenticate_user(db, mfa_credentials.email, mfa_credentials.password)
    if not user or not user.is_active or not user.mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid MFA login attempt",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify TOTP code or backup code
    totp_valid = verify_totp_code(str(user.totp_secret), mfa_credentials.code)
    backup_valid = False

    if not totp_valid and user.backup_codes:
        backup_valid, updated_codes = verify_backup_code(
            user.backup_codes, mfa_credentials.code
        )
        # Update backup codes if one was used
        if backup_valid:
            await crud_user.update_backup_codes(db, int(user.id), updated_codes)

    if not totp_valid and not backup_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid TOTP code or backup code",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Generate access token
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
    }
