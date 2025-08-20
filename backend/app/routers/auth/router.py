"""Main authentication router that aggregates all auth sub-routers."""
from fastapi import APIRouter

from . import login, mfa, password_reset, profile, registration

router = APIRouter()

# Include all auth sub-routers
router.include_router(login.router, tags=["authentication"])
router.include_router(registration.router, tags=["registration"])
router.include_router(profile.router, tags=["profile"])
router.include_router(password_reset.router, tags=["password-reset"])
router.include_router(mfa.router, prefix="/mfa", tags=["mfa"])
