"""API v1 router."""
from fastapi import APIRouter

from app.api.v1 import auth, custom_dictionary, mfa, syntax_highlighting, users
from app.api.v1.endpoints import debug, documents, health, pdf

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(mfa.router, prefix="/mfa", tags=["mfa"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(pdf.router, prefix="/pdf", tags=["pdf"])
api_router.include_router(debug.router, prefix="/debug", tags=["debug"])
api_router.include_router(
    syntax_highlighting.router, prefix="/highlight", tags=["syntax-highlighting"]
)
api_router.include_router(
    custom_dictionary.router, prefix="/dictionary", tags=["custom-dictionary"]
)
