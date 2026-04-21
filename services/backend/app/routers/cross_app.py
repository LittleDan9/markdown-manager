"""Cross-app API endpoints for service-to-service document access.

These endpoints are authenticated via a shared secret (X-Cross-App-Token header)
rather than user JWT tokens. The calling service passes X-User-Email to identify
which user's documents to access.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs import get_settings
from app.crud import document as document_crud
from app.crud.user import get_user_by_email
from app.database import get_db
from app.models.user import User
from app.routers.documents.response_utils import create_document_response
from app.schemas.document import DocumentResponse

logger = logging.getLogger(__name__)

router = APIRouter()


async def verify_cross_app_token(
    x_cross_app_token: str = Header(..., description="Cross-app shared secret"),
) -> None:
    """Validate the cross-app service token."""
    settings = get_settings()
    if not settings.cross_app_secret:
        raise HTTPException(status_code=503, detail="Cross-app API not configured")
    if x_cross_app_token != settings.cross_app_secret:
        raise HTTPException(status_code=403, detail="Invalid cross-app token")


async def get_cross_app_user(
    x_user_email: str = Header(..., description="Email of the user to act on behalf of"),
    db: AsyncSession = Depends(get_db),
    _token: None = Depends(verify_cross_app_token),
) -> User:
    """Look up the local user by email after verifying the cross-app token."""
    user = await get_user_by_email(db, x_user_email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found in Markdown Manager")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is inactive")
    return user


@router.get("/documents")
async def list_documents(
    folder_path: Optional[str] = Query(None, description="Filter by folder path"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    user: User = Depends(get_cross_app_user),
    db: AsyncSession = Depends(get_db),
):
    """List documents for the identified user (metadata only, no content)."""
    if folder_path:
        from app.models.document import Document as DocumentModel
        normalized = DocumentModel.normalize_folder_path(folder_path)
        documents = await document_crud.document.get_documents_by_folder_path(
            db, user.id, normalized
        )
        documents = documents[skip:skip + limit]
    else:
        documents = await document_crud.document.get_by_user(
            db=db, user_id=user.id, skip=skip, limit=limit
        )

    return [
        {
            "id": doc.id,
            "name": doc.name,
            "folder_path": doc.folder_path or "/",
            "category_name": getattr(doc, "category", None),
            "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
            "created_at": doc.created_at.isoformat() if doc.created_at else None,
        }
        for doc in documents
        if doc.repository_type != "github"  # Only local documents
    ]


@router.get("/documents/semantic-search")
async def semantic_search(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(10, ge=1, le=50),
    user: User = Depends(get_cross_app_user),
    db: AsyncSession = Depends(get_db),
):
    """Semantic search across the user's documents."""
    from app.services.search.semantic import SemanticSearchService
    from app.services.search.embedding_client import EmbeddingClient

    settings = get_settings()
    client = EmbeddingClient(base_url=settings.embedding_service_url)
    try:
        import redis.asyncio as aioredis
        redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)
    except Exception:
        redis_client = None

    service = SemanticSearchService(client, redis_client=redis_client)
    results = await service.search(db, user.id, q, limit=limit)

    response = []
    for result in results:
        doc = result.document
        # Load content for excerpt
        doc_response = await create_document_response(
            document=doc, user_id=user.id, db=db
        )
        content = doc_response.content or ""
        response.append({
            "id": doc.id,
            "name": doc.name,
            "folder_path": doc.folder_path or "/",
            "category_name": getattr(doc, "category", None),
            "content_excerpt": content[:500] if content else "",
            "score": result.score,
            "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
        })

    return response


@router.get("/documents/{document_id}")
async def get_document(
    document_id: int,
    user: User = Depends(get_cross_app_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single document with full content."""
    document = await document_crud.document.get(db=db, id=document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    if document.user_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    doc_response = await create_document_response(
        document=document, user_id=user.id, db=db
    )

    return {
        "id": doc_response.id,
        "name": doc_response.name,
        "content": doc_response.content,
        "folder_path": doc_response.folder_path,
        "category_name": doc_response.category_name,
        "updated_at": doc_response.updated_at.isoformat() if doc_response.updated_at else None,
        "created_at": doc_response.created_at.isoformat() if doc_response.created_at else None,
    }
