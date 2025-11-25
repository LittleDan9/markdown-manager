#!/usr/bin/env python3
"""
Simple filesystem scanner to identify orphaned files.
"""

import os
from pathlib import Path


def scan_user_files(user_id: int, storage_root: str = "/home/dlittle/code/markdown-manager/storage"):
    """Scan filesystem for all markdown files for a user."""
    storage_path = Path(storage_root)
    user_dir = storage_path / str(user_id)
    
    if not user_dir.exists():
        print(f"User directory {user_dir} does not exist")
        return []
    
    print(f"Scanning {user_dir} for .md files...")
    
    md_files = []
    for md_file in user_dir.rglob("*.md"):
        relative_path = str(md_file.relative_to(user_dir))
        file_size = md_file.stat().st_size
        print(f"  {relative_path} ({file_size} bytes)")
        md_files.append({
            'path': relative_path,
            'full_path': str(md_file),
            'size': file_size
        })
    
    print(f"Found {len(md_files)} total .md files")
    return md_files


def main():
    """Main scanner."""
    user_id = 7
    print(f"Scanning for markdown files for user {user_id}")
    files = scan_user_files(user_id)
    
    print("\n=== SUMMARY ===")
    print(f"Found {len(files)} markdown files in user {user_id}'s directory")
    print("\nThese are the files that exist on the filesystem.")
    print("To identify orphaned files, compare this list with database entries.")


if __name__ == "__main__":
    main()