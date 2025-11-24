"""Password reset endpoints."""
import os
import secrets
import smtplib
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs import settings
from app.crud import user as crud_user
from app.database import get_db
from app.schemas.user import PasswordResetConfirm, PasswordResetRequest

router = APIRouter()

router = APIRouter()


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
    SMTP_PASS = settings.smtp_password
    FROM_EMAIL = settings.from_email

    # Compose reset link
    reset_link = f"https://yourdomain.com/reset-password?reset_token={token}"
    subject = "Password Reset Request"
    body = (
        "Hello,\n\nTo reset your password, click the link below:\n"
        f"{reset_link}\n\nIf you did not request this, you can ignore this email."
    )

    # Send email (simple SMTP, fill in config above)
    try:
        msg = MIMEText(body)
        msg["Subject"] = subject
        msg["From"] = FROM_EMAIL
        msg["To"] = request_data.email

        if SMTP_USER and SMTP_PASS:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
                server.starttls()
                server.login(SMTP_USER, SMTP_PASS)
                server.sendmail(FROM_EMAIL, [request_data.email], msg.as_string())
    except Exception as e:
        # Log error, but don't reveal to user
        print(f"Error sending password reset email: {e}")

    # Only send debug_token if DEBUG_PASSWORD_RESET_TOKEN env var is set
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
