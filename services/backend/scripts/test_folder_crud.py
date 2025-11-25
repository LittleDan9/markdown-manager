#!/usr/bin/env python3
"""Test the new CRUD methods for folder operations."""

import asyncio
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.crud.document import document as document_crud


async def test_folder_crud_methods():
    """Test the new folder-based CRUD methods."""
    
    # This is a simple test that doesn't require actual database connection
    # Just tests that the methods exist and can be called
    
    methods_to_test = [
        'get_documents_by_folder_path',
        'get_folder_structure',
        'move_document_to_folder'
    ]
    
    print("Testing that new CRUD methods exist:")
    for method_name in methods_to_test:
        if hasattr(document_crud, method_name):
            method = getattr(document_crud, method_name)
            if callable(method):
                print(f"  ✅ {method_name} - exists and is callable")
            else:
                print(f"  ❌ {method_name} - exists but not callable")
                return False
        else:
            print(f"  ❌ {method_name} - does not exist")
            return False
    
    print("\n✅ All new CRUD methods are available!")
    return True


if __name__ == "__main__":
    success = asyncio.run(test_folder_crud_methods())
    sys.exit(0 if success else 1)
