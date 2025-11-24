#!/usr/bin/env python3
"""
Test runner for markdown-lint-service consumer.

This script runs the base consumer tests with linting service configuration
to validate the linting consumer implementation.
"""
import os
import sys
import subprocess
import json
from pathlib import Path

# Add consumer-service-base to Python path
BASE_DIR = Path(__file__).parent.parent / "consumer-service-base"
sys.path.insert(0, str(BASE_DIR))

def main():
    """Run tests for markdown-lint-service consumer."""
    print("🧪 Running Consumer Tests for Markdown Lint Service")
    print("=" * 60)

    # Set up environment for linting service testing
    os.environ["PYTEST_CURRENT_SERVICE"] = "linting"

    # Create temporary config file for testing
    config = {
        "service": {
            "name": "markdown-lint-consumer",
            "domain": "linting",
            "schema": "linting"
        },
        "redis": {
            "url": "redis://localhost:6379/15"  # Test database
        },
        "consumer_group": "lint_group",
        "topics": ["identity.user.v1"]
    }

    config_file = Path("/tmp/linting_test_config.json")
    with open(config_file, "w") as f:
        json.dump(config, f, indent=2)

    os.environ["CONFIG_FILE"] = str(config_file)

    # Set up environment variables for testing
    test_env = os.environ.copy()
    test_env.update({
        "CONFIG_FILE": str(config_file),
        "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/markdown_manager",
        "REDIS_URL": "redis://localhost:6379/15",
        "PYTEST_CURRENT_SERVICE": "linting"
    })

    # Run pytest with specific configuration using Poetry
    pytest_args = [
        "poetry", "run", "pytest",
        "tests",
        "-v",
        "--tb=short",
        "-x",  # Stop on first failure
        "--color=yes",
        "--disable-warnings",
        "-k", "not (spell_checking or spell)",  # Exclude spell-checking specific tests
        "--cov=app",
        "--cov-report=term-missing",
        "--cov-report=html:coverage/linting",
    ]

    print(f"Running: {' '.join(pytest_args)}")
    print()

    try:
        # Change to base directory for test execution
        os.chdir(BASE_DIR)
        result = subprocess.run(pytest_args, env=test_env, check=False)

        if result.returncode == 0:
            print("\n✅ All linting consumer tests passed!")
            print(f"Coverage report available at: {BASE_DIR}/coverage/linting/index.html")
        else:
            print(f"\n❌ Tests failed with exit code: {result.returncode}")

        return result.returncode

    finally:
        # Cleanup
        if config_file.exists():
            config_file.unlink()


if __name__ == "__main__":
    sys.exit(main())