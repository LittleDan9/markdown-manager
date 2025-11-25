#!/usr/bin/env python3
"""
Production E2E Test Runner

This script runs comprehensive end-to-end tests against the production API.
It automatically handles user registration, authentication, testing, and cleanup.

Usage:
    cd backend
    python tests/e2e/run_e2e_tests.py [options]
    # or
    poetry run python tests/e2e/run_e2e_tests.py [options]

Environment Variables:
    E2E_BASE_URL: API base URL (default: https://api.littledan.com)
    E2E_FRONTEND_ORIGIN: Frontend origin for CORS (default: https://littledan.com)
    E2E_TIMEOUT: Request timeout in seconds (default: 30)
    E2E_CLEANUP: Enable cleanup of test data (default: true)

Examples:
    # Run all E2E tests against production
    cd backend && python tests/e2e/run_e2e_tests.py

    # Run specific test class
    cd backend && python tests/e2e/run_e2e_tests.py --test TestProductionDocuments

    # Run with custom API URL
    cd backend && E2E_BASE_URL=https://staging-api.example.com python tests/e2e/run_e2e_tests.py

    # Disable cleanup (for debugging)
    cd backend && E2E_CLEANUP=false python tests/e2e/run_e2e_tests.py
"""
import argparse
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path


def setup_environment():
    """Set up environment for E2E tests."""
    # Add backend directory to Python path
    backend_dir = Path(__file__).parent.parent
    sys.path.insert(0, str(backend_dir))

    # Set default environment variables if not already set
    defaults = {
        "E2E_BASE_URL": "https://api.littledan.com",
        "E2E_FRONTEND_ORIGIN": "https://littledan.com",
        "E2E_TIMEOUT": "30",
        "E2E_CLEANUP": "true",
    }

    for key, value in defaults.items():
        if key not in os.environ:
            os.environ[key] = value


def check_api_connectivity():
    """Check if the API is accessible."""
    import httpx

    api_url = os.environ["E2E_BASE_URL"]
    print(f"🔍 Checking API connectivity: {api_url}")

    try:
        response = httpx.get(f"{api_url}/health", timeout=10)
        if response.status_code == 200:
            print("✅ API is accessible")
            return True
        else:
            print(f"❌ API returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Failed to connect to API: {e}")
        return False


def run_tests(test_filter=None, verbose=False, output_file=None):
    """Run the E2E tests."""
    print("🧪 Starting E2E test suite...")

    # Determine test directory path relative to current working directory
    current_dir = Path.cwd()
    backend_dir = Path(__file__).parent.parent.parent

    # If we're in the backend directory, use relative path
    if current_dir.name == "backend":
        test_path = "tests/e2e/"
    else:
        # If we're in the root directory, use full path to backend tests
        test_path = str(backend_dir / "tests" / "e2e")

    # Build pytest command
    cmd = ["poetry", "run", "python", "-m", "pytest", test_path, "-v"]

    # Add markers for E2E tests
    cmd.extend(["-m", "e2e"])

    # Disable coverage for E2E tests
    cmd.append("--no-cov")

    # Add test filter if specified
    if test_filter:
        cmd.extend(["-k", test_filter])

    # Add output format options
    if verbose:
        cmd.append("--tb=long")
    else:
        cmd.append("--tb=short")

    # Add JSON output for parsing
    if output_file:
        cmd.extend(["--json-report", f"--json-report-file={output_file}"])

    # Add color output
    cmd.append("--color=yes")

    # Run tests
    start_time = datetime.now()
    print(f"📋 Running command: {' '.join(cmd)}")

    try:
        # Always run from the backend directory
        cwd = backend_dir if current_dir.name != "backend" else None
        result = subprocess.run(cmd, cwd=cwd)
        end_time = datetime.now()
        duration = end_time - start_time

        print(f"\n⏱️  Test duration: {duration}")

        if result.returncode == 0:
            print("🎉 All E2E tests passed!")
        else:
            print("❌ Some E2E tests failed!")

        return result.returncode

    except KeyboardInterrupt:
        print("\n⚠️  Tests interrupted by user")
        return 130
    except Exception as e:
        print(f"❌ Failed to run tests: {e}")
        return 1


def generate_report(json_file):
    """Generate a summary report from test results."""
    if not os.path.exists(json_file):
        return

    try:
        with open(json_file, "r") as f:
            data = json.load(f)

        summary = data.get("summary", {})

        print("\n📊 TEST SUMMARY REPORT")
        print("=" * 50)
        print(f"Total Tests: {summary.get('total', 0)}")
        print(f"Passed: {summary.get('passed', 0)}")
        print(f"Failed: {summary.get('failed', 0)}")
        print(f"Skipped: {summary.get('skipped', 0)}")
        print(f"Duration: {data.get('duration', 0):.2f}s")

        if summary.get("failed", 0) > 0:
            print("\n❌ FAILED TESTS:")
            for test in data.get("tests", []):
                if test.get("outcome") == "failed":
                    print(f"  - {test.get('nodeid', 'Unknown test')}")

        print("=" * 50)

    except Exception as e:
        print(f"Failed to generate report: {e}")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Run E2E tests against production API",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    parser.add_argument(
        "--test", "-t", help="Filter tests by name or class (pytest -k option)"
    )

    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Verbose output with detailed error traces",
    )

    parser.add_argument(
        "--no-connectivity-check",
        action="store_true",
        help="Skip API connectivity check",
    )

    parser.add_argument("--report", "-r", help="Generate JSON report file")

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be run without executing",
    )

    args = parser.parse_args()

    # Setup
    setup_environment()

    print("🚀 Production E2E Test Runner")
    print(f"📍 API URL: {os.environ['E2E_BASE_URL']}")
    print(f"🌐 Frontend Origin: {os.environ['E2E_FRONTEND_ORIGIN']}")
    print(f"⏰ Timeout: {os.environ['E2E_TIMEOUT']}s")
    print(f"🧹 Cleanup: {os.environ['E2E_CLEANUP']}")

    if args.dry_run:
        print("🔍 DRY RUN MODE - No tests will be executed")
        return 0

    # Check connectivity
    if not args.no_connectivity_check:
        if not check_api_connectivity():
            print("❌ Cannot proceed without API connectivity")
            return 1

    # Run tests
    report_file = (
        args.report or f"e2e_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    )
    exit_code = run_tests(args.test, args.verbose, report_file)

    # Generate report
    if args.report or exit_code != 0:
        generate_report(report_file)

    return exit_code


if __name__ == "__main__":
    sys.exit(main())
