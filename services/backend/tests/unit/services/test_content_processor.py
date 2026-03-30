"""Tests for content_processor — mermaid extraction, markdown stripping, chunking."""
import pytest

from app.services.search.content_processor import (
    DocumentChunk,
    ProcessedContent,
    chunk_document_content,
    extract_summary,
    prepare_document_content,
)


class TestPrepareDocumentContent:
    """Tests for prepare_document_content()."""

    def test_plain_text(self):
        result = prepare_document_content("My Doc", "Hello world.")
        assert isinstance(result, ProcessedContent)
        assert "My Doc" in result.text
        assert "Hello world" in result.text
        assert result.has_mermaid is False

    def test_strips_markdown_bold_italic(self):
        result = prepare_document_content("Title", "Some **bold** and *italic* text.")
        assert "**" not in result.text
        assert "*" not in result.text
        assert "bold" in result.text
        assert "italic" in result.text

    def test_strips_code_fences(self):
        content = "Before\n```python\nprint('hi')\n```\nAfter"
        result = prepare_document_content("Title", content)
        assert "print" not in result.text
        assert "Before" in result.text
        assert "After" in result.text

    def test_preserves_link_text(self):
        result = prepare_document_content("Title", "See [my link](http://example.com).")
        assert "my link" in result.text
        assert "http://example.com" not in result.text

    def test_strips_images(self):
        result = prepare_document_content("Title", "![alt text](image.png)")
        assert "alt text" not in result.text
        assert "image.png" not in result.text

    def test_mermaid_extraction(self):
        content = "# Heading\n\n```mermaid\nflowchart TD\nA[Start] --> B[End]\n```\n\nSome text."
        result = prepare_document_content("Title", content)
        assert result.has_mermaid is True
        assert "flowchart" in result.text.lower()
        assert "Start" in result.text
        assert "End" in result.text

    def test_mermaid_not_doubled(self):
        """Mermaid blocks should be replaced by NL description, not kept as raw DSL."""
        content = "```mermaid\ngraph TD\nA[Hello]\n```"
        result = prepare_document_content("Title", content)
        # Raw DSL arrows should be gone; NL description should be present
        assert "-->" not in result.text
        assert "Hello" in result.text

    def test_empty_content(self):
        result = prepare_document_content("Title", "")
        assert "Title" in result.text

    def test_heading_markers_stripped(self):
        result = prepare_document_content("Title", "## Section One\nParagraph text.")
        assert "##" not in result.text
        assert "Section One" in result.text


class TestExtractSummary:
    """Tests for extract_summary()."""

    def test_includes_title(self):
        summary = extract_summary("My Doc", "Some content here.")
        assert "# My Doc" in summary

    def test_includes_headings(self):
        content = "## Introduction\nSome text.\n## Methods\nMore text."
        summary = extract_summary("Title", content)
        assert "Introduction" in summary
        assert "Methods" in summary

    def test_max_chars_cap(self):
        long_content = "\n## Section\n" + ("x " * 500 + "\n") * 20
        summary = extract_summary("Title", long_content, max_chars=200)
        assert len(summary) <= 200

    def test_mermaid_diagram_description(self):
        content = "# Intro\n\n```mermaid\nflowchart TD\nA[Start] --> B[End]\n```"
        summary = extract_summary("Title", content)
        assert "Diagram" in summary or "diagram" in summary or "flowchart" in summary

    def test_empty_content(self):
        summary = extract_summary("OnlyTitle", "")
        assert "OnlyTitle" in summary


class TestChunkDocumentContent:
    """Tests for chunk_document_content()."""

    def test_short_document_single_chunk(self):
        content = "Short document content."
        chunks = chunk_document_content("Title", content)
        assert len(chunks) == 1
        assert isinstance(chunks[0], DocumentChunk)
        assert chunks[0].chunk_index == 0
        assert "Title" in chunks[0].text

    def test_long_document_multiple_chunks(self):
        # Create content well over 1.5 * 2048 chars
        content = ". ".join([f"Sentence number {i} with some extra words to pad it out" for i in range(200)])
        chunks = chunk_document_content("Title", content)
        assert len(chunks) > 1
        # Indices should be sequential
        for i, chunk in enumerate(chunks):
            assert chunk.chunk_index == i

    def test_chunks_contain_title(self):
        content = ". ".join([f"Sentence {i} with padding text for length" for i in range(200)])
        chunks = chunk_document_content("Title", content)
        for chunk in chunks:
            assert "Title" in chunk.text

    def test_empty_content_returns_single_chunk(self):
        chunks = chunk_document_content("Title", "")
        assert len(chunks) >= 1
        assert chunks[0].chunk_index == 0
