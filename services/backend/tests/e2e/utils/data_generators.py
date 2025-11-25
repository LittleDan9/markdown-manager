"""Data generators for E2E testing."""
import random
import uuid
from typing import Any, Dict, List


def generate_unique_id() -> str:
    """Generate a unique ID for test data."""
    return str(uuid.uuid4())[:8]


def generate_test_user(prefix: str = "e2e") -> Dict[str, Any]:
    """Generate test user data."""
    unique_id = generate_unique_id()
    return {
        "email": f"{prefix}-test-{unique_id}@example.com",
        "password": f"TestPassword{unique_id}!",
        "first_name": f"Test{unique_id}",
        "last_name": "User",
    }


def generate_test_document(title_prefix: str = "E2E Test Document") -> Dict[str, Any]:
    """Generate test document data."""
    unique_id = generate_unique_id()
    return {
        "name": f"{title_prefix} {unique_id}",
        "content": f"""# {title_prefix} {unique_id}

This is a test document created by E2E tests.

## Features to test
- Markdown formatting
- **Bold text**
- *Italic text*
- [Links](https://example.com)
- Code blocks

```python
def hello_world():
    print("Hello from E2E test!")
```

## Test Data
- Unique ID: {unique_id}
- Created by: E2E Test Suite
- Purpose: Production validation

### Lists
1. First item
2. Second item
3. Third item

### Unordered List
- Point A
- Point B
- Point C

> This is a blockquote for testing purposes.
""",
        "category": "E2E-Test",
    }


def generate_test_category(name_prefix: str = "E2E Test Category") -> Dict[str, Any]:
    """Generate test category data."""
    unique_id = generate_unique_id()
    colors = ["#FF5733", "#33FF57", "#3357FF", "#FF33F5", "#F5FF33", "#33FFF5"]

    return {
        "name": f"{name_prefix} {unique_id}",
        "description": f"Test category for E2E testing - {unique_id}",
        "color": random.choice(colors),
    }


def generate_test_dictionary_entry(word_prefix: str = "e2etest") -> Dict[str, Any]:
    """Generate test dictionary entry data."""
    unique_id = generate_unique_id()
    parts_of_speech = ["noun", "verb", "adjective", "adverb"]

    word = f"{word_prefix}{unique_id}"
    return {
        "word": word,
        "definition": f"A test word created by E2E tests for validation purposes - {unique_id}",
        "part_of_speech": random.choice(parts_of_speech),
        "example": f"This is an example sentence using the word '{word}' in context.",
    }


def generate_multiple_documents(count: int = 5) -> List[Dict[str, Any]]:
    """Generate multiple test documents."""
    return [generate_test_document(f"Bulk Test Doc {i + 1}") for i in range(count)]


def generate_multiple_categories(count: int = 3) -> List[Dict[str, Any]]:
    """Generate multiple test categories."""
    return [generate_test_category(f"Bulk Test Cat {i + 1}") for i in range(count)]


def generate_multiple_dictionary_entries(count: int = 10) -> List[Dict[str, Any]]:
    """Generate multiple test dictionary entries."""
    return [generate_test_dictionary_entry(f"bulktest{i + 1}") for i in range(count)]


def generate_large_document_content(paragraphs: int = 50) -> str:
    """Generate large document content for performance testing."""
    unique_id = generate_unique_id()

    content = f"# Large Document Test {unique_id}\n\n"
    content += (
        "This document is generated for performance testing with large content.\n\n"
    )

    for i in range(paragraphs):
        content += f"""## Section {i + 1}

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis
nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore
eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident,
sunt in culpa qui officia deserunt mollit anim id est laborum.

```python
# Code block {i + 1}
def section_{i + 1}():
    return "This is section {i + 1} of the large document"
```

"""

    return content


def generate_large_document(paragraphs: int = 20) -> Dict[str, Any]:
    """Generate large document for performance testing."""
    unique_id = generate_unique_id()
    return {
        "name": f"Large Document Test {unique_id}",
        "content": generate_large_document_content(paragraphs),
        "category": "E2E-Performance",
    }


def generate_special_characters_document() -> Dict[str, Any]:
    """Generate document with special characters for testing."""
    unique_id = generate_unique_id()

    return {
        "name": f"Special Characters Test {unique_id}",
        "content": f"""# Special Characters Test {unique_id}

## Unicode Characters
- 日本語 (Japanese)
- Español (Spanish with ñ)
- Français (French with accents)
- Deutsch (German with ü, ö, ä)
- العربية (Arabic)
- 中文 (Chinese)
- Русский (Russian)

## Mathematical Symbols
- ∑ (Summation)
- ∫ (Integral)
- π (Pi)
- α β γ δ (Greek letters)
- ∞ (Infinity)

## Special Punctuation
- "Smart quotes"
- 'Single smart quotes'
- … (Ellipsis)
- — (Em dash)
- – (En dash)

## Emojis
- 🚀 (Rocket)
- 📝 (Memo)
- ✅ (Check mark)
- ❌ (Cross mark)
- 🎉 (Party)

## Code with special characters
```javascript
const message = "Hello, 世界! 🌍";
console.log(`Testing special chars: αβγ`);
```
""",
        "category": "E2E-Special",
    }
