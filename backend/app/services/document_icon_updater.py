"""
Document Icon Update Service
Handles updating icon references in documents when icon pack keys change.
"""
import re
from typing import List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..models.document import Document


class DocumentIconUpdater:
    """Service for updating icon references in documents."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def update_icon_pack_references(
        self,
        old_pack_key: str,
        new_pack_key: str
    ) -> Tuple[int, List[str]]:
        """
        Update all document references from old pack key to new pack key.
        
        Args:
            old_pack_key: The old icon pack key
            new_pack_key: The new icon pack key
            
        Returns:
            Tuple of (updated_count, list_of_updated_document_names)
        """
        if old_pack_key == new_pack_key:
            return 0, []
        
        # Get all documents that potentially contain icon references
        query = select(Document).where(
            Document.content.contains(f"{old_pack_key}:")
        )
        result = await self.db.execute(query)
        documents = result.scalars().all()
        
        updated_documents = []
        updated_count = 0
        
        for doc in documents:
            original_content = doc.content
            updated_content = self._update_icon_references_in_content(
                original_content, old_pack_key, new_pack_key
            )
            
            if updated_content != original_content:
                doc.content = updated_content
                updated_documents.append(doc.name)
                updated_count += 1
        
        if updated_count > 0:
            await self.db.commit()
        
        return updated_count, updated_documents

    async def update_icon_key_references(
        self,
        pack_key: str,
        old_icon_key: str,
        new_icon_key: str
    ) -> Tuple[int, List[str]]:
        """
        Update all document references from old icon key to new icon key within a specific pack.
        
        Args:
            pack_key: The icon pack key
            old_icon_key: The old icon key
            new_icon_key: The new icon key
            
        Returns:
            Tuple of (updated_count, list_of_updated_document_names)
        """
        if old_icon_key == new_icon_key:
            return 0, []
        
        old_full_key = f"{pack_key}:{old_icon_key}"
        new_full_key = f"{pack_key}:{new_icon_key}"
        
        # Get all documents that potentially contain the specific icon reference
        query = select(Document).where(
            Document.content.contains(old_full_key)
        )
        result = await self.db.execute(query)
        documents = result.scalars().all()
        
        updated_documents = []
        updated_count = 0
        
        for doc in documents:
            original_content = doc.content
            updated_content = self._update_icon_key_references_in_content(
                original_content, pack_key, old_icon_key, new_icon_key
            )
            
            if updated_content != original_content:
                doc.content = updated_content
                updated_documents.append(doc.name)
                updated_count += 1
        
        if updated_count > 0:
            await self.db.commit()
        
        return updated_count, updated_documents
    
    def _update_icon_references_in_content(
        self,
        content: str,
        old_pack_key: str,
        new_pack_key: str
    ) -> str:
        """
        Update icon references in document content.
        
        Handles various formats:
        - Direct references: old-pack:icon-name → new-pack:icon-name
        - In mermaid diagrams: <old-pack:icon-name> → <new-pack:icon-name>
        - In markdown links: ![](old-pack:icon-name) → ![](new-pack:icon-name)
        """
        # Pattern to match icon references in various contexts
        patterns = [
            # Direct icon references: pack:icon-name
            (
                rf'\b{re.escape(old_pack_key)}:([a-zA-Z0-9_-]+)',
                rf'{new_pack_key}:\1'
            ),
            # Mermaid diagram references: <pack:icon-name>
            (
                rf'<{re.escape(old_pack_key)}:([a-zA-Z0-9_-]+)>',
                rf'<{new_pack_key}:\1>'
            ),
            # Markdown image references: ![](pack:icon-name)
            (
                rf'!\[([^\]]*)\]\({re.escape(old_pack_key)}:([a-zA-Z0-9_-]+)\)',
                rf'![\1]({new_pack_key}:\2)'
            ),
            # Markdown link references: [text](pack:icon-name)
            (
                rf'\[([^\]]+)\]\({re.escape(old_pack_key)}:([a-zA-Z0-9_-]+)\)',
                rf'[\1]({new_pack_key}:\2)'
            )
        ]
        
        updated_content = content
        for pattern, replacement in patterns:
            updated_content = re.sub(pattern, replacement, updated_content)
        
        return updated_content
    
    def _update_icon_key_references_in_content(
        self,
        content: str,
        pack_key: str,
        old_icon_key: str,
        new_icon_key: str
    ) -> str:
        """
        Update specific icon key references in document content.
        
        Handles various formats:
        - Direct references: pack:old-icon → pack:new-icon
        - In mermaid diagrams: <pack:old-icon> → <pack:new-icon>
        - In markdown links: ![](pack:old-icon) → ![](pack:new-icon)
        """
        old_full_key = f"{pack_key}:{old_icon_key}"
        new_full_key = f"{pack_key}:{new_icon_key}"
        
        # Pattern to match specific icon references in various contexts
        patterns = [
            # Direct icon references: pack:icon-name
            (
                rf'\b{re.escape(old_full_key)}\b',
                new_full_key
            ),
            # Mermaid diagram references: <pack:icon-name>
            (
                rf'<{re.escape(old_full_key)}>',
                f'<{new_full_key}>'
            ),
            # Markdown image references: ![](pack:icon-name)
            (
                rf'!\[([^\]]*)\]\({re.escape(old_full_key)}\)',
                rf'![\1]({new_full_key})'
            ),
            # Markdown link references: [text](pack:icon-name)
            (
                rf'\[([^\]]+)\]\({re.escape(old_full_key)}\)',
                rf'[\1]({new_full_key})'
            )
        ]
        
        updated_content = content
        for pattern, replacement in patterns:
            updated_content = re.sub(pattern, replacement, updated_content)
        
        return updated_content

    async def find_documents_using_pack(self, pack_key: str) -> List[Tuple[int, str]]:
        """
        Find all documents that reference a specific icon pack.
        
        Args:
            pack_key: The icon pack key to search for
            
        Returns:
            List of tuples (document_id, document_name)
        """
        query = select(Document.id, Document.name).where(
            Document.content.contains(f"{pack_key}:")
        )
        result = await self.db.execute(query)
        return [(row[0], row[1]) for row in result.fetchall()]
    
    async def find_documents_using_icon(self, pack_key: str, icon_key: str) -> List[Tuple[int, str]]:
        """
        Find all documents that reference a specific icon.
        
        Args:
            pack_key: The icon pack key
            icon_key: The icon key
            
        Returns:
            List of tuples (document_id, document_name)
        """
        full_key = f"{pack_key}:{icon_key}"
        query = select(Document.id, Document.name).where(
            Document.content.contains(full_key)
        )
        result = await self.db.execute(query)
        return [(row[0], row[1]) for row in result.fetchall()]
    
    async def get_icon_usage_stats(self, pack_key: str) -> dict:
        """
        Get statistics about icon pack usage in documents.
        
        Args:
            pack_key: The icon pack key to analyze
            
        Returns:
            Dictionary with usage statistics
        """
        documents_with_pack = await self.find_documents_using_pack(pack_key)
        
        # Count total icon references
        query = select(Document.content).where(
            Document.content.contains(f"{pack_key}:")
        )
        result = await self.db.execute(query)
        contents = result.scalars().all()
        
        total_references = 0
        unique_icons = set()
        
        for content in contents:
            # Find all icon references in this document
            pattern = rf'{re.escape(pack_key)}:([a-zA-Z0-9_-]+)'
            matches = re.findall(pattern, content)
            total_references += len(matches)
            unique_icons.update(matches)
        
        return {
            "pack_key": pack_key,
            "documents_count": len(documents_with_pack),
            "total_references": total_references,
            "unique_icons_used": len(unique_icons),
            "icon_names": sorted(list(unique_icons))
        }
