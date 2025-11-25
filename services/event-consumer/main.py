#!/usr/bin/env python3
"""Configurable Consumer Service main entry point."""

import asyncio
import json
import logging
import signal
import sys
from pathlib import Path

from app.consumer import ConfigurableConsumer

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


def load_config():
    """Load service configuration from JSON file."""
    config_path = Path("/app/config/consumer.config.json")
    if not config_path.exists():
        logger.error(f"Configuration file not found: {config_path}")
        logger.error("Make sure to mount the config file:")
        logger.error("  -v ./service/consumer.config.json:/app/config/consumer.config.json:ro")
        sys.exit(1)

    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
        logger.info(f"Loaded configuration for service: {config['service']['name']}")
        return config
    except Exception as e:
        logger.error(f"Failed to load configuration: {e}")
        sys.exit(1)


async def main():
    """Main consumer service loop."""
    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Load configuration
    config = load_config()
    logger.info(f"Starting configurable consumer service: {config['service']['name']}")

    # Create consumer instance
    consumer = ConfigurableConsumer(config)

    try:
        # Initialize connections
        await consumer.initialize()
        logger.info("Configurable consumer service initialized successfully")

        # Start processing loop
        await consumer.run(shutdown_flag)

    except Exception as e:
        logger.error(f"Configurable consumer service error: {e}", exc_info=True)
        sys.exit(1)
    finally:
        # Cleanup
        await consumer.cleanup()
        logger.info("Configurable consumer service shutdown complete")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Configurable consumer service interrupted by user")
    except Exception as e:
        logger.error(f"Configurable consumer service failed: {e}", exc_info=True)
        sys.exit(1)