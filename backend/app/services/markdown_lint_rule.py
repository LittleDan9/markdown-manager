"""CRUD operations for markdown lint rules."""
from typing import Dict, Any, Optional, List

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, delete

from app.models import MarkdownLintRule


class MarkdownLintRuleService:
    """Service for managing markdown lint rule configurations."""

    @staticmethod
    async def get_user_defaults(db: AsyncSession, user_id: int) -> Optional[Dict[str, Any]]:
        """
        Get user's default markdown lint rules.
        
        Args:
            db: Database session
            user_id: User ID
            
        Returns:
            User's default rules or None if not found
        """
        result = await db.execute(
            select(MarkdownLintRule).where(
                and_(
                    MarkdownLintRule.user_id == user_id,
                    MarkdownLintRule.scope == "user",
                    MarkdownLintRule.is_active.is_(True)
                )
            )
        )
        rule = result.scalar_one_or_none()
        return rule.rules if rule else None

    @staticmethod
    async def save_user_defaults(
        db: AsyncSession, user_id: int, rules: Dict[str, Any], description: Optional[str] = None
    ) -> MarkdownLintRule:
        """
        Save or update user's default markdown lint rules.
        
        Args:
            db: Database session
            user_id: User ID
            rules: Rule configuration dictionary
            description: Optional description
            
        Returns:
            Created or updated MarkdownLintRule instance
            
        Raises:
            ValueError: If rules validation fails
        """
        # Validate rules format
        if not isinstance(rules, dict):
            raise ValueError("Rules must be a dictionary")
        
        # Check if user defaults already exist
        existing = await db.execute(
            select(MarkdownLintRule).where(
                and_(
                    MarkdownLintRule.user_id == user_id,
                    MarkdownLintRule.scope == "user"
                )
            )
        )
        existing_rule = existing.scalar_one_or_none()
        
        if existing_rule:
            # Update existing rules
            existing_rule.rules = rules
            existing_rule.description = description or existing_rule.description
            existing_rule.is_active = True
            await db.commit()
            await db.refresh(existing_rule)
            return existing_rule
        else:
            # Create new rules
            new_rule = MarkdownLintRule.create_user_defaults(
                user_id=user_id,
                rules=rules,
                description=description
            )
            db.add(new_rule)
            await db.commit()
            await db.refresh(new_rule)
            return new_rule

    @staticmethod
    async def get_category_rules(
        db: AsyncSession, user_id: int, category_id: int
    ) -> Optional[Dict[str, Any]]:
        """
        Get category-specific markdown lint rules.
        
        Args:
            db: Database session
            user_id: User ID
            category_id: Category ID
            
        Returns:
            Category rules or None if not found
        """
        result = await db.execute(
            select(MarkdownLintRule).where(
                and_(
                    MarkdownLintRule.user_id == user_id,
                    MarkdownLintRule.scope == "category",
                    MarkdownLintRule.scope_id == category_id,
                    MarkdownLintRule.is_active.is_(True)
                )
            )
        )
        rule = result.scalar_one_or_none()
        return rule.rules if rule else None

    @staticmethod
    async def save_category_rules(
        db: AsyncSession,
        user_id: int,
        category_id: int,
        rules: Dict[str, Any],
        description: Optional[str] = None
    ) -> MarkdownLintRule:
        """
        Save or update category-specific markdown lint rules.
        
        Args:
            db: Database session
            user_id: User ID
            category_id: Category ID
            rules: Rule configuration dictionary
            description: Optional description
            
        Returns:
            Created or updated MarkdownLintRule instance
        """
        # Validate rules format
        if not isinstance(rules, dict):
            raise ValueError("Rules must be a dictionary")
        
        # Check if category rules already exist
        existing = await db.execute(
            select(MarkdownLintRule).where(
                and_(
                    MarkdownLintRule.user_id == user_id,
                    MarkdownLintRule.scope == "category",
                    MarkdownLintRule.scope_id == category_id
                )
            )
        )
        existing_rule = existing.scalar_one_or_none()
        
        if existing_rule:
            # Update existing rules
            existing_rule.rules = rules
            existing_rule.description = description or existing_rule.description
            existing_rule.is_active = True
            await db.commit()
            await db.refresh(existing_rule)
            return existing_rule
        else:
            # Create new rules
            new_rule = MarkdownLintRule.create_category_rules(
                user_id=user_id,
                category_id=category_id,
                rules=rules,
                description=description
            )
            db.add(new_rule)
            await db.commit()
            await db.refresh(new_rule)
            return new_rule

    @staticmethod
    async def get_folder_rules(
        db: AsyncSession, user_id: int, folder_path: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get folder-specific markdown lint rules.
        
        Args:
            db: Database session
            user_id: User ID
            folder_path: Folder path
            
        Returns:
            Folder rules or None if not found
        """
        result = await db.execute(
            select(MarkdownLintRule).where(
                and_(
                    MarkdownLintRule.user_id == user_id,
                    MarkdownLintRule.scope == "folder",
                    MarkdownLintRule.scope_value == folder_path,
                    MarkdownLintRule.is_active.is_(True)
                )
            )
        )
        rule = result.scalar_one_or_none()
        return rule.rules if rule else None

    @staticmethod
    async def save_folder_rules(
        db: AsyncSession,
        user_id: int,
        folder_path: str,
        rules: Dict[str, Any],
        description: Optional[str] = None
    ) -> MarkdownLintRule:
        """
        Save or update folder-specific markdown lint rules.
        
        Args:
            db: Database session
            user_id: User ID
            folder_path: Folder path
            rules: Rule configuration dictionary
            description: Optional description
            
        Returns:
            Created or updated MarkdownLintRule instance
        """
        # Validate rules format
        if not isinstance(rules, dict):
            raise ValueError("Rules must be a dictionary")
        
        # Check if folder rules already exist
        existing = await db.execute(
            select(MarkdownLintRule).where(
                and_(
                    MarkdownLintRule.user_id == user_id,
                    MarkdownLintRule.scope == "folder",
                    MarkdownLintRule.scope_value == folder_path
                )
            )
        )
        existing_rule = existing.scalar_one_or_none()
        
        if existing_rule:
            # Update existing rules
            existing_rule.rules = rules
            existing_rule.description = description or existing_rule.description
            existing_rule.is_active = True
            await db.commit()
            await db.refresh(existing_rule)
            return existing_rule
        else:
            # Create new rules
            new_rule = MarkdownLintRule.create_folder_rules(
                user_id=user_id,
                folder_path=folder_path,
                rules=rules,
                description=description
            )
            db.add(new_rule)
            await db.commit()
            await db.refresh(new_rule)
            return new_rule

    @staticmethod
    async def delete_user_defaults(db: AsyncSession, user_id: int) -> bool:
        """
        Delete user's default markdown lint rules.
        
        Args:
            db: Database session
            user_id: User ID
            
        Returns:
            True if rules were deleted, False if not found
        """
        result = await db.execute(
            delete(MarkdownLintRule).where(
                and_(
                    MarkdownLintRule.user_id == user_id,
                    MarkdownLintRule.scope == "user"
                )
            )
        )
        await db.commit()
        return result.rowcount > 0

    @staticmethod
    async def delete_category_rules(db: AsyncSession, user_id: int, category_id: int) -> bool:
        """
        Delete category-specific markdown lint rules.
        
        Args:
            db: Database session
            user_id: User ID
            category_id: Category ID
            
        Returns:
            True if rules were deleted, False if not found
        """
        result = await db.execute(
            delete(MarkdownLintRule).where(
                and_(
                    MarkdownLintRule.user_id == user_id,
                    MarkdownLintRule.scope == "category",
                    MarkdownLintRule.scope_id == category_id
                )
            )
        )
        await db.commit()
        return result.rowcount > 0

    @staticmethod
    async def delete_folder_rules(db: AsyncSession, user_id: int, folder_path: str) -> bool:
        """
        Delete folder-specific markdown lint rules.
        
        Args:
            db: Database session
            user_id: User ID
            folder_path: Folder path
            
        Returns:
            True if rules were deleted, False if not found
        """
        result = await db.execute(
            delete(MarkdownLintRule).where(
                and_(
                    MarkdownLintRule.user_id == user_id,
                    MarkdownLintRule.scope == "folder",
                    MarkdownLintRule.scope_value == folder_path
                )
            )
        )
        await db.commit()
        return result.rowcount > 0

    @staticmethod
    async def get_hierarchical_rules(
        db: AsyncSession, user_id: int, category_id: Optional[int] = None, folder_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get merged rules following hierarchy: folder > category > user defaults.
        
        Args:
            db: Database session
            user_id: User ID
            category_id: Optional category ID
            folder_path: Optional folder path
            
        Returns:
            Merged rule configuration dictionary
        """
        merged_rules = {}
        
        # Start with user defaults
        user_defaults = await MarkdownLintRuleService.get_user_defaults(db, user_id)
        if user_defaults:
            merged_rules.update(user_defaults)
        
        # Apply category rules if available
        if category_id:
            category_rules = await MarkdownLintRuleService.get_category_rules(db, user_id, category_id)
            if category_rules:
                merged_rules.update(category_rules)
        
        # Apply folder rules if available (highest priority)
        if folder_path:
            folder_rules = await MarkdownLintRuleService.get_folder_rules(db, user_id, folder_path)
            if folder_rules:
                merged_rules.update(folder_rules)
        
        return merged_rules

    @staticmethod
    async def list_user_rules(db: AsyncSession, user_id: int) -> List[MarkdownLintRule]:
        """
        List all markdown lint rules for a user.
        
        Args:
            db: Database session
            user_id: User ID
            
        Returns:
            List of MarkdownLintRule instances
        """
        result = await db.execute(
            select(MarkdownLintRule).where(
                and_(
                    MarkdownLintRule.user_id == user_id,
                    MarkdownLintRule.is_active.is_(True)
                )
            ).order_by(MarkdownLintRule.scope, MarkdownLintRule.scope_id, MarkdownLintRule.scope_value)
        )
        return list(result.scalars().all())
