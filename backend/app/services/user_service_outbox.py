"""Enhanced user service with outbox pattern for event publishing."""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_password_hash, verify_password
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from app.services.database_outbox import DatabaseWithOutbox


class UserServiceWithOutbox:
    """User service with outbox event publishing."""

    def __init__(self, db: DatabaseWithOutbox):
        self.db = db

    async def create_user(self, user_create: UserCreate) -> User:
        """Create a new user with outbox event."""
        # Create user in main users table
        hashed_password = get_password_hash(user_create.password)
        db_user = User(
            email=user_create.email,
            hashed_password=hashed_password,
            first_name=user_create.first_name,
            last_name=user_create.last_name,
            display_name=user_create.display_name,
            bio=user_create.bio,
        )
        self.db.add(db_user)
        await self.db.flush()  # Get the ID but don't commit yet

        # Create corresponding identity.users record
        identity_user_id = str(uuid.uuid4())
        insert_identity_query = text("""
            INSERT INTO identity.users (user_id, email, display_name, status, created_at, updated_at)
            VALUES (:user_id, :email, :display_name, :status, :created_at, :updated_at)
        """)

        await self.db.execute(insert_identity_query, {
            "user_id": identity_user_id,
            "email": user_create.email,
            "display_name": user_create.display_name,
            "status": "active",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        })

        # Link the original user to the identity user
        db_user.identity_user_id = identity_user_id

        # Add outbox event
        await self.db.outbox.add_user_created_event(
            user_id=identity_user_id,
            email=user_create.email,
            display_name=user_create.display_name,
            first_name=user_create.first_name,
            last_name=user_create.last_name,
            is_verified=False,
            is_admin=False,
            mfa_enabled=False,
        )

        # Commit transaction (both user and outbox event)
        await self.db.commit()
        await self.db.refresh(db_user)
        return db_user

    async def update_user(
        self, user_id: int, user_update: UserUpdate, changed_fields: Optional[list[str]] = None
    ) -> Optional[User]:
        """Update user with outbox event."""
        # Get the user
        result = await self.db.execute(select(User).where(User.id == user_id))
        db_user = result.scalar_one_or_none()

        if not db_user or not db_user.identity_user_id:
            return None

        # Update user fields
        update_data = user_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_user, field, value)

        # Update identity.users table
        identity_update_query = text("""
            UPDATE identity.users
            SET email = :email,
                display_name = :display_name,
                updated_at = :updated_at
            WHERE user_id = :user_id
        """)

        await self.db.execute(identity_update_query, {
            "user_id": db_user.identity_user_id,
            "email": db_user.email,
            "display_name": db_user.display_name,
            "updated_at": datetime.utcnow(),
        })

        # Add outbox event
        await self.db.outbox.add_user_updated_event(
            user_id=str(db_user.identity_user_id),
            email=db_user.email,
            display_name=db_user.display_name,
            first_name=db_user.first_name,
            last_name=db_user.last_name,
            is_verified=db_user.is_verified,
            is_admin=db_user.is_admin,
            mfa_enabled=db_user.mfa_enabled,
            changed_fields=changed_fields or list(update_data.keys()),
        )

        await self.db.commit()
        await self.db.refresh(db_user)
        return db_user

    async def delete_user(self, user_id: int, deleted_by: str = "", reason: str = "self_deletion") -> bool:
        """Delete user with outbox event."""
        result = await self.db.execute(select(User).where(User.id == user_id))
        db_user = result.scalar_one_or_none()

        if not db_user or not db_user.identity_user_id:
            return False

        # Add outbox event before deleting
        await self.db.outbox.add_user_disabled_event(
            user_id=str(db_user.identity_user_id),
            email=db_user.email,
            display_name=db_user.display_name,
            disabled_by=deleted_by,
            reason=reason,
        )

        # Update identity.users status instead of deleting
        identity_disable_query = text("""
            UPDATE identity.users
            SET status = 'disabled', updated_at = :updated_at
            WHERE user_id = :user_id
        """)

        await self.db.execute(identity_disable_query, {
            "user_id": db_user.identity_user_id,
            "updated_at": datetime.utcnow(),
        })

        # Delete from main users table (cascades to related entities)
        await self.db.delete(db_user)

        await self.db.commit()
        return True

    async def update_password(self, user_id: int, current_password: str, new_password: str) -> bool:
        """Update user password with outbox event."""
        result = await self.db.execute(select(User).where(User.id == user_id))
        db_user = result.scalar_one_or_none()

        if not db_user or not db_user.identity_user_id:
            return False

        # Verify current password
        if not verify_password(current_password, db_user.hashed_password):
            return False

        # Update password
        db_user.hashed_password = get_password_hash(new_password)

        # Add outbox event for password change
        await self.db.outbox.add_user_updated_event(
            user_id=str(db_user.identity_user_id),
            email=db_user.email,
            display_name=db_user.display_name,
            first_name=db_user.first_name,
            last_name=db_user.last_name,
            is_verified=db_user.is_verified,
            is_admin=db_user.is_admin,
            mfa_enabled=db_user.mfa_enabled,
            changed_fields=["password"],
        )

        await self.db.commit()
        return True

    async def enable_mfa(self, user_id: int) -> bool:
        """Enable MFA with outbox event."""
        result = await self.db.execute(select(User).where(User.id == user_id))
        db_user = result.scalar_one_or_none()

        if not db_user or not db_user.totp_secret or not db_user.identity_user_id:
            return False

        db_user.mfa_enabled = True

        # Add outbox event for MFA enable
        await self.db.outbox.add_user_updated_event(
            user_id=str(db_user.identity_user_id),
            email=db_user.email,
            display_name=db_user.display_name,
            first_name=db_user.first_name,
            last_name=db_user.last_name,
            is_verified=db_user.is_verified,
            is_admin=db_user.is_admin,
            mfa_enabled=True,
            changed_fields=["mfa_enabled"],
        )

        await self.db.commit()
        return True

    async def disable_mfa(self, user_id: int) -> bool:
        """Disable MFA with outbox event."""
        result = await self.db.execute(select(User).where(User.id == user_id))
        db_user = result.scalar_one_or_none()

        if not db_user or not db_user.identity_user_id:
            return False

        db_user.mfa_enabled = False
        db_user.totp_secret = None
        db_user.backup_codes = None

        # Add outbox event for MFA disable
        await self.db.outbox.add_user_updated_event(
            user_id=str(db_user.identity_user_id),
            email=db_user.email,
            display_name=db_user.display_name,
            first_name=db_user.first_name,
            last_name=db_user.last_name,
            is_verified=db_user.is_verified,
            is_admin=db_user.is_admin,
            mfa_enabled=False,
            changed_fields=["mfa_enabled", "totp_secret", "backup_codes"],
        )

        await self.db.commit()
        return True

    async def admin_update_user(
        self,
        user_id: int,
        admin_id: str,
        is_active: Optional[bool] = None,
        is_admin: Optional[bool] = None,
        is_verified: Optional[bool] = None,
    ) -> Optional[User]:
        """Admin update user with outbox event."""
        result = await self.db.execute(select(User).where(User.id == user_id))
        db_user = result.scalar_one_or_none()

        if not db_user or not db_user.identity_user_id:
            return None

        changed_fields = []

        if is_active is not None:
            db_user.is_active = is_active
            changed_fields.append("is_active")

            # Update identity status
            status = "active" if is_active else "disabled"
            identity_status_query = text("""
                UPDATE identity.users
                SET status = :status, updated_at = :updated_at
                WHERE user_id = :user_id
            """)

            await self.db.execute(identity_status_query, {
                "user_id": db_user.identity_user_id,
                "status": status,
                "updated_at": datetime.utcnow(),
            })

        if is_admin is not None:
            db_user.is_admin = is_admin
            changed_fields.append("is_admin")

        if is_verified is not None:
            db_user.is_verified = is_verified
            changed_fields.append("is_verified")

        if changed_fields:
            # Add outbox event
            if is_active is False:
                await self.db.outbox.add_user_disabled_event(
                    user_id=str(db_user.identity_user_id),
                    email=db_user.email,
                    display_name=db_user.display_name,
                    disabled_by=admin_id,
                    reason="admin_action",
                )
            else:
                await self.db.outbox.add_user_updated_event(
                    user_id=str(db_user.identity_user_id),
                    email=db_user.email,
                    display_name=db_user.display_name,
                    first_name=db_user.first_name,
                    last_name=db_user.last_name,
                    is_verified=db_user.is_verified,
                    is_admin=db_user.is_admin,
                    mfa_enabled=db_user.mfa_enabled,
                    changed_fields=changed_fields,
                )

        await self.db.commit()
        await self.db.refresh(db_user)
        return db_user