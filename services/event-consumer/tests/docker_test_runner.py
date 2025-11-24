"""
Docker test environment for consumer services.

This module provides utilities for running consumer tests in Docker containers
with Redis and PostgreSQL dependencies.
"""
import asyncio
import json
import subprocess
import time
from pathlib import Path
from typing import Dict, Any, Optional


class DockerTestEnvironment:
    """Manages Docker test environment for consumer services."""

    def __init__(self, service_name: str, config: Dict[str, Any]):
        self.service_name = service_name
        self.config = config
        self.containers = []

    async def start(self) -> None:
        """Start test environment with Redis and PostgreSQL."""
        print(f"🐳 Starting Docker test environment for {self.service_name}")

        # Start Redis container
        redis_cmd = [
            "docker", "run", "-d",
            "--name", f"test-redis-{self.service_name}",
            "-p", "6380:6379",  # Use different port to avoid conflicts
            "redis:7-alpine"
        ]

        redis_result = subprocess.run(redis_cmd, capture_output=True, text=True)
        if redis_result.returncode == 0:
            self.containers.append(f"test-redis-{self.service_name}")
            print("✅ Redis container started")
        else:
            raise RuntimeError(f"Failed to start Redis: {redis_result.stderr}")

        # Start PostgreSQL container
        postgres_cmd = [
            "docker", "run", "-d",
            "--name", f"test-postgres-{self.service_name}",
            "-e", "POSTGRES_PASSWORD=testpass",
            "-e", "POSTGRES_DB=test_markdown_manager",
            "-p", "5433:5432",  # Use different port to avoid conflicts
            "postgres:15-alpine"
        ]

        postgres_result = subprocess.run(postgres_cmd, capture_output=True, text=True)
        if postgres_result.returncode == 0:
            self.containers.append(f"test-postgres-{self.service_name}")
            print("✅ PostgreSQL container started")
        else:
            raise RuntimeError(f"Failed to start PostgreSQL: {postgres_result.stderr}")

        # Wait for containers to be ready
        await self._wait_for_services()

    async def _wait_for_services(self) -> None:
        """Wait for Redis and PostgreSQL to be ready."""
        print("⏳ Waiting for services to be ready...")

        # Wait for Redis
        for attempt in range(30):
            redis_check = subprocess.run([
                "docker", "exec", f"test-redis-{self.service_name}",
                "redis-cli", "ping"
            ], capture_output=True, text=True)

            if redis_check.returncode == 0 and "PONG" in redis_check.stdout:
                print("✅ Redis is ready")
                break

            await asyncio.sleep(1)
        else:
            raise RuntimeError("Redis failed to become ready")

        # Wait for PostgreSQL
        for attempt in range(30):
            postgres_check = subprocess.run([
                "docker", "exec", f"test-postgres-{self.service_name}",
                "pg_isready", "-U", "postgres"
            ], capture_output=True, text=True)

            if postgres_check.returncode == 0:
                print("✅ PostgreSQL is ready")
                break

            await asyncio.sleep(1)
        else:
            raise RuntimeError("PostgreSQL failed to become ready")

    async def run_tests(self) -> int:
        """Run consumer tests in Docker environment."""
        print(f"🧪 Running consumer tests for {self.service_name}")

        # Update config for Docker environment
        test_config = self.config.copy()
        test_config["redis"]["url"] = "redis://localhost:6380/0"

        # Create temporary config file
        config_file = Path(f"/tmp/{self.service_name}_docker_test_config.json")
        with open(config_file, "w") as f:
            json.dump(test_config, f, indent=2)

        try:
            # Run tests with Docker environment
            test_cmd = [
                "python", "-m", "pytest",
                str(Path(__file__).parent / "tests"),
                "-v",
                "--color=yes",
                "--tb=short",
                f"--junitxml=/tmp/{self.service_name}_test_results.xml",
                "--cov=app",
                f"--cov-report=html:/tmp/{self.service_name}_coverage",
            ]

            env = {
                "CONFIG_FILE": str(config_file),
                "DATABASE_URL": "postgresql://postgres:testpass@localhost:5433/test_markdown_manager",
                "REDIS_URL": "redis://localhost:6380/0",
                "PYTEST_CURRENT_SERVICE": self.service_name,
            }

            result = subprocess.run(test_cmd, env={**env, **subprocess.os.environ})
            return result.returncode

        finally:
            if config_file.exists():
                config_file.unlink()

    async def stop(self) -> None:
        """Stop and remove test containers."""
        print(f"🧹 Cleaning up Docker test environment for {self.service_name}")

        for container in self.containers:
            # Stop container
            subprocess.run(["docker", "stop", container], capture_output=True)
            # Remove container
            subprocess.run(["docker", "rm", container], capture_output=True)

        print("✅ Docker test environment cleaned up")


async def run_linting_tests() -> int:
    """Run tests for linting service in Docker environment."""
    config = {
        "service": {
            "name": "markdown-lint-consumer",
            "domain": "linting",
            "schema": "linting"
        },
        "redis": {
            "url": "redis://localhost:6379/0"
        },
        "consumer_group": "lint_group",
        "topics": ["identity.user.v1"]
    }

    env = DockerTestEnvironment("linting", config)

    try:
        await env.start()
        return await env.run_tests()
    finally:
        await env.stop()


async def run_spell_checking_tests() -> int:
    """Run tests for spell-checking service in Docker environment."""
    config = {
        "service": {
            "name": "spell-check-consumer",
            "domain": "spell_checking",
            "schema": "spell_checking"
        },
        "redis": {
            "url": "redis://localhost:6379/0"
        },
        "consumer_group": "spell_check_group",
        "topics": ["identity.user.v1"]
    }

    env = DockerTestEnvironment("spell_checking", config)

    try:
        await env.start()
        return await env.run_tests()
    finally:
        await env.stop()


async def run_all_service_tests() -> None:
    """Run tests for all consumer services."""
    print("🚀 Running tests for all consumer services")
    print("=" * 60)

    results = {}

    # Run linting tests
    try:
        results["linting"] = await run_linting_tests()
    except Exception as e:
        print(f"❌ Linting tests failed: {e}")
        results["linting"] = 1

    # Run spell-checking tests
    try:
        results["spell_checking"] = await run_spell_checking_tests()
    except Exception as e:
        print(f"❌ Spell-checking tests failed: {e}")
        results["spell_checking"] = 1

    # Summary
    print("\n" + "=" * 60)
    print("📊 Test Results Summary")
    print("=" * 60)

    for service, result in results.items():
        status = "✅ PASSED" if result == 0 else "❌ FAILED"
        print(f"{service:<20} {status}")

    total_failures = sum(1 for r in results.values() if r != 0)
    if total_failures == 0:
        print("\n🎉 All consumer service tests passed!")
    else:
        print(f"\n💥 {total_failures} service test suite(s) failed")


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        service = sys.argv[1]
        if service == "linting":
            result = asyncio.run(run_linting_tests())
        elif service == "spell_checking":
            result = asyncio.run(run_spell_checking_tests())
        else:
            print(f"Unknown service: {service}")
            result = 1
        sys.exit(result)
    else:
        asyncio.run(run_all_service_tests())