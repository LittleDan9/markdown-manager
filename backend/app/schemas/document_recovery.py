from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class DocumentRecoveryBase(BaseModel):
    document_id: Optional[str]
    name: str
    category: str
    content: str
    recovered_at: Optional[datetime]
    collision: bool = False


class DocumentRecoveryCreate(DocumentRecoveryBase):
    user_id: int


class DocumentRecovery(DocumentRecoveryBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True
