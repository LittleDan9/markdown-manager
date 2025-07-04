"""MFA (Multi-Factor Authentication) API routes."""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user, verify_password
from app.core.mfa import (
    create_qr_code_data_url,
    decode_backup_codes,
    encode_backup_codes,
    generate_backup_codes,
    generate_totp_secret,
    verify_backup_code,
    verify_totp_code,
)
from app.crud import user as crud_user
from app.database import get_db
from app.models.user import User
from app.schemas.user import (
    MFASetupResponse,
    MFAToggleRequest,
    MFAVerifyRequest,
)

router = APIRouter()


@router.post("/setup", response_model=MFASetupResponse)
async def setup_mfa(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Initialize MFA setup for the current user."""
    # Generate new TOTP secret and backup codes
    secret = generate_totp_secret()
    backup_codes = generate_backup_codes()
    
    # Store in database (not enabled yet)
    success = await crud_user.setup_mfa(
        db, current_user.id, secret, encode_backup_codes(backup_codes)
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to setup MFA",
        )
    
    # Generate QR code
    qr_code_data_url = create_qr_code_data_url(current_user.email, secret)
    
    return MFASetupResponse(
        qr_code_data_url=qr_code_data_url,
        secret=secret,
        backup_codes=backup_codes,
    )


@router.post("/verify")
async def verify_mfa_setup(
    verify_data: MFAVerifyRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Verify TOTP code during MFA setup."""
    if not current_user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA setup not initiated",
        )
    
    # Verify the TOTP code
    if not verify_totp_code(current_user.totp_secret, verify_data.totp_code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid TOTP code",
        )
    
    return {"message": "TOTP code verified successfully"}


@router.post("/enable")
async def enable_mfa(
    toggle_data: MFAToggleRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Enable MFA for the current user."""
    # Verify current password
    if not verify_password(
        toggle_data.current_password, current_user.hashed_password
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid current password",
        )
    
    # Check if MFA is set up
    if not current_user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA setup not completed",
        )
    
    # Verify TOTP code
    if not verify_totp_code(current_user.totp_secret, toggle_data.totp_code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid TOTP code",
        )
    
    # Enable MFA
    success = await crud_user.enable_mfa(db, current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to enable MFA",
        )
    
    return {"message": "MFA enabled successfully"}


@router.post("/disable")
async def disable_mfa(
    toggle_data: MFAToggleRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Disable MFA for the current user."""
    # Verify current password
    if not verify_password(
        toggle_data.current_password, current_user.hashed_password
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid current password",
        )
    
    # Check if MFA is enabled
    if not current_user.mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is not enabled",
        )
    
    # Verify TOTP code or backup code
    totp_valid = verify_totp_code(
        current_user.totp_secret, toggle_data.totp_code
    )
    backup_valid = False
    
    if not totp_valid and current_user.backup_codes:
        backup_valid, _ = verify_backup_code(
            current_user.backup_codes, toggle_data.totp_code
        )
    
    if not totp_valid and not backup_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid TOTP code or backup code",
        )
    
    # Disable MFA
    success = await crud_user.disable_mfa(db, current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to disable MFA",
        )
    
    return {"message": "MFA disabled successfully"}


@router.get("/backup-codes")
async def get_backup_codes(
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Get remaining backup codes for the current user."""
    if not current_user.mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is not enabled",
        )
    
    backup_codes = decode_backup_codes(current_user.backup_codes or "")
    return {"backup_codes": backup_codes}


@router.post("/regenerate-backup-codes")
async def regenerate_backup_codes(
    verify_data: MFAVerifyRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Regenerate backup codes for the current user."""
    if not current_user.mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is not enabled",
        )
    
    # Verify TOTP code
    if not verify_totp_code(current_user.totp_secret, verify_data.totp_code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid TOTP code",
        )
    
    # Generate new backup codes
    new_backup_codes = generate_backup_codes()
    success = await crud_user.update_backup_codes(
        db, current_user.id, encode_backup_codes(new_backup_codes)
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to regenerate backup codes",
        )
    
    return {"backup_codes": new_backup_codes}
