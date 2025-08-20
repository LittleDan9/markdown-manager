"""Login and authentication endpoints."""
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs import settings
from app.core.auth import authenticate_user, create_access_token
from app.core.mfa import verify_backup_code, verify_totp_code
from app.crud import user as crud_user
from app.database import get_db
from app.schemas.user import LoginMFARequest, LoginResponse, Token, UserLogin

router = APIRouter()


def create_refresh_token(data: dict, expires_delta: timedelta):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


@router.post("/login", response_model=LoginResponse)
async def login(
    user_credentials: UserLogin,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> Any:
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
    # Refresh token expires in 14 days (consistent with frontend expectations)
    refresh_token_expires = timedelta(days=14)
    refresh_token = create_refresh_token({"sub": user.email}, refresh_token_expires)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.secure_cookies,  # Environment-based setting
        samesite="lax",
        max_age=14 * 24 * 60 * 60,
        path="/",
    )
    return LoginResponse(
        mfa_required=False,
        access_token=access_token,
        token_type="bearer",
        user=user,
    )


@router.post("/refresh", response_model=Token)
async def refresh_token(
    response: Response,
    refresh_token: str = Cookie(None),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Refresh access token using a valid refresh token (from cookie)."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate refresh token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not refresh_token:
        raise credentials_exception
    try:
        payload = jwt.decode(
            refresh_token, settings.secret_key, algorithms=[settings.algorithm]
        )
        email = payload.get("sub")
        if not isinstance(email, str) or not email:
            raise credentials_exception
        token_type = payload.get("type")
        if token_type != "refresh":
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = await crud_user.get_user_by_email(db, email=email)
    if user is None or not user.is_active:
        raise credentials_exception
    # Issue new access token
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    # Optionally refresh the refresh token itself (sliding window - 14 days)
    refresh_token_expires = timedelta(days=14)
    new_refresh_token = create_refresh_token({"sub": user.email}, refresh_token_expires)
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=settings.secure_cookies,  # Environment-based setting
        samesite="lax",
        max_age=14 * 24 * 60 * 60,
        path="/",
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
    }


@router.post("/login-mfa", response_model=Token)
async def login_mfa(
    mfa_credentials: LoginMFARequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
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
    # Refresh token expires in 14 days (consistent with frontend expectations)
    refresh_token_expires = timedelta(days=14)
    refresh_token = create_refresh_token({"sub": user.email}, refresh_token_expires)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.secure_cookies,  # Environment-based setting
        samesite="lax",
        max_age=14 * 24 * 60 * 60,
        path="/",
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
    }


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out"}
