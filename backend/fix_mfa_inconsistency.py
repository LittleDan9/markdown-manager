#!/usr/bin/env python3
"""
Script to fix inconsistent MFA state for users
"""
import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import AsyncSessionLocal
from app.models.user import User
from sqlalchemy import select


async def fix_mfa_inconsistency(email: str):
    """Fix MFA inconsistency for a user"""
    async with AsyncSessionLocal() as db:
        try:
            # Query for the user
            result = await db.execute(
                select(User).where(User.email == email)
            )
            user = result.scalar_one_or_none()

            if not user:
                print(f"❌ User not found: {email}")
                return

            print(f"✅ User found: {user.email}")
            print(f"Current state:")
            print(f"  - MFA Enabled: {user.mfa_enabled}")
            print(f"  - TOTP Secret exists: {bool(user.totp_secret)}")
            print(f"  - Has backup codes: {bool(user.backup_codes)}")

            # If MFA is disabled but secrets exist, clear them
            if not user.mfa_enabled and (user.totp_secret or user.backup_codes):
                print(f"\n🔧 Fixing inconsistent state...")
                print(f"  - Clearing TOTP secret")
                print(f"  - Clearing backup codes")

                user.totp_secret = None
                user.backup_codes = None
                await db.commit()

                print(f"✅ Fixed inconsistent MFA state for {email}")
            else:
                print(f"✅ MFA state is consistent for {email}")

        except Exception as e:
            print(f"❌ Error fixing user: {e}")
            import traceback
            traceback.print_exc()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python fix_mfa_inconsistency.py <email>")
        sys.exit(1)

    email = sys.argv[1]
    asyncio.run(fix_mfa_inconsistency(email))
