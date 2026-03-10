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


async def start_http_server(settings: Settings, relay: OutboxRelay):
    """Start HTTP health check server."""
    app = FastAPI(title="Event Publisher Health Check")
    
    # Setup health endpoints
    def get_session_factory():
        from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
        engine = create_async_engine(settings.database_url)
        return async_sessionmaker(engine, expire_on_commit=False)
    
    session_factory = get_session_factory()
    setup_health_endpoints(app, settings, session_factory)
    
    # Add relay status endpoint
    @app.get("/status")
    async def relay_status():
        """Get relay service status."""
        return {
            "status": "running" if relay and relay.is_running() else "stopped",
            "service": "event-publisher",
            "version": "1.0.0"
        }
    
    config = uvicorn.Config(
        app=app,
        host="0.0.0.0",
        port=settings.http_port,
        log_level="info"
    )
    server = uvicorn.Server(config)
    await server.serve()


async def main():
    """Main relay service with HTTP health server."""
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
        
        logger.info(f"Starting HTTP health server on port {settings.http_port}")

        # Start both HTTP server and relay processing concurrently
        async with asyncio.TaskGroup() as tg:
            # Start HTTP health server
            health_task = tg.create_task(start_http_server(settings, relay))
            
            # Start relay processing
            relay_task = tg.create_task(relay.run(shutdown_flag))
            
            # Wait for shutdown signal
            await shutdown_flag.wait()
            
            # Cancel tasks gracefully
            health_task.cancel()
            relay_task.cancel()

    except* (asyncio.CancelledError, Exception) as eg:
        for exc in eg.exceptions:
            if isinstance(exc, asyncio.CancelledError):
                logger.info("Services cancelled during shutdown")
            else:
                logger.error(f"Relay service error: {exc}", exc_info=True)
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