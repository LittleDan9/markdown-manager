"""
Document Icon Update Service
Handles updating icon references in documents when icon pack keys change.
"""
import re
from typing import List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..models.document import Document
from ..services.storage.user import UserStorage


class DocumentIconUpdater:
    """Service for updating icon references in documents."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.storage_service = UserStorage()

    async def update_icon_pack_references(
        self,
        old_pack_key: str,
        new_pack_key: str,
        user_id: int
    ) -> Tuple[int, List[str]]:
        """
        Update all document references from old pack key to new pack key.

        Args:
            old_pack_key: The old icon pack key
            new_pack_key: The new icon pack key
            user_id: The user ID to limit document updates to

        Returns:
            Tuple of (updated_count, list_of_updated_document_names)
        """
        if old_pack_key == new_pack_key:
            return 0, []

        # Get all documents for the user
        query = select(Document).where(Document.user_id == user_id)
        result = await self.db.execute(query)
        documents = result.scalars().all()

        updated_documents = []
        updated_count = 0

        for doc in documents:
            # Load content from filesystem
            original_content = ""
            if doc.file_path:
                try:
                    content = await self.storage_service.read_document(
                        user_id=user_id,
                        file_path=doc.file_path
                    )
                    original_content = content or ""
                except Exception as e:
                    print(f"Failed to load content for document {doc.id}: {e}")
                    continue
            else:
                # Legacy document without file_path
                original_content = getattr(doc, 'content', "")

            # Check if this document contains the old pack key
            if f"{old_pack_key}:" not in original_content:
                continue

            updated_content = self._update_icon_references_in_content(
                original_content, old_pack_key, new_pack_key
            )

            if updated_content != original_content:
                # Write updated content back to filesystem
                if doc.file_path:
                    try:
                        await self.storage_service.write_document(
                            user_id=user_id,
                            file_path=doc.file_path,
                            content=updated_content,
                            commit_message=f"Update icon pack references: {old_pack_key} -> {new_pack_key}",
                            auto_commit=True
                        )
                        updated_documents.append(doc.name)
                        updated_count += 1
                    except Exception as e:
                        print(f"Failed to write updated content for document {doc.id}: {e}")
                        # Fallback to database update for legacy documents
                        doc.content = updated_content
                        updated_documents.append(doc.name)
                        updated_count += 1
                else:
                    # Legacy document without file_path
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
        new_icon_key: str,
        user_id: int
    ) -> Tuple[int, List[str]]:
        """
        Update all document references from old icon key to new icon key within a specific pack.

        Args:
            pack_key: The icon pack key
            old_icon_key: The old icon key
            new_icon_key: The new icon key
            user_id: The user ID to limit document updates to

        Returns:
            Tuple of (updated_count, list_of_updated_document_names)
        """
        if old_icon_key == new_icon_key:
            return 0, []

        old_full_key = f"{pack_key}:{old_icon_key}"

        # Get all documents for the user
        query = select(Document).where(Document.user_id == user_id)
        result = await self.db.execute(query)
        documents = result.scalars().all()

        updated_documents = []
        updated_count = 0

        for doc in documents:
            # Load content from filesystem
            original_content = ""
            if doc.file_path:
                try:
                    content = await self.storage_service.read_document(
                        user_id=user_id,
                        file_path=doc.file_path
                    )
                    original_content = content or ""
                except Exception as e:
                    print(f"Failed to load content for document {doc.id}: {e}")
                    continue
            else:
                # Legacy document without file_path
                original_content = getattr(doc, 'content', "")

            # Check if this document contains the old icon key
            if old_full_key not in original_content:
                continue

            updated_content = self._update_icon_key_references_in_content(
                original_content, pack_key, old_icon_key, new_icon_key
            )

            if updated_content != original_content:
                # Write updated content back to filesystem
                if doc.file_path:
                    try:
                        await self.storage_service.write_document(
                            user_id=user_id,
                            file_path=doc.file_path,
                            content=updated_content,
                            commit_message=f"Update icon key references: {old_icon_key} -> {new_icon_key}",
                            auto_commit=True
                        )
                        updated_documents.append(doc.name)
                        updated_count += 1
                    except Exception as e:
                        print(f"Failed to write updated content for document {doc.id}: {e}")
                        # Fallback to database update for legacy documents
                        doc.content = updated_content
                        updated_documents.append(doc.name)
                        updated_count += 1
                else:
                    # Legacy document without file_path
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

    async def _load_document_content(self, document: Document, user_id: int) -> str:
        """
        Helper method to load document content from filesystem.

        Args:
            document: Document model instance
            user_id: User ID for filesystem access

        Returns:
            Document content as string, empty string if failed to load
        """
        if document.file_path:
            try:
                content = await self.storage_service.read_document(
                    user_id=user_id,
                    file_path=document.file_path
                )
                return content or ""
            except Exception as e:
                print(f"Failed to load content for document {document.id}: {e}")
                return ""
        else:
            # Legacy document without file_path
            return getattr(document, 'content', "")

    async def find_documents_using_pack(self, pack_key: str, user_id: int) -> List[Tuple[int, str]]:
        """
        Find all documents that reference a specific icon pack by scanning filesystem content.

        Args:
            pack_key: The icon pack key to search for
            user_id: The user ID to limit search to

        Returns:
            List of tuples (document_id, document_name)
        """
        # Get all documents for the user
        query = select(Document).where(Document.user_id == user_id)
        result = await self.db.execute(query)
        documents = result.scalars().all()

        found_documents = []
        search_pattern = f"{pack_key}:"

        for doc in documents:
            # Load content from filesystem
            content = await self._load_document_content(doc, user_id)
            if search_pattern in content:
                found_documents.append((doc.id, doc.name))

        return found_documents

    async def find_documents_using_icon(self, pack_key: str, icon_key: str, user_id: int) -> List[Tuple[int, str]]:
        """
        Find all documents that reference a specific icon by scanning filesystem content.

        Args:
            pack_key: The icon pack key
            icon_key: The icon key
            user_id: The user ID to limit search to

        Returns:
            List of tuples (document_id, document_name)
        """
        # Get all documents for the user
        query = select(Document).where(Document.user_id == user_id)
        result = await self.db.execute(query)
        documents = result.scalars().all()

        found_documents = []
        full_key = f"{pack_key}:{icon_key}"

        for doc in documents:
            # Load content from filesystem
            content = await self._load_document_content(doc, user_id)
            if full_key in content:
                found_documents.append((doc.id, doc.name))

        return found_documents

    async def get_icon_usage_stats(self, pack_key: str, user_id: int) -> dict:
        """
        Get statistics about icon pack usage in documents by scanning filesystem content.

        Args:
            pack_key: The icon pack key to analyze
            user_id: The user ID to limit analysis to

        Returns:
            Dictionary with usage statistics
        """
        # Get all documents for the user
        query = select(Document).where(Document.user_id == user_id)
        result = await self.db.execute(query)
        documents = result.scalars().all()

        documents_with_pack = []
        total_references = 0
        unique_icons = set()
        search_pattern = f"{pack_key}:"

        # Regex pattern to find icon references
        pattern = rf'{re.escape(pack_key)}:([a-zA-Z0-9_-]+)'

        for doc in documents:
            # Load content from filesystem
            content = await self._load_document_content(doc, user_id)

            if search_pattern in content:
                documents_with_pack.append((doc.id, doc.name))

                # Find all icon references in this document
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
