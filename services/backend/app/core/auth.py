"""Authentication utilities."""
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from jwt.exceptions import InvalidTokenError
import argon2
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.configs import settings
from app.database import get_db
from app.models.user import User

# Password hashing - using argon2-cffi
_password_hasher = argon2.PasswordHasher()

# Token authentication
security = HTTPBearer()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    try:
        return _password_hasher.verify(hashed_password, plain_password)
    except (argon2.exceptions.VerifyMismatchError, argon2.exceptions.VerificationError, argon2.exceptions.InvalidHashError):
        return False


def get_password_hash(password: str) -> str:
    """Generate password hash."""
    return _password_hasher.hash(password)


def create_access_token(
    data: dict[str, object], expires_delta: Optional[timedelta] = None
) -> str:
    """Create access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.access_token_expire_minutes
        )
    to_encode.update({
        "exp": expire,
        "iss": settings.app_identifier,
        "aud": settings.app_identifier,
    })
    encoded_jwt = jwt.encode(
        to_encode, settings.secret_key, algorithm=settings.algorithm
    )
    return str(encoded_jwt)


# ── Cross-app SSO token functions ────────────────────────────────────────────


@dataclass
class SSOTokenData:
    email: str
    issuer: str
    mfa_verified: bool


def create_sso_token(email: str, mfa_verified: bool = False) -> str:
    """Create a cross-app SSO token signed with the shared SSO secret."""
    expire = datetime.now(timezone.utc) + timedelta(days=settings.sso_token_expire_days)
    payload = {
        "sub": email,
        "iss": settings.app_identifier,
        "aud": "sso",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "mfa_verified": mfa_verified,
    }
    return jwt.encode(payload, settings.sso_secret_key, algorithm=settings.algorithm)


def validate_sso_token(token: str) -> Optional[SSOTokenData]:
    """Validate a cross-app SSO token. Returns SSOTokenData or None."""
    if not settings.sso_secret_key:
        return None
    try:
        payload = jwt.decode(
            token,
            settings.sso_secret_key,
            algorithms=[settings.algorithm],
            audience="sso",
        )
        email = payload.get("sub")
        if not email:
            return None
        return SSOTokenData(
            email=email,
            issuer=payload.get("iss", ""),
            mfa_verified=payload.get("mfa_verified", False),
        )
    except jwt.InvalidTokenError:
        return None


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    """Get user by email, eagerly loading current_document."""
    result = await db.execute(
        select(User)
        .options(selectinload(User.current_document))
        .where(User.email == email)
    )
    return result.scalar_one_or_none()


async def authenticate_user(
    db: AsyncSession, email: str, password: str
) -> Optional[User]:
    """Authenticate user by email and password."""
    user = await get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, str(user.hashed_password)):
        return None
    return user


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Get current authenticated user."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.secret_key,
            algorithms=[settings.algorithm],
            audience=settings.app_identifier,
        )
        email = payload.get("sub")
        if not isinstance(email, str) or not email:
            raise credentials_exception
    except InvalidTokenError:
        raise credentials_exception

    user = await get_user_by_email(db, email=email)
    if user is None:
        raise credentials_exception
    return user


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Get current authenticated user, or None if not authenticated."""
    if not credentials:
        return None

    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.secret_key,
            algorithms=[settings.algorithm],
            audience=settings.app_identifier,
        )
        email = payload.get("sub")
        if not isinstance(email, str) or not email:
            return None
    except InvalidTokenError:
        return None

    user = await get_user_by_email(db, email=email)
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Get current active user."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user"
        )
    return current_user


async def get_admin_user(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """Get current admin user."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user
