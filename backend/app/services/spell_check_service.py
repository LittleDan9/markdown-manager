"""
Backend Spell Check Service Client - Phase 3 Integration
Created: October 22, 2025 by AI Agent
Purpose: HTTP client for spell-check-service integration with advanced features
Dependencies: httpx, pydantic
Integration: Main backend service communication layer with custom dictionaries
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
    """Request model for spell check service - Phase 3 Enhanced"""
    text: str = Field(..., description="Text to check for spelling")
    customWords: List[str] = Field(default_factory=list, description="Custom words to ignore")
    chunk_offset: int = Field(default=0, description="Offset for chunked processing")
    options: Dict[str, Any] = Field(default_factory=dict, description="Additional options")
    language: Optional[str] = Field(default=None, description="Target language")
    enableGrammar: bool = Field(default=True, description="Enable grammar checking")
    enableStyle: bool = Field(default=True, description="Enable style analysis")
    enableLanguageDetection: bool = Field(default=True, description="Enable language detection")
    enableContextualSuggestions: bool = Field(default=True, description="Enable contextual suggestions")
    styleGuide: Optional[str] = Field(default=None, description="Style guide to apply")
    authToken: Optional[str] = Field(default=None, description="Authentication token")
    userId: Optional[str] = Field(default=None, description="User ID")
    categoryId: Optional[str] = Field(default=None, description="Category ID")
    folderPath: Optional[str] = Field(default=None, description="Folder path")


class SpellIssue(BaseModel):
    """Individual spelling issue - Phase 3 Enhanced"""
    word: str
    suggestions: List[str]
    position: Dict[str, int]  # {"start": int, "end": int}
    lineNumber: int
    column: int
    type: str = "spelling"
    severity: str = "error"
    confidence: float
    enhanced: Optional[bool] = Field(default=None, description="Enhanced with contextual analysis")
    contextAnalysis: Optional[Dict[str, Any]] = Field(default=None, description="Context analysis results")


class GrammarIssue(BaseModel):
    """Individual grammar issue"""
    message: str
    suggestion: str
    position: Dict[str, int]
    type: str = "grammar"
    severity: str = "warning"
    rule: str


class StyleIssue(BaseModel):
    """Individual style issue"""
    message: str
    suggestion: str
    position: Dict[str, int]
    type: str = "style"
    severity: str
    rule: str
    category: Optional[str] = None
    styleGuide: Optional[str] = None


class SpellCheckResults(BaseModel):
    """Results from spell check service - Phase 3 Enhanced"""
    spelling: List[SpellIssue]
    grammar: List[GrammarIssue] = Field(default_factory=list)
    style: List[StyleIssue] = Field(default_factory=list)


class LanguageAlternative(BaseModel):
    """Language detection alternative"""
    language: str
    confidence: float


class LanguageDetection(BaseModel):
    """Language detection results - matches actual service response"""
    language: str
    confidence: float
    reason: str
    alternatives: List[LanguageAlternative]
    textLength: int
    detectionMethods: List[str]


class ReadabilityActual(BaseModel):
    """Actual readability structure returned by service"""
    score: int
    gradeLevel: float
    metrics: Dict[str, Any]
    interpretation: str


class SupportedLanguage(BaseModel):
    """Supported language structure"""
    code: str
    name: str
    loaded: bool
    loading: bool


class SpellCheckResponse(BaseModel):
    """Complete response from spell check service - matches actual structure"""
    results: SpellCheckResults
    language: str
    languageDetection: LanguageDetection
    readability: ReadabilityActual
    processingTime: int
    statistics: Dict[str, Any]
    service: str
    version: str
    phase: int
    enabledFeatures: Dict[str, bool]
    availableLanguages: List[SupportedLanguage]
    styleGuideApplied: Optional[str] = None
    customWordsCount: int


class CustomDictionaryRequest(BaseModel):
    """Request for custom dictionary operations"""
    word: str
    authToken: str
    categoryId: Optional[str] = None
    folderPath: Optional[str] = None
    notes: Optional[str] = None


class CustomWordsRequest(BaseModel):
    """Request for getting custom words"""
    authToken: str
    categoryId: Optional[str] = None
    folderPath: Optional[str] = None
    includeGlobal: bool = True


class ContextualSuggestionsRequest(BaseModel):
    """Request for contextual suggestions"""
    word: str
    context: str
    position: int
    basicSuggestions: List[str] = Field(default_factory=list)
    options: Dict[str, Any] = Field(default_factory=dict)


class BatchCheckRequest(BaseModel):
    """Request for batch processing"""
    text: str
    chunkSize: int = 10000
    customWords: List[str] = Field(default_factory=list)
    options: Dict[str, Any] = Field(default_factory=dict)
    language: Optional[str] = None
    enableGrammar: bool = True
    enableStyle: bool = True
    enableLanguageDetection: bool = True
    enableContextualSuggestions: bool = True
    styleGuide: Optional[str] = None
    authToken: Optional[str] = None
    userId: Optional[str] = None
    categoryId: Optional[str] = None
    folderPath: Optional[str] = None


class SpellCheckServiceClient:
    """HTTP client for spell-check-service - Phase 3 Enhanced"""
    
    def __init__(self, base_url: Optional[str] = None):
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

    def _build_check_request(
        self,
        text: str,
        custom_words: Optional[List[str]] = None,
        chunk_offset: int = 0,
        options: Optional[Dict[str, Any]] = None,
        language: Optional[str] = None,
        enable_grammar: bool = True,
        enable_style: bool = True,
        enable_language_detection: bool = True,
        enable_contextual_suggestions: bool = True,
        style_guide: Optional[str] = None,
        auth_token: Optional[str] = None,
        user_id: Optional[str] = None,
        category_id: Optional[str] = None,
        folder_path: Optional[str] = None
    ) -> SpellCheckRequest:
        """Build spell check request data"""
        return SpellCheckRequest(
            text=text,
            customWords=custom_words or [],
            chunk_offset=chunk_offset,
            options=options or {},
            language=language,
            enableGrammar=enable_grammar,
            enableStyle=enable_style,
            enableLanguageDetection=enable_language_detection,
            enableContextualSuggestions=enable_contextual_suggestions,
            styleGuide=style_guide,
            authToken=auth_token,
            userId=user_id,
            categoryId=category_id,
            folderPath=folder_path
        )

    async def _make_spell_check_request(
        self,
        request_data: SpellCheckRequest,
        attempt: int
    ) -> SpellCheckResponse:
        """Make a single spell check request"""
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "markdown-manager-backend/1.0"
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            logger.debug(
                f"Phase 3 spell check request - text length: {len(request_data.text)}, "
                f"custom words: {len(request_data.customWords)}, attempt: {attempt + 1}"
            )
            
            response = await client.post(
                f"{self.base_url}/check",
                json=request_data.dict(),
                headers=headers
            )
            
            response.raise_for_status()
            response_data = response.json()
            
            # Validate response format
            return SpellCheckResponse(**response_data)

    async def _execute_with_retry(
        self,
        request_data: SpellCheckRequest,
        start_time: float
    ) -> SpellCheckResponse:
        """Execute spell check request with retry logic"""
        for attempt in range(self.max_retries + 1):
            try:
                spell_response = await self._make_spell_check_request(request_data, attempt)
                
                elapsed_time = time.time() - start_time
                logger.info(
                    f"Phase 3 spell check completed - found {len(spell_response.results.spelling)} spelling, "
                    f"{len(spell_response.results.grammar)} grammar, "
                    f"{len(spell_response.results.style)} style issues "
                    f"in {elapsed_time:.3f}s (service: {spell_response.processingTime}ms)"
                )
                
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
                    logger.error(
                        f"Spell check HTTP error: {e.response.status_code} - {e.response.text}"
                    )
                    raise
                    
            except Exception as e:
                logger.error(f"Spell check request failed on attempt {attempt + 1}: {e}")
                if attempt == self.max_retries:
                    raise
                await asyncio.sleep(self.retry_delay * (2 ** attempt))

    async def check_spelling(
        self,
        text: str,
        custom_words: Optional[List[str]] = None,
        chunk_offset: int = 0,
        options: Optional[Dict[str, Any]] = None,
        language: Optional[str] = None,
        enable_grammar: bool = True,
        enable_style: bool = True,
        enable_language_detection: bool = True,
        enable_contextual_suggestions: bool = True,
        style_guide: Optional[str] = None,
        auth_token: Optional[str] = None,
        user_id: Optional[str] = None,
        category_id: Optional[str] = None,
        folder_path: Optional[str] = None
    ) -> SpellCheckResponse:
        """
        Check text for spelling errors with Phase 3 enhanced features
        
        Args:
            text: Text to check
            custom_words: List of custom words to ignore
            chunk_offset: Offset for chunked processing
            options: Additional options for spell checking
            language: Target language for spell checking
            enable_grammar: Enable grammar checking
            enable_style: Enable style analysis
            enable_language_detection: Enable automatic language detection
            enable_contextual_suggestions: Enable contextual suggestions
            style_guide: Style guide to apply (ap, chicago, mla, apa, academic, technical)
            auth_token: Authentication token for custom dictionary access
            user_id: User ID for custom dictionary access
            category_id: Category ID for custom dictionary access
            folder_path: Folder path for custom dictionary access
            
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
        
        request_data = self._build_check_request(
            text, custom_words, chunk_offset, options, language,
            enable_grammar, enable_style, enable_language_detection,
            enable_contextual_suggestions, style_guide, auth_token,
            user_id, category_id, folder_path
        )
        
        start_time = time.time()
        return await self._execute_with_retry(request_data, start_time)

    async def check_batch(
        self,
        text: str,
        chunk_size: int = 10000,
        custom_words: Optional[List[str]] = None,
        options: Optional[Dict[str, Any]] = None,
        language: Optional[str] = None,
        enable_grammar: bool = True,
        enable_style: bool = True,
        enable_contextual_suggestions: bool = True,
        style_guide: Optional[str] = None,
        auth_token: Optional[str] = None,
        user_id: Optional[str] = None,
        category_id: Optional[str] = None,
        folder_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Process large documents with batch processing
        
        Args:
            text: Text to check
            chunk_size: Size of chunks for processing
            custom_words: List of custom words to ignore
            options: Additional options
            language: Target language
            enable_grammar: Enable grammar checking
            enable_style: Enable style analysis
            enable_contextual_suggestions: Enable contextual suggestions
            style_guide: Style guide to apply
            auth_token: Authentication token
            user_id: User ID
            category_id: Category ID
            folder_path: Folder path
            
        Returns:
            Batch processing results
        """
        if not text or not isinstance(text, str):
            raise ValueError("Text must be a non-empty string")
            
        if len(text) > 2097152:  # 2MB limit for batch
            raise ValueError("Text size exceeds maximum limit for batch processing (2MB)")
        
        request_data = BatchCheckRequest(
            text=text,
            chunkSize=chunk_size,
            customWords=custom_words or [],
            options=options or {},
            language=language,
            enableGrammar=enable_grammar,
            enableStyle=enable_style,
            enableLanguageDetection=False,  # Skip for batch to save time
            enableContextualSuggestions=enable_contextual_suggestions,
            styleGuide=style_guide,
            authToken=auth_token,
            userId=user_id,
            categoryId=category_id,
            folderPath=folder_path
        )
        
        try:
            headers = {
                "Content-Type": "application/json",
                "User-Agent": "markdown-manager-backend/1.0"
            }
            async with httpx.AsyncClient(timeout=120.0) as client:  # Longer timeout for batch
                logger.debug(
                    f"Batch spell check request - text length: {len(text)}, chunk size: {chunk_size}"
                )
                
                response = await client.post(
                    f"{self.base_url}/check-batch",
                    json=request_data.dict(),
                    headers=headers
                )
                
                response.raise_for_status()
                return response.json()
                
        except Exception as e:
            logger.error(f"Batch spell check request failed: {e}")
            raise

    # === Phase 3: Custom Dictionary Methods ===

    async def add_custom_word(
        self,
        word: str,
        auth_token: str,
        category_id: Optional[str] = None,
        folder_path: Optional[str] = None,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """Add word to custom dictionary"""
        try:
            request_data = CustomDictionaryRequest(
                word=word,
                authToken=auth_token,
                categoryId=category_id,
                folderPath=folder_path,
                notes=notes
            )
            
            headers = {
                "Content-Type": "application/json",
                "User-Agent": "markdown-manager-backend/1.0"
            }
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{self.base_url}/dictionary/add-word",
                    json=request_data.dict(),
                    headers=headers
                )
                
                response.raise_for_status()
                return response.json()
                
        except Exception as e:
            logger.error(f"Failed to add custom word: {e}")
            raise

    async def remove_custom_word(
        self,
        word: str,
        auth_token: str,
        category_id: Optional[str] = None,
        folder_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """Remove word from custom dictionary"""
        try:
            request_data = {
                "word": word,
                "authToken": auth_token,
                "categoryId": category_id,
                "folderPath": folder_path
            }
            
            headers = {
                "Content-Type": "application/json",
                "User-Agent": "markdown-manager-backend/1.0"
            }
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.delete(
                    f"{self.base_url}/dictionary/remove-word",
                    json=request_data,
                    headers=headers
                )
                
                response.raise_for_status()
                return response.json()
                
        except Exception as e:
            logger.error(f"Failed to remove custom word: {e}")
            raise

    async def get_custom_words(
        self,
        auth_token: str,
        category_id: Optional[str] = None,
        folder_path: Optional[str] = None,
        include_global: bool = True
    ) -> Dict[str, Any]:
        """Get custom words for the specified scope"""
        try:
            request_data = CustomWordsRequest(
                authToken=auth_token,
                categoryId=category_id,
                folderPath=folder_path,
                includeGlobal=include_global
            )
            
            headers = {
                "Content-Type": "application/json",
                "User-Agent": "markdown-manager-backend/1.0"
            }
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{self.base_url}/dictionary/get-words",
                    json=request_data.dict(),
                    headers=headers
                )
                
                response.raise_for_status()
                return response.json()
                
        except Exception as e:
            logger.error(f"Failed to get custom words: {e}")
            raise

    # === Phase 3: Style Guide Methods ===

    async def get_style_guides(self) -> Dict[str, Any]:
        """Get available style guides"""
        try:
            headers = {"User-Agent": "markdown-manager-backend/1.0"}
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.base_url}/style-guides", headers=headers)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to get style guides: {e}")
            raise

    async def get_style_guide_rules(self, style_guide: str) -> Dict[str, Any]:
        """Get rules for a specific style guide"""
        try:
            headers = {"User-Agent": "markdown-manager-backend/1.0"}
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.base_url}/style-guides/{style_guide}/rules",
                    headers=headers
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to get style guide rules: {e}")
            raise

    async def recommend_style_guides(self, text: str) -> Dict[str, Any]:
        """Get style guide recommendations for text"""
        try:
            headers = {
                "Content-Type": "application/json",
                "User-Agent": "markdown-manager-backend/1.0"
            }
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{self.base_url}/style-guides/recommend",
                    json={"text": text},
                    headers=headers
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to recommend style guides: {e}")
            raise

    # === Phase 3: Contextual Analysis Methods ===

    async def get_contextual_suggestions(
        self,
        word: str,
        context: str,
        position: int,
        basic_suggestions: Optional[List[str]] = None,
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Get contextual suggestions for a word"""
        try:
            request_data = ContextualSuggestionsRequest(
                word=word,
                context=context,
                position=position,
                basicSuggestions=basic_suggestions or [],
                options=options or {}
            )
            
            headers = {
                "Content-Type": "application/json",
                "User-Agent": "markdown-manager-backend/1.0"
            }
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    f"{self.base_url}/contextual-suggestions",
                    json=request_data.dict(),
                    headers=headers
                )
                
                response.raise_for_status()
                return response.json()
                
        except Exception as e:
            logger.error(f"Failed to get contextual suggestions: {e}")
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

