import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.models.base import Base


class DocumentRecovery(Base):  # type: ignore[misc]
    __tablename__ = "document_recovery"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    document_id = Column(String, nullable=True)  # original doc id if exists
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    recovered_at = Column(DateTime, default=datetime.datetime.utcnow)
    collision = Column(Boolean, default=False)

    user = relationship("User", back_populates="recovered_documents")
