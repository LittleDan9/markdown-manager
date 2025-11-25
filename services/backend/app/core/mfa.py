"""MFA (Multi-Factor Authentication) utilities."""
import base64
import io
import json
import secrets
from typing import List

import pyotp
import qrcode
from qrcode.image.pil import PilImage


def generate_totp_secret() -> str:
    """Generate a new TOTP secret."""
    return str(pyotp.random_base32())


def generate_backup_codes(count: int = 8) -> List[str]:
    """Generate backup codes for account recovery."""
    codes = []
    for _ in range(count):
        # Generate 8-digit backup codes
        code = secrets.randbelow(100000000)
        codes.append(f"{code:08d}")
    return codes


def create_qr_code_data_url(
    email: str, secret: str, issuer: str = "Markdown Manager"
) -> str:
    """Create a QR code data URL for TOTP setup."""
    # Create TOTP URI
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(name=email, issuer_name=issuer)

    # Generate QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(provisioning_uri)
    qr.make(fit=True)

    # Create image
    img = qr.make_image(fill_color="black", back_color="white", image_factory=PilImage)

    # Convert to base64 data URL
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    img_str = base64.b64encode(buffer.getvalue()).decode()

    return f"data:image/png;base64,{img_str}"


def verify_totp_code(secret: str, code: str, window: int = 1) -> bool:
    """Verify a TOTP code against the secret."""
    if not secret or not code:
        return False
    try:
        totp = pyotp.TOTP(secret)
        result: bool = bool(totp.verify(code, valid_window=window))
        return result
    except Exception:
        return False


def verify_backup_code(stored_codes: str, provided_code: str) -> tuple[bool, str]:
    """
    Verify a backup code and return updated codes list.

    Returns:
        tuple: (is_valid, updated_codes_json)
    """
    if not stored_codes or not provided_code:
        return False, stored_codes

    try:
        codes = json.loads(stored_codes)
        if provided_code in codes:
            # Remove the used backup code
            codes.remove(provided_code)
            return True, json.dumps(codes)
        return False, stored_codes
    except (json.JSONDecodeError, ValueError):
        return False, stored_codes


def encode_backup_codes(codes: List[str]) -> str:
    """Encode backup codes as JSON string."""
    return json.dumps(codes)


def decode_backup_codes(codes_json: str) -> List[str]:
    """Decode backup codes from JSON string."""
    try:
        return json.loads(codes_json) if codes_json else []
    except json.JSONDecodeError:
        return []
