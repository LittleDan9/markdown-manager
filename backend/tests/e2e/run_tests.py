#!/usr/bin/env python3
"""
Simple E2E test runner for production API testing.
"""
import os
import subprocess
import sys


def run_e2e_tests():
    """Run the E2E tests using pytest"""
    # Change to the backend directory
    backend_dir = os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    )
    os.chdir(backend_dir)

    # Run tests with poetry
    cmd = [
        "poetry",
        "run",
        "pytest",
        "tests/e2e/",
        "-v",
        "--tb=short",
        "--no-header",
        "--no-cov",
    ]

    print("🚀 Running E2E tests against production API...")
    print(f"📁 Working directory: {os.getcwd()}")
    print(f"🔧 Command: {' '.join(cmd)}")
    print("-" * 50)

    result = subprocess.run(cmd)
    return result.returncode


if __name__ == "__main__":
    exit_code = run_e2e_tests()
    if exit_code == 0:
        print("\n✅ All E2E tests passed!")
    else:
        print(f"\n❌ E2E tests failed with exit code: {exit_code}")
    sys.exit(exit_code)
