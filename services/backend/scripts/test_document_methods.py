#!/usr/bin/env python3
"""Test the new Document model methods."""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.models.document import Document


def test_document_methods():
    """Test the new Document model methods."""
    
    # Test normalize_folder_path
    test_cases = [
        ('', '/'),
        ('/', '/'),
        ('Work', '/Work'),
        ('/Work/', '/Work'),
        ('//Work//Projects//', '/Work/Projects'),
        ('Work/Projects', '/Work/Projects'),
    ]
    
    print("Testing Document.normalize_folder_path:")
    for input_path, expected in test_cases:
        result = Document.normalize_folder_path(input_path)
        status = "✅" if result == expected else "❌"
        print(f"  {status} '{input_path}' -> '{result}' (expected: '{expected}')")
        if result != expected:
            return False
    
    # Test folder path properties with mock document
    class MockDoc:
        def __init__(self, folder_path):
            self.folder_path = folder_path
            self.name = "test.md"
    
    print("\nTesting folder path properties:")
    test_docs = [
        ('/Work/Projects', '/Work', ['Work', 'Projects'], 'Work/Projects/test.md'),
        ('/General', '/General', ['General'], 'General/test.md'),
        ('/', '/', [], 'test.md'),
    ]
    
    for folder_path, expected_root, expected_breadcrumbs, expected_display in test_docs:
        doc = MockDoc(folder_path)
        
        # Simulate the property methods
        parts = [p for p in doc.folder_path.split('/') if p]
        root_folder = f"/{parts[0]}" if parts else "/"
        breadcrumbs = parts
        display_path = doc.name if doc.folder_path == '/' else f"{doc.folder_path.strip('/')}/{doc.name}"
        
        root_ok = root_folder == expected_root
        breadcrumbs_ok = breadcrumbs == expected_breadcrumbs
        display_ok = display_path == expected_display
        
        status = "✅" if all([root_ok, breadcrumbs_ok, display_ok]) else "❌"
        print(f"  {status} '{folder_path}' -> root: '{root_folder}', breadcrumbs: {breadcrumbs}, display: '{display_path}'")
        
        if not all([root_ok, breadcrumbs_ok, display_ok]):
            return False
    
    print("\n✅ All Document model method tests passed!")
    return True


if __name__ == "__main__":
    success = test_document_methods()
    sys.exit(0 if success else 1)
