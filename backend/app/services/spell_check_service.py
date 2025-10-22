"""
Backend Spell Check Service Client - Phase 1 Integration
Created: October 22, 2025 by AI Agent
Purpose: HTTP client for spell-check-service integration
Dependencies: httpx, pydantic
Integration: Main backend service communication layer
"""

import asyncio
import logging
import os
import time
from typing import Dict, List, Optional, Any
import httpx
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class SpellCheckRequest(BaseModel):
    """Request model for spell check service"""
    text: str = Field(..., description="Text to check for spelling")
    customWords: List[str] = Field(default_factory=list, description="Custom words to ignore")
    chunk_offset: int = Field(default=0, description="Offset for chunked processing")
    options: Dict[str, Any] = Field(default_factory=dict, description="Additional options")


class SpellIssue(BaseModel):
    """Individual spelling issue"""
    word: str
    suggestions: List[str]
    position: Dict[str, int]  # {"start": int, "end": int}
    lineNumber: int
    column: int
    type: str = "spelling"
    severity: str = "error"
    confidence: float


class SpellCheckResults(BaseModel):
    """Results from spell check service"""
    spelling: List[SpellIssue]


class SpellCheckResponse(BaseModel):
    """Complete response from spell check service"""
    results: SpellCheckResults
    language: str
    processingTime: int
    statistics: Dict[str, Any]
    service: str
    version: str


class SpellCheckServiceClient:
    """HTTP client for spell-check-service"""
    
    def __init__(self, base_url: str = None):
        if base_url is None:
            base_url = os.getenv("SPELL_CHECK_SERVICE_URL", "http://localhost:8003")
        self.base_url = base_url.rstrip('/')
        self.timeout = 30.0
        self.max_retries = 3
        self.retry_delay = 1.0
        
    async def health_check(self) -> Dict[str, Any]:
        """Check if spell check service is healthy"""
        try:
            headers = {"User-Agent": "markdown-manager-backend/1.0"}
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.base_url}/health", headers=headers)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Spell check service health check failed: {e}")
            raise
    
    async def check_spelling(
        self,
        text: str,
        custom_words: Optional[List[str]] = None,
        chunk_offset: int = 0,
        options: Optional[Dict[str, Any]] = None
    ) -> SpellCheckResponse:
        """
        Check text for spelling errors
        
        Args:
            text: Text to check
            custom_words: List of custom words to ignore
            chunk_offset: Offset for chunked processing
            options: Additional options for spell checking
            
        Returns:
            SpellCheckResponse with spelling issues and metadata
            
        Raises:
            httpx.HTTPError: If service request fails
            ValueError: If response format is invalid
        """
        if not text or not isinstance(text, str):
            raise ValueError("Text must be a non-empty string")
            
        if len(text) > 1048576:  # 1MB limit
            raise ValueError("Text size exceeds maximum limit (1MB)")
        
        request_data = SpellCheckRequest(
            text=text,
            customWords=custom_words or [],
            chunk_offset=chunk_offset,
            options=options or {}
        )
        
        start_time = time.time()
        
        for attempt in range(self.max_retries + 1):
            try:
                headers = {
                    "Content-Type": "application/json",
                    "User-Agent": "markdown-manager-backend/1.0"
                }
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    logger.debug(f"Spell check request - text length: {len(text)}, "
                                f"custom words: {len(custom_words or [])}, attempt: {attempt + 1}")
                    
                    response = await client.post(
                        f"{self.base_url}/check",
                        json=request_data.dict(),
                        headers=headers
                    )
                    
                    response.raise_for_status()
                    response_data = response.json()
                    
                    # Validate response format
                    spell_response = SpellCheckResponse(**response_data)
                    
                    elapsed_time = time.time() - start_time
                    logger.info(f"Spell check completed - found {len(spell_response.results.spelling)} issues "
                                f"in {elapsed_time:.3f}s (service: {spell_response.processingTime}ms)")
                    
                    return spell_response
                    
            except httpx.TimeoutException:
                logger.warning(f"Spell check timeout on attempt {attempt + 1}")
                if attempt == self.max_retries:
                    raise
                await asyncio.sleep(self.retry_delay * (2 ** attempt))
                
            except httpx.HTTPStatusError as e:
                if e.response.status_code >= 500 and attempt < self.max_retries:
                    logger.warning(f"Server error {e.response.status_code} on attempt {attempt + 1}, retrying...")
                    await asyncio.sleep(self.retry_delay * (2 ** attempt))
                    continue
                else:
                    logger.error(f"Spell check HTTP error: {e.response.status_code} - {e.response.text}")
                    raise
                    
            except Exception as e:
                logger.error(f"Spell check request failed on attempt {attempt + 1}: {e}")
                if attempt == self.max_retries:
                    raise
                await asyncio.sleep(self.retry_delay * (2 ** attempt))
    
    async def get_service_info(self) -> Dict[str, Any]:
        """Get information about the spell check service capabilities"""
        try:
            headers = {"User-Agent": "markdown-manager-backend/1.0"}
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.base_url}/info", headers=headers)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to get spell check service info: {e}")
            raise
    
    async def check_document_content(
        self,
        content: str,
        custom_words: Optional[List[str]] = None,
        enable_chunking: bool = True,
        chunk_size: int = 10000
    ) -> List[SpellIssue]:
        """
        Check a document's content for spelling errors with optional chunking
        
        Args:
            content: Document content to check
            custom_words: Custom words to ignore
            enable_chunking: Whether to process in chunks for large documents
            chunk_size: Size of chunks in characters
            
        Returns:
            List of spelling issues across all chunks
        """
        if not enable_chunking or len(content) <= chunk_size:
            # Process as single chunk
            response = await self.check_spelling(content, custom_words)
            return response.results.spelling
        
        # Process in chunks
        all_issues = []
        offset = 0
        
        while offset < len(content):
            chunk_end = min(offset + chunk_size, len(content))
            
            # Try to break at word boundary
            if chunk_end < len(content):
                # Look for a space or newline within the last 200 characters
                boundary_search = content[max(offset, chunk_end - 200):chunk_end]
                last_space = boundary_search.rfind(' ')
                last_newline = boundary_search.rfind('\n')
                
                if last_space > 0 or last_newline > 0:
                    boundary = max(last_space, last_newline)
                    chunk_end = max(offset, chunk_end - 200) + boundary + 1
            
            chunk = content[offset:chunk_end]
            
            if chunk.strip():  # Only process non-empty chunks
                try:
                    response = await self.check_spelling(
                        chunk,
                        custom_words,
                        chunk_offset=offset
                    )
                    all_issues.extend(response.results.spelling)
                except Exception as e:
                    logger.error(f"Error processing chunk at offset {offset}: {e}")
                    # Continue with next chunk rather than failing entirely
            
            offset = chunk_end
        
        return all_issues


# Global client instance
spell_check_client = SpellCheckServiceClient()


# Convenience functions for backward compatibility
async def check_spelling(
    text: str,
    custom_words: Optional[List[str]] = None,
    **kwargs
) -> SpellCheckResponse:
    """Convenience function for spell checking"""
    return await spell_check_client.check_spelling(text, custom_words, **kwargs)


async def check_document_spelling(
    content: str,
    custom_words: Optional[List[str]] = None,
    **kwargs
) -> List[SpellIssue]:
    """Convenience function for document spell checking with chunking"""
    return await spell_check_client.check_document_content(content, custom_words, **kwargs)