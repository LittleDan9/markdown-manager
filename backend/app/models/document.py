"""Document model for storing markdown documents."""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.base import Base


class Document(Base):
    """Document model for storing user markdown documents."""
    
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    content = Column(Text, nullable=False)
    category = Column(
        String(100), default="General", nullable=False, index=True
    )
    
    # Timestamps
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )
    
    # Foreign key to user
    user_id = Column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    
    # Relationship
    owner = relationship("User", back_populates="documents")

    def __repr__(self):
        return (
            f"<Document(id={self.id}, name='{self.name}', "
            f"category='{self.category}')>"
        )
