"""E2E tests for specialized services (PDF, syntax highlighting)."""
import pytest
from httpx import AsyncClient

from tests.e2e.utils.data_generators import generate_test_document
from tests.e2e.utils.production_client import (
    ProductionTestClient,
    assert_response_error,
    assert_response_success,
)


@pytest.mark.e2e
@pytest.mark.asyncio
class TestProductionPDFService:
    """Test PDF generation service in production."""

    async def test_pdf_generation_from_document(
        self, authenticated_client: AsyncClient
    ):
        """Test PDF generation from markdown document."""
        client = ProductionTestClient(authenticated_client)

        # Create a document with rich markdown content
        doc_data = generate_test_document("PDF Test Document")
        doc_data[
            "content"
        ] = """# PDF Generation Test

This document tests PDF generation capabilities.

## Features to Test

### Text Formatting
- **Bold text**
- *Italic text*
- ~~Strikethrough text~~
- `Inline code`

### Lists
1. Numbered list item 1
2. Numbered list item 2
3. Numbered list item 3

- Bullet point 1
- Bullet point 2
- Bullet point 3

### Code Blocks
```python
def hello_world():
    print("Hello from PDF!")
    return "success"
```

```javascript
const message = "PDF generation test";
console.log(message);
```

### Links and Images
[Test Link](https://example.com)

### Tables
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |
| Row 2    | Row 2    | Row 2    |

### Blockquotes
> This is a blockquote that should appear in the PDF.
> It spans multiple lines.

## End of Test Document
"""

        # Create document
        create_response = await client.post("/documents", json=doc_data)
        created_doc = await assert_response_success(create_response, 201)
        doc_id = created_doc["id"]

        try:
            # Generate PDF
            pdf_response = await client.get(f"/documents/{doc_id}/pdf")
            await assert_response_success(pdf_response)

            # Verify PDF content type
            content_type = pdf_response.headers.get("content-type", "")
            assert (
                "application/pdf" in content_type.lower()
            ), f"Expected PDF content type, got: {content_type}"

            # Verify PDF content length
            content_length = len(pdf_response.content)
            assert content_length > 1000, f"PDF seems too small: {content_length} bytes"

            # Verify PDF magic bytes
            pdf_content = pdf_response.content
            assert pdf_content.startswith(
                b"%PDF"
            ), "Response doesn't appear to be a valid PDF"

        finally:
            # Cleanup
            await client.delete(f"/documents/{doc_id}")

    async def test_pdf_generation_with_special_characters(
        self, authenticated_client: AsyncClient
    ):
        """Test PDF generation with Unicode and special characters."""
        client = ProductionTestClient(authenticated_client)

        doc_data = {
            "title": "Unicode PDF Test",
            "content": """# Unicode and Special Characters Test

## International Text
- English: Hello World
- Spanish: Hola Mundo
- French: Bonjour le Monde
- German: Hallo Welt
- Japanese: こんにちは世界
- Chinese: 你好世界
- Arabic: مرحبا بالعالم
- Russian: Привет мир

## Mathematical Symbols
- π (pi) ≈ 3.14159
- ∑ (summation)
- ∫ (integral)
- ∞ (infinity)
- √ (square root)
- α, β, γ, δ (Greek letters)

## Special Characters
- Quotes: "Smart quotes" and 'single quotes'
- Dashes: — (em dash) and – (en dash)
- Symbols: © ® ™ § ¶ • …

## Emojis (if supported)
🚀 📝 ✅ ❌ 🎉 🔧 📊 🌍
""",
            "is_public": False,
        }

        # Create document
        create_response = await client.post("/documents", json=doc_data)
        created_doc = await assert_response_success(create_response, 201)
        doc_id = created_doc["id"]

        try:
            # Generate PDF with Unicode content
            pdf_response = await client.get(f"/documents/{doc_id}/pdf")
            await assert_response_success(pdf_response)

            # Verify it's a valid PDF
            assert pdf_response.content.startswith(b"%PDF")
            assert len(pdf_response.content) > 1000

        finally:
            # Cleanup
            await client.delete(f"/documents/{doc_id}")

    async def test_pdf_error_handling(self, authenticated_client: AsyncClient):
        """Test PDF generation error handling."""
        client = ProductionTestClient(authenticated_client)

        # Test PDF generation for non-existent document
        pdf_response = await client.get("/documents/99999/pdf")
        await assert_response_error(pdf_response, 404)


@pytest.mark.e2e
@pytest.mark.asyncio
class TestProductionSyntaxHighlighting:
    """Test syntax highlighting service in production."""

    async def test_syntax_highlighting_basic(self, authenticated_client: AsyncClient):
        """Test basic syntax highlighting functionality."""
        client = ProductionTestClient(authenticated_client)

        test_code = """def hello_world():
    print("Hello, World!")
    return "success"
"""

        highlight_data = {"code": test_code, "language": "python"}

        response = await client.post("/syntax-highlight", json=highlight_data)
        result = await assert_response_success(response)

        # Verify response structure
        assert "highlighted_code" in result
        assert isinstance(result["highlighted_code"], str)
        assert len(result["highlighted_code"]) > len(
            test_code
        )  # Should be longer due to HTML tags

        # Verify HTML structure
        highlighted = result["highlighted_code"]
        assert "<pre" in highlighted or "<code" in highlighted

    async def test_syntax_highlighting_multiple_languages(
        self, authenticated_client: AsyncClient
    ):
        """Test syntax highlighting with different programming languages."""
        client = ProductionTestClient(authenticated_client)

        test_cases = [
            {"language": "python", "code": "def test():\n    return True"},
            {
                "language": "javascript",
                "code": "function test() {\n    return true;\n}",
            },
            {
                "language": "java",
                "code": (
                    "public class Test {\n"
                    "    public static void main(String[] args) {\n"
                    '        System.out.println("Hello");\n'
                    "    }\n"
                    "}"
                ),
            },
            {
                "language": "css",
                "code": ".test {\n    color: red;\n    background: blue;\n}",
            },
            {"language": "sql", "code": "SELECT * FROM users WHERE active = true;"},
        ]

        for test_case in test_cases:
            response = await client.post("/syntax-highlight", json=test_case)
            result = await assert_response_success(response)

            assert "highlighted_code" in result
            assert len(result["highlighted_code"]) > 0

    async def test_syntax_highlighting_edge_cases(
        self, authenticated_client: AsyncClient
    ):
        """Test syntax highlighting edge cases."""
        client = ProductionTestClient(authenticated_client)

        # Test empty code
        empty_data = {"code": "", "language": "python"}
        empty_response = await client.post("/syntax-highlight", json=empty_data)
        empty_result = await assert_response_success(empty_response)
        assert "highlighted_code" in empty_result

        # Test very long code
        long_code = "print('hello')\n" * 1000
        long_data = {"code": long_code, "language": "python"}
        long_response = await client.post("/syntax-highlight", json=long_data)
        long_result = await assert_response_success(long_response)
        assert "highlighted_code" in long_result

        # Test unsupported language (should still work)
        unsupported_data = {"code": "some code", "language": "nonexistent"}
        unsupported_response = await client.post(
            "/syntax-highlight", json=unsupported_data
        )
        # This might return an error or fallback - either is acceptable
        assert unsupported_response.status_code in [200, 400, 422]

    async def test_syntax_highlighting_special_characters(
        self, authenticated_client: AsyncClient
    ):
        """Test syntax highlighting with special characters."""
        client = ProductionTestClient(authenticated_client)

        special_code = """# -*- coding: utf-8 -*-
def unicode_test():
    message = "Hello, 世界! 🌍"
    print(f"Testing: {message}")
    return "αβγδ"
"""

        highlight_data = {"code": special_code, "language": "python"}

        response = await client.post("/syntax-highlight", json=highlight_data)
        result = await assert_response_success(response)

        # Verify Unicode characters are preserved
        highlighted = result["highlighted_code"]
        assert "世界" in highlighted
        assert "🌍" in highlighted
        assert "αβγδ" in highlighted

    async def test_syntax_highlighting_performance(
        self, authenticated_client: AsyncClient
    ):
        """Test syntax highlighting performance with moderately large code."""
        client = ProductionTestClient(authenticated_client)
        client.reset_timing_stats()

        # Generate a moderately large Python file
        large_code = """# Large Python file for performance testing
import os
import sys
import json
from typing import Dict, List, Any, Optional

class TestClass:
    def __init__(self, name: str, value: int):
        self.name = name
        self.value = value
        self.data = {}

    def process_data(self, items: List[Dict[str, Any]]) -> Dict[str, Any]:
        result = {}
        for item in items:
            if 'key' in item and 'value' in item:
                result[item['key']] = item['value']
        return result

    def calculate_statistics(self, numbers: List[float]) -> Dict[str, float]:
        if not numbers:
            return {}

        total = sum(numbers)
        count = len(numbers)
        mean = total / count

        variance = sum((x - mean) ** 2 for x in numbers) / count
        std_dev = variance ** 0.5

        return {
            'count': count,
            'sum': total,
            'mean': mean,
            'variance': variance,
            'std_dev': std_dev,
            'min': min(numbers),
            'max': max(numbers)
        }

def main():
    test = TestClass("example", 42)
    data = [
        {'key': 'a', 'value': 1},
        {'key': 'b', 'value': 2},
        {'key': 'c', 'value': 3}
    ]
    processed = test.process_data(data)
    print(f"Processed data: {processed}")

    numbers = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0]
    stats = test.calculate_statistics(numbers)
    print(f"Statistics: {stats}")

if __name__ == "__main__":
    main()
"""

        highlight_data = {"code": large_code, "language": "python"}

        response = await client.post("/syntax-highlight", json=highlight_data)
        result = await assert_response_success(response)

        # Verify it worked
        assert "highlighted_code" in result
        assert len(result["highlighted_code"]) > len(large_code)

        # Check performance
        response_time = client.get_average_response_time()
        assert response_time < 5.0, f"Syntax highlighting too slow: {response_time}s"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
