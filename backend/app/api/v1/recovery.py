from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.document_recovery import (
    create_recovery_doc,
    delete_recovery_doc,
    get_recovery_docs,
)
from app.database import get_db
from app.schemas.document_recovery import DocumentRecovery, DocumentRecoveryCreate

router = APIRouter()


@router.post("/save", response_model=DocumentRecovery)
async def save_recovery_doc(
    doc: DocumentRecoveryCreate, db: AsyncSession = Depends(get_db)
) -> DocumentRecovery:
    return await create_recovery_doc(db, doc)


@router.get("/list/{user_id}", response_model=List[DocumentRecovery])
async def list_recovery_docs(
    user_id: int, db: AsyncSession = Depends(get_db)
) -> list[DocumentRecovery]:
    docs = await get_recovery_docs(db, user_id)
    return [DocumentRecovery.model_validate(doc, from_attributes=True) for doc in docs]


@router.post("/resolve/{doc_id}")
async def resolve_recovery_doc(
    doc_id: int, db: AsyncSession = Depends(get_db)
) -> dict[str, str]:
    doc = await delete_recovery_doc(db, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Recovery document not found")
    return {"status": "resolved"}
