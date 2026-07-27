"""Internal endpoints for Platform AI service callbacks.

These endpoints are only accessible from the shared-services Docker network
via X-Platform-AI-Token authentication.
"""

import logging

from fastapi import APIRouter, Header, HTTPException
from sqlalchemy import select

from app.configs import settings
from app.database import AsyncSessionLocal
from app.models.user import User
from app.services.search.semantic import SemanticSearchService
from app.services.search.content_processor import ContentProcessor

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/internal", tags=["internal"])


async def _verify_platform_token(x_platform_ai_token: str = Header(...)) -> None:
    """Verify the platform AI token."""
    expected = settings.cross_app_secret
    platform_token = getattr(settings, "platform_ai_token", "")
    if x_platform_ai_token not in (expected, platform_token):
        raise HTTPException(status_code=401, detail="Invalid platform AI token")


async def _get_user_by_email(email: str) -> User | None:
    """Look up a user by email."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()


@router.post("/ai-tools/execute")
async def execute_tool(
    body: dict,
    x_platform_ai_token: str = Header(...),
):
    """Execute a tool call from the Platform AI service.

    Tools available:
      - search_documents: Semantic search across user's documents
      - get_document_content: Get full content of a document
      - list_categories: List user's document categories
      - get_document_summary: Get document summary/excerpt
    """
    await _verify_platform_token(x_platform_ai_token)

    tool_name = body.get("tool_name", "")
    arguments = body.get("arguments", {})
    user_email = body.get("user_email", "")

    if not tool_name:
        return {"error": "tool_name is required"}

    user = await _get_user_by_email(user_email)
    if not user:
        return {"error": f"User not found: {user_email}"}

    async with AsyncSessionLocal() as db:
        try:
            if tool_name == "search_documents":
                return await _tool_search_documents(db, user, arguments)
            elif tool_name == "get_document_content":
                return await _tool_get_document_content(db, user, arguments)
            elif tool_name == "list_categories":
                return await _tool_list_categories(db, user, arguments)
            elif tool_name == "get_document_summary":
                return await _tool_get_document_summary(db, user, arguments)
            else:
                return {"error": f"Unknown tool: {tool_name}"}
        except Exception as e:
            logger.exception("Tool execution error for %s", tool_name)
            return {"error": str(e)}


@router.post("/ai-context")
async def get_context(
    body: dict,
    x_platform_ai_token: str = Header(...),
):
    """Provide RAG context for the Platform AI service.

    Body:
        user_email: str
        scope: str (all, current, help)
        scope_metadata: dict (document_id, deep_think, strict_context, category_id, selection_text)

    Returns:
        system_prompt: str
        context_documents: list[dict]
        available_tools: list[dict]
    """
    await _verify_platform_token(x_platform_ai_token)

    user_email = body.get("user_email", "")
    scope = body.get("scope", "all")
    scope_metadata = body.get("scope_metadata", {})

    user = await _get_user_by_email(user_email)
    if not user:
        return {"system_prompt": "", "context_documents": [], "available_tools": []}

    document_id = scope_metadata.get("document_id")
    deep_think = scope_metadata.get("deep_think", False)
    strict_context = scope_metadata.get("strict_context", False)
    category_id = scope_metadata.get("category_id")
    selection_text = scope_metadata.get("selection_text")
    question = scope_metadata.get("question", "")

    # Build system prompt based on scope
    if scope == "current" and document_id:
        if strict_context:
            system_prompt = (
                "You are a document assistant. Answer questions ONLY using the document content below. "
                "If the answer is not in the document, say so. Do not use general knowledge."
            )
        else:
            system_prompt = (
                "You are a document assistant. Answer questions about the document below. "
                "Prioritise information from the document but supplement with general knowledge when helpful. "
                "Use markdown formatting."
            )
    elif scope == "help":
        system_prompt = (
            "You are a helpful product documentation assistant. Answer questions about the application "
            "using the documentation provided below. Be concise and reference relevant sections."
        )
    else:
        system_prompt = (
            "You are a document assistant with access to the user's document library. "
            "Use the document catalogue to know what exists, and search excerpts for content details. "
            "Reference document titles when citing information. Use markdown formatting."
        )

    # Build context documents via semantic search
    context_documents = []
    async with AsyncSessionLocal() as db:
        try:
            if scope == "current" and document_id:
                # Single document context
                context_documents = await _build_single_doc_context(
                    db, user, document_id, deep_think, selection_text
                )
            elif scope == "all" and question:
                # RAG: semantic search across all documents
                context_documents = await _build_rag_context(
                    db, user, question, category_id
                )
        except Exception as e:
            logger.warning("Context building failed: %s", e)

    # MM tools are always available
    available_tools = _get_mm_tools()

    return {
        "system_prompt": system_prompt,
        "context_documents": context_documents,
        "available_tools": available_tools,
    }


# ──────────────────────────────────────────────────────────────────────────────
# Tool Implementations
# ──────────────────────────────────────────────────────────────────────────────

async def _tool_search_documents(db, user, args: dict) -> dict:
    """Semantic search across user's documents."""
    query = args.get("query", "")
    limit = min(args.get("limit", 5), 10)
    category_id = args.get("category_id")

    if not query:
        return {"error": "query is required"}

    search_service = SemanticSearchService()
    results = await search_service.search(db, user.id, query, limit=limit, category_id=category_id)

    return {
        "results": [
            {
                "document_id": r.document.id,
                "title": r.document.title,
                "score": round(r.score, 3),
                "excerpt": r.document.content[:300] if r.document.content else "",
            }
            for r in results
        ]
    }


async def _tool_get_document_content(db, user, args: dict) -> dict:
    """Get full content of a specific document."""
    from app.crud.document import get_document_by_id

    document_id = args.get("document_id")
    if not document_id:
        return {"error": "document_id is required"}

    doc = await get_document_by_id(db, document_id, user.id)
    if not doc:
        return {"error": "Document not found"}

    return {
        "document_id": doc.id,
        "title": doc.title,
        "content": doc.content[:8000] if doc.content else "",
        "category": doc.category.name if doc.category else None,
    }


async def _tool_list_categories(db, user, args: dict) -> dict:
    """List user's document categories."""
    from app.crud.category import get_categories

    categories = await get_categories(db, user.id)
    return {
        "categories": [
            {"id": c.id, "name": c.name, "document_count": c.document_count}
            for c in categories
        ]
    }


async def _tool_get_document_summary(db, user, args: dict) -> dict:
    """Get a document summary (headings + first paragraphs)."""
    from app.crud.document import get_document_by_id

    document_id = args.get("document_id")
    if not document_id:
        return {"error": "document_id is required"}

    doc = await get_document_by_id(db, document_id, user.id)
    if not doc:
        return {"error": "Document not found"}

    processor = ContentProcessor()
    summary = processor.extract_summary(doc.content or "", max_length=800)

    return {
        "document_id": doc.id,
        "title": doc.title,
        "summary": summary,
    }


# ──────────────────────────────────────────────────────────────────────────────
# Context Builders
# ──────────────────────────────────────────────────────────────────────────────

async def _build_single_doc_context(db, user, document_id, deep_think, selection_text):
    """Build context from a single document."""
    from app.crud.document import get_document_by_id

    doc = await get_document_by_id(db, document_id, user.id)
    if not doc:
        return []

    content = doc.content or ""
    if not deep_think:
        # Use summary instead of full text
        processor = ContentProcessor()
        content = processor.extract_summary(content, max_length=2000)

    ctx = {"title": doc.title, "content": content}
    if selection_text:
        ctx["content"] = f"Selected text: {selection_text}\n\nFull document:\n{content}"

    return [ctx]


async def _build_rag_context(db, user, question, category_id=None):
    """Build RAG context via semantic search."""
    search_service = SemanticSearchService()
    results = await search_service.search(
        db, user.id, question, limit=5, category_id=category_id
    )

    return [
        {
            "title": r.document.title,
            "content": r.document.content[:2000] if r.document.content else "",
        }
        for r in results
    ]


# ──────────────────────────────────────────────────────────────────────────────
# Tool Definitions (OpenAI function-calling format)
# ──────────────────────────────────────────────────────────────────────────────

def _get_mm_tools() -> list[dict]:
    """Return MM's tool definitions in OpenAI function-calling format."""
    return [
        {
            "type": "function",
            "function": {
                "name": "search_documents",
                "description": "Search the user's document library using semantic search. Returns relevant documents with excerpts.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Search query"},
                        "limit": {"type": "integer", "description": "Max results (default 5, max 10)"},
                        "category_id": {"type": "integer", "description": "Filter to specific category (optional)"},
                    },
                    "required": ["query"],
                },
            },
            "core": True,
        },
        {
            "type": "function",
            "function": {
                "name": "get_document_content",
                "description": "Get the full content of a specific document by ID.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "document_id": {"type": "integer", "description": "Document ID"},
                    },
                    "required": ["document_id"],
                },
            },
            "core": True,
        },
        {
            "type": "function",
            "function": {
                "name": "list_categories",
                "description": "List all document categories with document counts.",
                "parameters": {"type": "object", "properties": {}},
            },
            "core": True,
        },
        {
            "type": "function",
            "function": {
                "name": "get_document_summary",
                "description": "Get a brief summary of a document (headings and key paragraphs).",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "document_id": {"type": "integer", "description": "Document ID"},
                    },
                    "required": ["document_id"],
                },
            },
            "core": True,
        },
    ]
