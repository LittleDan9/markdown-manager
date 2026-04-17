"""UserApiKey model — per-user encrypted API key storage for third-party LLM providers."""
from __future__ import annotations

import base64
import logging

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes
from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel

logger = logging.getLogger(__name__)

# Purpose-specific context so the derived key is independent of the JWT
# signing key even though they share the same root secret.  An attacker
# who obtains the JWT signing key cannot use it to decrypt API keys
# without also knowing this derivation context.
_HKDF_INFO = b"markdown-manager:user-api-key-encryption:v1"
_HKDF_SALT = b"mm-api-key-salt-v1"   # static salt (acceptable — HKDF info provides domain sep)


def _derive_fernet_key(secret: str) -> bytes:
    """Derive a 32-byte Fernet key from an arbitrary-length secret via HKDF-SHA256.

    Uses purpose-specific ``info`` and ``salt`` parameters so the derived key
    is cryptographically independent of any other key derived from the same
    root secret (e.g. the JWT signing key).
    """
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=_HKDF_SALT,
        info=_HKDF_INFO,
    )
    derived = hkdf.derive(secret.encode())
    return base64.urlsafe_b64encode(derived)


def encrypt_api_key(plain_key: str, secret: str) -> str:
    """Encrypt an API key string using Fernet symmetric encryption."""
    f = Fernet(_derive_fernet_key(secret))
    return f.encrypt(plain_key.encode()).decode()


def decrypt_api_key(encrypted_key: str, secret: str) -> str:
    """Decrypt a Fernet-encrypted API key string."""
    f = Fernet(_derive_fernet_key(secret))
    return f.decrypt(encrypted_key.encode()).decode()


class UserApiKey(BaseModel):
    """Per-user API key for a third-party LLM provider.

    Keys are stored encrypted at rest using Fernet.  The ``provider`` field
    identifies which service the key is for (e.g. ``"openai"``, ``"xai"``).
    """

    __tablename__ = "user_api_keys"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    api_key_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    label: Mapped[str | None] = mapped_column(String(128), nullable=True)
    base_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    preferred_model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    org_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
