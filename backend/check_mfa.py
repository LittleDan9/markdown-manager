#!/usr/bin/env python3
"""
Quick script to check MFA status for a user
"""
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models.user import User


def check_user_mfa(email):
    """Check MFA status for a user"""
    db = SessionLocal()
    
    try:
        user = db.query(User).filter(User.email == email).first()
        
        if not user:
            print(f"❌ User not found: {email}")
            return
        
        print(f"✅ User found: {user.email}")
        print(f"📧 User ID: {user.id}")
        print(f"🔐 MFA Enabled: {user.mfa_enabled}")
        print(f"🔑 MFA Secret exists: {bool(user.mfa_secret)}")
        if user.mfa_secret:
            print(f"🔑 MFA Secret length: {len(user.mfa_secret)}")
            print(f"🔑 MFA Secret preview: {user.mfa_secret[:10]}...")
        print(f"🔒 Has backup codes: {bool(user.backup_codes)}")
        if user.backup_codes:
            print(f"🔒 Backup codes count: {len(user.backup_codes)}")
            backup_preview = (user.backup_codes[:2] 
                            if len(user.backup_codes) >= 2 
                            else user.backup_codes)
            print(f"🔒 Backup codes preview: {backup_preview}")
        print(f"📅 Created at: {user.created_at}")
        print(f"📅 Updated at: {user.updated_at}")
        
    except Exception as e:
        print(f"❌ Error checking user: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python check_mfa.py <email>")
        sys.exit(1)
    
    email = sys.argv[1]
    check_user_mfa(email)
