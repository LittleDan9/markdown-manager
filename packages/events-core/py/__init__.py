"""Events Core - Event schemas and Pydantic models for markdown-manager microservices."""

__version__ = "1.0.0"

# Import generated models after they are created
try:
    from .models import *
except ImportError:
    # Models not generated yet
    pass

from .validators import EventValidator, EventTypes, Topics

__all__ = [
    "EventValidator",
    "EventTypes",
    "Topics",
]