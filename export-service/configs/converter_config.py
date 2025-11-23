"""Configuration management for diagram converters."""

import os
from typing import Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum


class LogLevel(Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"


@dataclass
class PerformanceConfig:
    """Performance-related configuration."""
    enable_monitoring: bool = True
    enable_caching: bool = True
    max_cache_size: int = 1000
    icon_fetch_timeout: float = 5.0
    max_concurrent_icons: int = 10
    svg_parse_timeout: float = 30.0
    max_memory_usage_mb: float = 500.0  # Max memory usage per conversion


@dataclass
class QualityConfig:
    """Quality and validation configuration."""
    enable_validation: bool = True
    max_nodes: int = 1000
    max_edges: int = 2000
    max_source_length: int = 100000  # 100KB
    min_confidence_threshold: float = 0.6
    enable_xml_validation: bool = True
    enable_performance_warnings: bool = True


@dataclass
class ConverterConfig:
    """Main configuration for diagram converters."""
    # Environment
    environment: str = "development"
    debug_mode: bool = False
    log_level: LogLevel = LogLevel.INFO

    # Services
    icon_service_url: Optional[str] = None
    enable_icon_fetching: bool = True

    # Performance
    performance: PerformanceConfig = None

    # Quality
    quality: QualityConfig = None

    # Feature flags
    enable_architecture_diagrams: bool = True
    enable_flowchart_diagrams: bool = True
    enable_default_fallback: bool = True

    # Canvas settings
    default_canvas_width: int = 1000
    default_canvas_height: int = 600

    def __post_init__(self):
        if self.performance is None:
            self.performance = PerformanceConfig()
        if self.quality is None:
            self.quality = QualityConfig()

    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.environment.lower() == "production"

    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self.environment.lower() == "development"

    def get_log_level_value(self) -> str:
        """Get the log level as a string value."""
        return self.log_level.value

    def to_dict(self) -> Dict[str, Any]:
        """Convert configuration to dictionary for serialization."""
        return {
            "environment": self.environment,
            "debug_mode": self.debug_mode,
            "log_level": self.log_level.value,
            "icon_service_url": self.icon_service_url,
            "enable_icon_fetching": self.enable_icon_fetching,
            "performance": {
                "enable_monitoring": self.performance.enable_monitoring,
                "enable_caching": self.performance.enable_caching,
                "max_cache_size": self.performance.max_cache_size,
                "icon_fetch_timeout": self.performance.icon_fetch_timeout,
                "max_concurrent_icons": self.performance.max_concurrent_icons,
                "svg_parse_timeout": self.performance.svg_parse_timeout,
                "max_memory_usage_mb": self.performance.max_memory_usage_mb,
            },
            "quality": {
                "enable_validation": self.quality.enable_validation,
                "max_nodes": self.quality.max_nodes,
                "max_edges": self.quality.max_edges,
                "max_source_length": self.quality.max_source_length,
                "min_confidence_threshold": self.quality.min_confidence_threshold,
                "enable_xml_validation": self.quality.enable_xml_validation,
                "enable_performance_warnings": self.quality.enable_performance_warnings,
            },
            "feature_flags": {
                "enable_architecture_diagrams": self.enable_architecture_diagrams,
                "enable_flowchart_diagrams": self.enable_flowchart_diagrams,
                "enable_default_fallback": self.enable_default_fallback,
            },
            "canvas": {
                "default_width": self.default_canvas_width,
                "default_height": self.default_canvas_height,
            }
        }


class ConfigManager:
    """Manages configuration from environment and defaults."""

    @classmethod
    def from_environment(cls) -> ConverterConfig:
        """Create configuration from environment variables."""
        config = ConverterConfig()

        # Environment settings
        config.environment = os.getenv("ENVIRONMENT", "development")
        config.debug_mode = os.getenv("DEBUG_MODE", "false").lower() == "true"
        log_level_str = os.getenv("LOG_LEVEL", "INFO").upper()
        try:
            config.log_level = LogLevel(log_level_str)
        except ValueError:
            config.log_level = LogLevel.INFO

        # Service URLs
        config.icon_service_url = os.getenv("ICON_SERVICE_URL")
        config.enable_icon_fetching = os.getenv("ENABLE_ICON_FETCHING", "true").lower() == "true"

        # Performance settings
        perf_config = PerformanceConfig()
        perf_config.enable_monitoring = os.getenv("ENABLE_PERFORMANCE_MONITORING", "true").lower() == "true"
        perf_config.enable_caching = os.getenv("ENABLE_CACHING", "true").lower() == "true"
        perf_config.max_cache_size = int(os.getenv("MAX_CACHE_SIZE", "1000"))
        perf_config.icon_fetch_timeout = float(os.getenv("ICON_FETCH_TIMEOUT", "5.0"))
        perf_config.max_concurrent_icons = int(os.getenv("MAX_CONCURRENT_ICONS", "10"))
        perf_config.svg_parse_timeout = float(os.getenv("SVG_PARSE_TIMEOUT", "30.0"))
        perf_config.max_memory_usage_mb = float(os.getenv("MAX_MEMORY_USAGE_MB", "500.0"))
        config.performance = perf_config

        # Quality settings
        quality_config = QualityConfig()
        quality_config.enable_validation = os.getenv("ENABLE_VALIDATION", "true").lower() == "true"
        quality_config.max_nodes = int(os.getenv("MAX_NODES", "1000"))
        quality_config.max_edges = int(os.getenv("MAX_EDGES", "2000"))
        quality_config.max_source_length = int(os.getenv("MAX_SOURCE_LENGTH", "100000"))
        quality_config.min_confidence_threshold = float(os.getenv("MIN_CONFIDENCE_THRESHOLD", "0.6"))
        quality_config.enable_xml_validation = os.getenv("ENABLE_XML_VALIDATION", "true").lower() == "true"
        quality_config.enable_performance_warnings = os.getenv("ENABLE_PERFORMANCE_WARNINGS", "true").lower() == "true"
        config.quality = quality_config

        # Feature flags
        config.enable_architecture_diagrams = os.getenv("ENABLE_ARCHITECTURE_DIAGRAMS", "true").lower() == "true"
        config.enable_flowchart_diagrams = os.getenv("ENABLE_FLOWCHART_DIAGRAMS", "true").lower() == "true"
        config.enable_default_fallback = os.getenv("ENABLE_DEFAULT_FALLBACK", "true").lower() == "true"

        # Canvas settings
        config.default_canvas_width = int(os.getenv("DEFAULT_CANVAS_WIDTH", "1000"))
        config.default_canvas_height = int(os.getenv("DEFAULT_CANVAS_HEIGHT", "600"))

        return config

    @classmethod
    def for_testing(cls) -> ConverterConfig:
        """Create configuration optimized for testing."""
        config = ConverterConfig()
        config.environment = "testing"
        config.debug_mode = True
        config.log_level = LogLevel.DEBUG
        config.enable_icon_fetching = False  # Disable icon fetching in tests

        # Fast timeouts for testing
        config.performance.icon_fetch_timeout = 1.0
        config.performance.svg_parse_timeout = 5.0
        config.performance.max_memory_usage_mb = 100.0

        # Relaxed validation for testing
        config.quality.min_confidence_threshold = 0.1
        config.quality.enable_performance_warnings = False

        return config

    @classmethod
    def for_production(cls) -> ConverterConfig:
        """Create configuration optimized for production."""
        config = cls.from_environment()
        config.environment = "production"
        config.debug_mode = False
        config.log_level = LogLevel.INFO

        # Strict production settings with comprehensive validation
        config.performance.max_memory_usage_mb = 200.0  # Stricter memory limits
        config.performance.enable_monitoring = True  # Always monitor in production

        # Enhanced validation for production security and reliability
        config.quality.enable_validation = True
        config.quality.enable_xml_validation = True
        config.quality.enable_performance_warnings = True
        config.quality.min_confidence_threshold = 0.7  # Higher confidence required
        config.quality.max_nodes = 500  # Lower limits for production stability
        config.quality.max_edges = 1000  # Lower limits for production stability
        config.quality.max_source_length = 50000  # 50KB limit for production

        return config

    @classmethod
    def get_default(cls) -> ConverterConfig:
        """Get default configuration."""
        return ConverterConfig()


# Global configuration instance (can be overridden)
_global_config: Optional[ConverterConfig] = None


def get_config() -> ConverterConfig:
    """Get the current global configuration."""
    global _global_config
    if _global_config is None:
        _global_config = ConfigManager.from_environment()
    return _global_config


def set_config(config: ConverterConfig):
    """Set the global configuration."""
    global _global_config
    _global_config = config


def reset_config():
    """Reset configuration to default from environment."""
    global _global_config
    _global_config = None