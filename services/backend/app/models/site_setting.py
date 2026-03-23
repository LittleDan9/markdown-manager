"""SiteSetting model — admin-managed key/value store for site-wide configuration."""
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class SiteSetting(BaseModel):
    """
    Site-wide configuration stored in the database.

    Keys are strings like "llm.model", "llm.url", "embeddings.model".
    Values are JSON-serialisable strings. Admin-only read/write.
    """

    __tablename__ = "site_settings"

    key: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    value: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
