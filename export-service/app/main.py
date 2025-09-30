"""Export Service - Main Application using App Factory Pattern."""
import logging

import uvicorn

from app.app_factory import create_app

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


class AppInitializer:
    """Application initializer for startup sequence."""

    def __init__(self):
        """Initialize the app initializer."""
        self.logger = logging.getLogger("export-service.initializer")

    def start_server(self) -> None:
        """Start the uvicorn server."""
        self.logger.info("Starting Export Service on 0.0.0.0:8001")

        uvicorn.run(
            "app.main:create_app",
            host="0.0.0.0",
            port=8001,
            reload=True,
            factory=True,
            log_level="info",
            access_log=True,
        )

    def run(self) -> None:
        """Run the application initialization sequence."""
        self.logger.info("Starting Export Service initializer")
        self.start_server()


# Create the FastAPI app using the factory
app = create_app()


def main() -> None:
    """Main entry point for running the application."""
    initializer = AppInitializer()
    initializer.run()


if __name__ == "__main__":
    main()
