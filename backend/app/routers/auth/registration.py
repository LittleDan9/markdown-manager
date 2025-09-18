"""User registration endpoints."""
from typing import Any
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import user as crud_user
from app.crud import category as crud_category
from app.database import get_db
from app.schemas.user import UserCreate, UserResponse
from app.schemas.category import CategoryCreate
from app.services.storage.user import UserStorage
from app.services.markdown_lint_rule import MarkdownLintRuleService
from app.configs.settings import get_settings
import httpx

router = APIRouter()
logger = logging.getLogger(__name__)


async def _get_recommended_lint_defaults() -> dict:
    """Get recommended default linting rules from the linting service."""
    settings = get_settings()
    lint_service_url = settings.markdown_lint_service_url + "/rules/recommended-defaults"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(lint_service_url)
            response.raise_for_status()
            result = response.json()
            return result.get("rules", {})
    except Exception as e:
        logger.warning(f"Failed to get recommended lint defaults: {e}")
        # Return a basic fallback set of rules
        return {
            "MD009": True,  # no-trailing-spaces
            "MD010": True,  # no-hard-tabs
            "MD022": True,  # blanks-around-headings
            "MD047": True   # single-trailing-newline
        }


async def _initialize_user_defaults(user_id: int, db: AsyncSession) -> bool:
    """Initialize default markdown lint rules for a new user."""
    try:
        recommended_rules = await _get_recommended_lint_defaults()
        await MarkdownLintRuleService.save_user_defaults(
            db,
            user_id,
            recommended_rules,
            "Recommended default rules for new users"
        )
        logger.info(f"Initialized default lint rules for user {user_id}")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize default lint rules for user {user_id}: {e}")
        return False


async def _initialize_user_filesystem(user_id: int, storage_service: UserStorage) -> bool:
    """Initialize filesystem structure for a new user."""
    try:
        filesystem_created = await storage_service.create_user_directory(user_id)
        if not filesystem_created:
            logger.error(f"Failed to create filesystem structure for user {user_id}")
            return False
        return True
    except Exception as e:
        logger.error(f"Exception during filesystem creation for user {user_id}: {e}")
        return False


async def _create_default_categories(
    user_id: int, db: AsyncSession, storage_service: UserStorage
) -> list:
    """Create default categories and initialize their repositories."""
    default_categories = ["General", "Drafts"]
    created_categories = []

    for category_name in default_categories:
        try:
            # Create category in database
            category_data = CategoryCreate(name=category_name)
            category = await crud_category.create_category(db, category_data, user_id)
            created_categories.append(category)

            # Initialize git repository for the category
            repo_initialized = await storage_service.initialize_category_repo(user_id, category_name)
            if not repo_initialized:
                logger.warning(f"Failed to initialize git repository for category {category_name}")

        except Exception as e:
            logger.error(f"Failed to create category {category_name} for user {user_id}: {e}")

    return created_categories


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

    # Create new user in database
    user = await crud_user.create_user(db, user_data)
    storage_service = UserStorage()

    try:
        # Create filesystem structure
        if not await _initialize_user_filesystem(user.id, storage_service):
            await crud_user.delete_user(db, user.id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to initialize user storage",
            )

        # Create default categories
        created_categories = await _create_default_categories(user.id, db, storage_service)

        # Initialize default markdown lint rules
        lint_defaults_initialized = await _initialize_user_defaults(user.id, db)
        if not lint_defaults_initialized:
            logger.warning(f"Failed to initialize lint defaults for user {user.id}, continuing anyway")

        logger.info(f"Successfully registered user {user.id} with {len(created_categories)} categories")
        return user

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Failed to complete user registration for user {user.id}: {e}")
        # Cleanup user from database
        try:
            await crud_user.delete_user(db, user.id)
        except Exception as cleanup_error:
            logger.error(f"Failed to cleanup user {user.id} after registration failure: {cleanup_error}")

        # Cleanup filesystem structure
        try:
            await storage_service.cleanup_user_directory(user.id)
        except Exception as fs_cleanup_error:
            logger.error(f"Failed to cleanup filesystem for user {user.id}: {fs_cleanup_error}")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User registration failed",
        )
