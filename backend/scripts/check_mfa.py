#!/usr/bin/env python3
"""
Quick script to check MFA status for a user
"""
import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.user import User


async def check_user_mfa(email: str) -> None:
    """Check MFA status for a user"""
    async with AsyncSessionLocal() as db:
        try:
            # Query for the user using async session
            result = await db.execute(select(User).where(User.email == email))
            user = result.scalar_one_or_none()

            if not user:
                print(f"❌ User not found: {email}")
                return

            print(f"✅ User found: {user.email}")
            print(f"📧 User ID: {user.id}")
            print(f"� Full Name: {user.full_name}")
            print(f"�🔐 MFA Enabled: {user.mfa_enabled}")
            print(f"🔑 TOTP Secret exists: {bool(user.totp_secret)}")
            if user.totp_secret:
                print(f"🔑 TOTP Secret length: {len(user.totp_secret)}")
                print(f"🔑 TOTP Secret preview: {user.totp_secret[:10]}...")
            print(f"🔒 Has backup codes: {bool(user.backup_codes)}")
            if user.backup_codes:
                print(f"🔒 Backup codes preview: {user.backup_codes[:100]}...")
            print(f"🔑 Password reset token: {user.reset_token}")
            print(f"🔑 Password reset expires: {user.reset_token_expires}")
            print(f"✅ Is active: {user.is_active}")
            print(f"✅ Is verified: {user.is_verified}")
            print(f"📅 Created at: {user.created_at}")
            print(f"📅 Updated at: {user.updated_at}")

        except Exception as e:
            print(f"❌ Error checking user: {e}")
            import traceback

            traceback.print_exc()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python check_mfa.py <email>")
        sys.exit(1)

    email = sys.argv[1]
    asyncio.run(check_user_mfa(email))
