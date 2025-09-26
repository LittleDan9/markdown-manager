from __future__ import annotations

"""Icon models for icon service."""
from typing import TYPE_CHECKING, Optional

from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint, Index, JSON
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import BaseModel

if TYPE_CHECKING:
    pass  # No imports needed for now


class IconPack(BaseModel):
    """Icon pack model for grouping icons (AWS, Iconify collections)."""

    __tablename__ = "icon_packs"

    # Pack identification
    name: Mapped[str] = mapped_column(
        String(100), unique=True, index=True, nullable=False,
        comment="Unique identifier like 'awssvg', 'logos'"
    )
    display_name: Mapped[str] = mapped_column(
        String(255), nullable=False,
        comment="Human readable name like 'AWS Services'"
    )
    category: Mapped[str] = mapped_column(
        String(100), index=True, nullable=False,
        comment="Grouping like 'aws', 'iconify'"
    )

    # Pack metadata
    description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True,
        comment="Description of the icon pack"
    )

    # Relationships
    icons: Mapped[list["IconMetadata"]] = relationship(
        "IconMetadata",
        back_populates="pack",
        cascade="all, delete-orphan",
        order_by="IconMetadata.key"
    )


class IconMetadata(BaseModel):
    """Icon metadata model for individual icon information."""

    __tablename__ = "icon_metadata"

    # Pack relationship
    pack_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("icon_packs.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    pack: Mapped["IconPack"] = relationship("IconPack", back_populates="icons")

    # Icon identification
    key: Mapped[str] = mapped_column(
        String(255), nullable=False,
        comment="Icon identifier within pack"
    )

    @hybrid_property
    def full_key(self) -> str:
        """Computed full key as pack.name:key."""
        return f"{self.pack.name}:{self.key}"

    # Search and metadata
    search_terms: Mapped[str] = mapped_column(
        Text, nullable=False, index=True,
        comment="Space-separated search terms for full-text search"
    )
    icon_data: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True,
        comment="JSON for Iconify data or SVG metadata"
    )
    file_path: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True,
        comment="File path for AWS SVG files"
    )

    # Usage tracking
    access_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False,
        comment="Number of times this icon has been accessed"
    )

    # Add unique constraint for pack_id + key combination
    __table_args__ = (
        UniqueConstraint('pack_id', 'key', name='uq_icon_pack_key'),
        Index('ix_icon_metadata_pack_key', 'pack_id', 'key'),
        Index('ix_icon_metadata_access_count', 'access_count'),
    )

    def __repr__(self) -> str:
        """String representation of IconMetadata."""
        return f"<IconMetadata(full_key='{self.full_key}', access_count={self.access_count})>"
