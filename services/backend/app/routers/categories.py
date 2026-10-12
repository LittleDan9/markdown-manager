"""Categories API routes."""
import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user
from app.crud import category as crud_category
from app.database import get_db
from app.models.document import Document as DocumentModel
from app.models.user import User
from app.schemas.category import (
    CategoryCreate,
    CategoryResponse,
    CategoryUpdate,
    CategoryWithStats,
)

router = APIRouter()

logger = logging.getLogger(__name__)


async def _get_local_documents_in_category(
    db: AsyncSession, user_id: int, category_id: int
) -> list[DocumentModel]:
    """Fetch the user's documents that belong to a category."""
    result = await db.execute(
        select(DocumentModel).where(
            DocumentModel.category_id == category_id,
            DocumentModel.user_id == user_id,
        )
    )
    return list(result.scalars().all())


async def _relocate_documents_to_category(
    storage,
    user_id: int,
    docs: list[DocumentModel],
    target_category_id: int,
    target_category_name: str,
) -> None:
    """Move documents into the target category (DB + filesystem).

    Updates ``category_id``/``folder_path`` for every document and moves the
    backing local file into the target category directory. ``file_path`` is only
    repointed when the on-disk move succeeds so content remains readable.
    """
    for doc in docs:
        doc.category_id = target_category_id
        doc.folder_path = f"/{target_category_name}"

        if doc.file_path and doc.file_path.startswith("local/"):
            filename = doc.file_path.split("/")[-1]
            new_path = f"local/{target_category_name}/{filename}"
            if new_path != doc.file_path:
                try:
                    moved = await storage.move_document(
                        user_id=user_id,
                        old_path=doc.file_path,
                        new_path=new_path,
                        commit_message=f"Move {filename} to {target_category_name}",
                        auto_commit=True,
                    )
                    if moved:
                        doc.file_path = new_path
                    else:
                        logger.warning(
                            "Could not move file for document %s to %s", doc.id, new_path
                        )
                except Exception:
                    logger.warning(
                        "Failed to move file for document %s during category migration",
                        doc.id,
                        exc_info=True,
                    )


@router.get("", response_model=list[CategoryResponse])
async def get_categories(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Get all categories for the current user."""
    categories = await crud_category.get_user_categories(db, int(current_user.id))
    return categories


@router.get("/stats", response_model=list[CategoryWithStats])
async def get_categories_with_stats(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Get all categories for the current user with document and dictionary counts."""
    categories = await crud_category.get_user_categories_with_stats(
        db, int(current_user.id)
    )
    return categories


@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(
    category_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Get a specific category."""
    category = await crud_category.get_category_by_id(
        db, category_id, int(current_user.id)
    )
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )
    return category


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    category_data: CategoryCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Create a new category."""
    # Check if category already exists
    existing_category = await crud_category.get_category_by_name(
        db, category_data.name, int(current_user.id)
    )
    if existing_category:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Category with this name already exists",
        )

    new_category = await crud_category.create_category(
        db, category_data, int(current_user.id)
    )

    # Initialize a git repository for the new category so version history
    # is available immediately (registration does this for default categories;
    # this covers user-created categories).
    try:
        from app.services.storage import UserStorage
        storage_service = UserStorage()
        await storage_service.initialize_category_repo(int(current_user.id), new_category.name)
    except Exception as exc:
        # Non-fatal: category is created in DB; git init failure only means
        # version history won't be available until the repo is lazily created.
        import logging
        logging.getLogger(__name__).warning(
            f"Failed to initialize git repo for category '{new_category.name}': {exc}"
        )

    return new_category


@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: int,
    category_data: CategoryUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Update a category."""
    # Load the existing category first so we can detect a rename
    existing = await crud_category.get_category_by_id(
        db, category_id, int(current_user.id)
    )
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )

    old_name = existing.name
    new_name = category_data.name.strip() if category_data.name else None
    renaming = bool(new_name) and new_name != old_name

    # Check if new name conflicts with another category
    if renaming:
        conflict = await crud_category.get_category_by_name(
            db, new_name, int(current_user.id)
        )
        if conflict and conflict.id != category_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Category with this name already exists",
            )

        # Relocate the backing files so disk paths stay consistent with the name.
        from app.services.storage import UserStorage
        storage_service = UserStorage()
        docs = await _get_local_documents_in_category(
            db, int(current_user.id), category_id
        )
        await _relocate_documents_to_category(
            storage_service, int(current_user.id), docs, category_id, new_name
        )

    updated_category = await crud_category.update_category(
        db, category_id, int(current_user.id), category_data
    )
    if not updated_category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )
    return updated_category


async def _delete_category_documents(
    db: AsyncSession, storage, user_id: int, docs: list[DocumentModel]
) -> None:
    """Delete documents (DB + filesystem) belonging to a category being removed."""
    for doc in docs:
        if doc.file_path:
            try:
                await storage.delete_document(
                    user_id=user_id,
                    file_path=doc.file_path,
                    commit_message=f"Delete {doc.name}",
                    auto_commit=True,
                )
            except Exception:
                logger.warning(
                    "Failed to delete file for document %s", doc.id, exc_info=True
                )
        await db.delete(doc)
    await db.flush()


async def _migrate_category_documents(
    db: AsyncSession,
    storage,
    user_id: int,
    source_category_id: int,
    docs: list[DocumentModel],
    migrate_to_id: Optional[int],
) -> None:
    """Move a category's documents into the migration target before deletion."""
    if migrate_to_id is not None:
        target = await crud_category.get_category_by_id(db, migrate_to_id, user_id)
        if not target:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Target category for migration not found",
            )
    else:
        target = await crud_category.get_or_create_category_by_name(
            db, "General", user_id
        )
    if target.id == source_category_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot migrate a category to itself",
        )
    await _relocate_documents_to_category(
        storage, user_id, docs, target.id, target.name
    )
    await db.flush()


@router.delete("/{category_id}")
async def delete_category(
    category_id: int,
    migrate_to_id: Optional[int] = Query(
        None, description="Category ID to migrate documents to before deletion"
    ),
    delete_documents: bool = Query(
        False, description="Delete the documents in this category instead of migrating"
    ),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Delete a category, migrating or deleting its documents first.

    Documents are migrated to ``migrate_to_id`` (or a "General" category by
    default). Pass ``delete_documents=true`` to delete them instead.
    """
    user_id = int(current_user.id)

    category = await crud_category.get_category_by_id(db, category_id, user_id)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )

    from app.services.storage import UserStorage
    storage_service = UserStorage()

    docs = await _get_local_documents_in_category(db, user_id, category_id)

    if docs:
        if delete_documents:
            await _delete_category_documents(db, storage_service, user_id, docs)
        else:
            await _migrate_category_documents(
                db, storage_service, user_id, category_id, docs, migrate_to_id
            )

    await db.delete(category)
    await db.commit()
    return {"message": "Category deleted successfully"}
