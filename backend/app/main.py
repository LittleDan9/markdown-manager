"""FastAPI main application with app factory pattern."""
import logging

import uvicorn

from app.app_factory import create_app
from app.core.config import settings
from app.database import create_tables

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class AppInitializer:
    """Application initializer for startup sequence."""

    def __init__(self):
        """Initialize the app initializer."""
        self.logger = logging.getLogger("app.initializer")

    async def initialize_database(self) -> None:
        """Initialize database tables."""
        self.logger.info("Initializing database...")
        await create_tables()
        self.logger.info("Database initialization complete")

    def start_server(self) -> None:
        """Start the uvicorn server."""
        self.logger.info(f"Starting server on {settings.host}:{settings.port}")
        self.logger.info(f"Debug mode: {settings.debug}")

        uvicorn.run(
            "app.main:create_app",
            host=settings.host,
            port=settings.port,
            reload=settings.debug,
            factory=True,
            log_level="info" if not settings.debug else "debug",
            access_log=True,
        )

    def run(self) -> None:
        """Run the application initialization sequence."""
        self.logger.info("Starting application initializer")
        # Note: Database initialization is handled in the lifespan context
        # of the FastAPI app, so we just start the server here
        self.start_server()


# Create the FastAPI app using the factory
app = create_app()


def main() -> None:
    """Main entry point for running the application."""
    initializer = AppInitializer()
    initializer.run()


if __name__ == "__main__":
    main()
