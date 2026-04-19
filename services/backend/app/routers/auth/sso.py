"""Cross-app SSO check endpoint."""
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Request, Response, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs import settings
from app.configs.environment import environment_config
from app.core.auth import create_access_token, validate_sso_token
from app.crud import user as crud_user
from app.database import get_db
from app.routers.auth.login import create_refresh_token, REFRESH_COOKIE

logger = logging.getLogger(__name__)
router = APIRouter()

SSO_COOKIE = "sso_token"


@router.get("/sso-check")
async def sso_check(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Check for a valid cross-app SSO cookie and bootstrap a local session."""
    if not settings.sso_secret_key:
        raise HTTPException(status_code=404, detail="SSO not configured")

    token = request.cookies.get(SSO_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="No SSO token")

    sso_data = validate_sso_token(token)
    if not sso_data:
        raise HTTPException(status_code=401, detail="Invalid or expired SSO token")

    user = await crud_user.get_user_by_email(db, sso_data.email)
    if not user:
        return {"linked": False, "email": sso_data.email, "issuer": sso_data.issuer}

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    # MFA gate: if local user requires MFA but SSO login didn't verify MFA, reject
    if user.mfa_enabled and not sso_data.mfa_verified:
        return {"mfa_required": True, "email": sso_data.email}

    # Bootstrap local session
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    refresh_token_expires = timedelta(days=14)
    refresh_token = create_refresh_token({"sub": user.email}, refresh_token_expires)
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=refresh_token,
        httponly=True,
        secure=settings.secure_cookies,
        samesite="lax",
        max_age=14 * 24 * 60 * 60,
        path="/",
        domain=environment_config.get_cookie_domain(),
    )

    # Track last login
    user.last_login = datetime.utcnow()
    await db.commit()

    # Load current document content if it exists
    if user.current_document and user.current_document.file_path:
        from app.services.storage.user import UserStorage
        try:
            storage_service = UserStorage()
            content = await storage_service.read_document(
                user_id=user.id,
                file_path=user.current_document.file_path
            )
            user.current_document.content = content or ""
        except Exception as e:
            logger.warning(f"Failed to load current document content for user {user.id} (SSO): {e}")
            user.current_document.content = ""

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
    }
