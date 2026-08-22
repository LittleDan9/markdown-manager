"""Deep search — LLM-powered query expansion + multi-query hybrid search."""
from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.search.semantic import SearchResult, SemanticSearchService

logger = logging.getLogger(__name__)

_EXPANSION_PROMPT = """Generate 4 diverse search queries that would help find documents related to:
"{query}"

Return ONLY the queries, one per line. Make them varied — include synonyms, related concepts, and different phrasings."""

_RERANK_PROMPT = """Rate how relevant each document is to the search query. For each, give a score 1-10 and a brief one-sentence explanation of why it's relevant (or not).

Search query: "{query}"

Documents:
{documents}

Respond with one line per document in this exact format:
DOC_ID | SCORE | explanation
"""


class DeepSearchService:
    def __init__(self, search_service: SemanticSearchService):
        self._search = search_service

    async def search(
        self,
        db: AsyncSession,
        user_id: int,
        query: str,
        limit: int = 10,
    ) -> list[SearchResult]:
        """Expand query via LLM, run multiple hybrid searches, fuse and rerank results."""
        expanded_queries = await self._expand_query(query)
        all_queries = [query] + expanded_queries

        # Run hybrid search for each query variation sequentially
        # (shared DB session prevents true parallelism)
        all_results: list[list[SearchResult]] = []
        for q in all_queries:
            results = await self._search.search(db, user_id, q, limit=limit, min_score=0.1)
            all_results.append(results)

        # Fuse all result sets using RRF
        fused = self._multi_query_fusion(all_results, limit)

        # LLM reranking with relevance explanations
        reranked = await self._rerank_with_explanations(query, fused)
        return reranked

    async def _expand_query(self, query: str) -> list[str]:
        """Use LLM to generate query variations."""
        try:
            from app.services.search.providers.ollama import OllamaProvider
            from app.configs.settings import get_settings
            settings = get_settings()
            provider = OllamaProvider(
                url=settings.ollama_url,
                model=settings.ollama_model,
            )
            if not await provider.health_check():
                return []

            prompt = _EXPANSION_PROMPT.format(query=query)
            response = ""
            async for token in provider.stream([{"role": "user", "content": prompt}]):
                response += token
            lines = [
                line.strip().lstrip("0123456789.-) ")
                for line in response.strip().splitlines()
                if line.strip() and len(line.strip()) > 5
            ]
            return lines[:4]
        except Exception:
            logger.warning("Query expansion failed — using original query only")
            return []

    async def _rerank_with_explanations(
        self, query: str, results: list[SearchResult]
    ) -> list[SearchResult]:
        """Use LLM to rerank top results and generate relevance explanations."""
        if not results:
            return results
        # Only rerank top 10 to limit token usage
        to_rerank = results[:10]
        remainder = results[10:]

        try:
            from app.services.search.providers.ollama import OllamaProvider
            from app.configs.settings import get_settings
            settings = get_settings()
            provider = OllamaProvider(url=settings.ollama_url, model=settings.ollama_model)
            if not await provider.health_check():
                return results

            # Build document summaries for the LLM
            doc_lines = []
            for i, r in enumerate(to_rerank):
                summary = ""
                if r.embedding and r.embedding.summary:
                    summary = r.embedding.summary[:200]
                else:
                    summary = r.document.name
                doc_lines.append(f"{i} | {r.document.name}: {summary}")

            prompt = _RERANK_PROMPT.format(query=query, documents="\n".join(doc_lines))
            response = ""
            async for token in provider.stream([{"role": "user", "content": prompt}]):
                response += token

            # Parse LLM response: "DOC_ID | SCORE | explanation"
            rerank_scores: dict[int, tuple[float, str]] = {}
            for line in response.strip().splitlines():
                parts = line.split("|", 2)
                if len(parts) < 3:
                    continue
                try:
                    doc_idx = int(parts[0].strip())
                    llm_score = float(parts[1].strip())
                    explanation = parts[2].strip()
                    if 0 <= doc_idx < len(to_rerank):
                        rerank_scores[doc_idx] = (llm_score / 10.0, explanation)
                except (ValueError, IndexError):
                    continue

            # Apply LLM scores and explanations
            reranked = []
            for i, r in enumerate(to_rerank):
                if i in rerank_scores:
                    llm_score, explanation = rerank_scores[i]
                    # Blend: 60% original RRF score + 40% LLM score
                    blended = 0.6 * r.score + 0.4 * llm_score
                    reranked.append(SearchResult(
                        document=r.document,
                        score=blended,
                        embedding=r.embedding,
                        explanation=explanation,
                    ))
                else:
                    reranked.append(r)

            reranked.sort(key=lambda x: x.score, reverse=True)
            return reranked + remainder

        except Exception:
            logger.warning("LLM reranking failed — returning original order")
            return results

    def _multi_query_fusion(
        self,
        result_sets: list[list[SearchResult]],
        limit: int,
    ) -> list[SearchResult]:
        """Fuse multiple result sets using RRF."""
        k = 60
        doc_scores: dict[int, float] = {}
        doc_map: dict[int, SearchResult] = {}

        for results in result_sets:
            for rank, r in enumerate(results):
                doc_id = r.document.id
                doc_scores[doc_id] = doc_scores.get(doc_id, 0) + 1.0 / (k + rank + 1)
                if doc_id not in doc_map or (r.embedding is not None and doc_map[doc_id].embedding is None):
                    doc_map[doc_id] = r

        if not doc_scores:
            return []

        max_score = max(doc_scores.values())
        fused = []
        for doc_id, rrf_score in doc_scores.items():
            result = doc_map[doc_id]
            fused.append(SearchResult(
                document=result.document,
                score=rrf_score / max_score,
                embedding=result.embedding,
            ))
        fused.sort(key=lambda r: r.score, reverse=True)
        return fused[:limit]
