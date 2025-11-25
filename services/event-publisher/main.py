#!/usr/bin/env python3
"""Relay service main entry point."""

import asyncio
import logging
import signal
import sys
from typing import Optional

from fastapi import FastAPI
import uvicorn

from app.config import Settings
from app.relay import OutboxRelay
from app.health import setup_health_endpoints

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)

# Global shutdown flag
shutdown_flag = asyncio.Event()


def signal_handler(signum, frame):
    """Handle shutdown signals."""
    logger.info(f"Received signal {signum}, initiating shutdown...")
    shutdown_flag.set()


async def main():
    """Main relay service loop."""
    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Load configuration
    settings = Settings()
    logger.info(f"Starting relay service with settings: {settings.model_dump()}")

    # Create relay instance
    relay = OutboxRelay(settings)

    try:
        # Initialize connections
        await relay.initialize()
        logger.info("Relay service initialized successfully")

        # Start processing loop
        await relay.run(shutdown_flag)

    except Exception as e:
        logger.error(f"Relay service error: {e}", exc_info=True)
        sys.exit(1)
    finally:
        # Cleanup
        await relay.cleanup()
        logger.info("Relay service shutdown complete")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Relay service interrupted by user")
    except Exception as e:
        logger.error(f"Relay service failed: {e}", exc_info=True)
        sys.exit(1)