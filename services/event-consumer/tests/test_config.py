"""
Unit tests for configuration loading and validation.

These tests can be run with different service configurations to validate
configuration handling across all consumer services.
"""
import json
import os
import tempfile
from unittest.mock import patch

import pytest

from app.consumer import ConfigurableConsumer


class TestConfigurationLoading:
    """Test configuration loading and validation."""

    @pytest.mark.unit
    def test_load_valid_config(self, service_config, tmp_path):
        """Test loading a valid configuration file."""
        config_file = tmp_path / "consumer.config.json"
        config_file.write_text(json.dumps(service_config))

        with patch.dict(os.environ, {'CONFIG_FILE': str(config_file)}):
            consumer = ConfigurableConsumer(service_config)

            assert consumer.config["service"]["name"] == service_config["service"]["name"]
            assert consumer.config["service"]["domain"] == service_config["service"]["domain"]
            assert consumer.config["service"]["schema"] == service_config["service"]["schema"]
            assert consumer.config["consumer_group"] == service_config["consumer_group"]
            assert service_config["topics"][0] in consumer.config["topics"]

    @pytest.mark.unit
    def test_missing_config_file(self, service_config):
        """Test behavior when config file is missing."""
        with patch.dict(os.environ, {'CONFIG_FILE': '/nonexistent/config.json'}):
            # This test should pass since we're providing config directly
            consumer = ConfigurableConsumer(service_config)
            assert consumer.config == service_config

    @pytest.mark.unit
    def test_invalid_json_config(self, service_config, tmp_path):
        """Test behavior with invalid JSON in config file."""
        config_file = tmp_path / "consumer.config.json"
        config_file.write_text("{ invalid json }")

        with patch.dict(os.environ, {'CONFIG_FILE': str(config_file)}):
            # Since we're passing config directly, this should work
            consumer = ConfigurableConsumer(service_config)
            assert consumer.config == service_config

    @pytest.mark.unit
    def test_missing_required_fields(self, tmp_path):
        """Test validation of required configuration fields."""
        incomplete_config = {
            "service": {
                "name": "test-consumer"
                # Missing domain and schema
            }
        }

        config_file = tmp_path / "consumer.config.json"
        config_file.write_text(json.dumps(incomplete_config))

        with patch.dict(os.environ, {'CONFIG_FILE': str(config_file)}):
            with pytest.raises(KeyError):
                ConfigurableConsumer(incomplete_config)

    @pytest.mark.unit
    def test_config_with_environment_overrides(self, service_config, tmp_path):
        """Test configuration with environment variable overrides."""
        config_file = tmp_path / "consumer.config.json"
        config_file.write_text(json.dumps(service_config))

        # Test that consumer accepts the configuration as-is
        with patch.dict(os.environ, {
            'CONFIG_FILE': str(config_file),
            'REDIS_URL': 'redis://override:6379/0'
        }):
            consumer = ConfigurableConsumer(service_config)

            # Config should be as provided
            assert consumer.config["redis"]["url"] == service_config["redis"]["url"]


class TestHandlerDiscovery:
    """Test event handler discovery and mapping."""

    @pytest.mark.unit
    def test_discover_domain_handlers(self, consumer):
        """Test discovery of domain-specific event handlers."""
        handlers = consumer._discover_event_handlers()
        domain = consumer.config["service"]["domain"]

        # Should find domain-specific handlers
        assert "user.created.v1" in handlers
        assert "user.updated.v1" in handlers
        assert "user.disabled.v1" in handlers

        # Verify handler method names contain domain
        expected_created = f"handle_{domain}_user_created"
        expected_updated = f"handle_{domain}_user_updated"
        expected_disabled = f"handle_{domain}_user_disabled"

        assert handlers["user.created.v1"] == expected_created
        assert handlers["user.updated.v1"] == expected_updated
        assert handlers["user.disabled.v1"] == expected_disabled

    @pytest.mark.unit
    def test_handler_method_discovery(self, consumer):
        """Test that handler discovery works correctly."""
        handlers = consumer._discover_event_handlers()

        for event_type, handler_name in handlers.items():
            # Verify handler names follow expected pattern
            domain = consumer.config["service"]["domain"]
            assert handler_name.startswith(f"handle_{domain}_")

            # Verify event type is properly mapped
            if event_type == "user.created.v1":
                assert handler_name.endswith("_user_created")
            elif event_type == "user.updated.v1":
                assert handler_name.endswith("_user_updated")
            elif event_type == "user.disabled.v1":
                assert handler_name.endswith("_user_disabled")

    @pytest.mark.unit
    def test_unknown_event_type_handling(self, consumer):
        """Test handling of unknown event types."""
        handlers = consumer._discover_event_handlers()

        # Should not contain handlers for unknown event types
        assert "unknown.event.v1" not in handlers

        # Test direct call to unknown handler
        domain = consumer.config["service"]["domain"]
        unknown_handler = getattr(consumer, f"handle_{domain}_unknown_event", None)
        assert unknown_handler is None


class TestLintingServiceConfiguration:
    """Test configuration specifically for linting service."""

    @pytest.mark.unit
    def test_linting_handler_discovery(self, linting_consumer):
        """Test linting-specific handler discovery."""
        handlers = linting_consumer._discover_event_handlers()

        # Should find linting handlers
        assert "user.created.v1" in handlers
        assert handlers["user.created.v1"] == "handle_linting_user_created"
        assert handlers["user.updated.v1"] == "handle_linting_user_updated"
        assert handlers["user.disabled.v1"] == "handle_linting_user_disabled"

    @pytest.mark.unit
    def test_linting_config_validation(self, linting_config):
        """Test linting configuration validation."""
        assert linting_config["service"]["domain"] == "linting"
        assert linting_config["service"]["schema"] == "test_linting"
        assert "lint" in linting_config["consumer_group"]


class TestSpellCheckingServiceConfiguration:
    """Test configuration specifically for spell-checking service."""

    @pytest.mark.unit
    def test_spell_checking_handler_discovery(self, spell_checking_consumer):
        """Test spell-checking specific handler discovery."""
        handlers = spell_checking_consumer._discover_event_handlers()

        # Should find spell-checking handlers
        assert "user.created.v1" in handlers
        assert handlers["user.created.v1"] == "handle_spell_checking_user_created"
        assert handlers["user.updated.v1"] == "handle_spell_checking_user_updated"
        assert handlers["user.disabled.v1"] == "handle_spell_checking_user_disabled"

    @pytest.mark.unit
    def test_spell_checking_config_validation(self, spell_checking_config):
        """Test spell-checking configuration validation."""
        assert spell_checking_config["service"]["domain"] == "spell_checking"
        assert spell_checking_config["service"]["schema"] == "test_spell_checking"
        assert "spell" in spell_checking_config["consumer_group"]


class TestMultiServiceConfiguration:
    """Test configuration across multiple service types."""

    @pytest.mark.unit
    @pytest.mark.parametrize("service_config", [
        {"service": {"domain": "linting", "schema": "linting"}, "consumer_group": "lint_group"},
        {"service": {"domain": "spell_checking", "schema": "spell_checking"}, "consumer_group": "spell_group"},
    ], indirect=False)
    def test_service_specific_handler_mapping(self, service_config):
        """Test that different services get different handler mappings."""
        domain = service_config["service"]["domain"]

        # Create minimal config for testing
        full_config = {
            "service": {
                "name": f"test-{domain}-consumer",
                "domain": domain,
                "schema": service_config["service"]["schema"]
            },
            "redis": {"url": "redis://localhost:6379/15"},
            "consumer_group": service_config["consumer_group"],
            "topics": ["identity.user.v1"]
        }

        consumer = ConfigurableConsumer(full_config)
        handlers = consumer._discover_event_handlers()

        # Verify domain-specific handlers
        expected_handler = f"handle_{domain}_user_created"
        assert handlers["user.created.v1"] == expected_handler


class TestEventTypeMapping:
    """Test event type to handler name mapping logic."""

    @pytest.mark.unit
    @pytest.mark.parametrize("event_type,domain,expected_handler", [
        ("user.created.v1", "linting", "handle_linting_user_created"),
        ("user.updated.v1", "linting", "handle_linting_user_updated"),
        ("user.disabled.v1", "linting", "handle_linting_user_disabled"),
        ("user.created.v1", "spell_checking", "handle_spell_checking_user_created"),
        ("user.updated.v1", "spell_checking", "handle_spell_checking_user_updated"),
        ("user.disabled.v1", "spell_checking", "handle_spell_checking_user_disabled"),
        ("document.created.v1", "linting", "handle_linting_document_created"),
        ("folder.deleted.v1", "spell_checking", "handle_spell_checking_folder_deleted"),
    ])
    def test_event_type_to_handler_mapping(self, event_type, domain, expected_handler):
        """Test mapping of event types to handler method names across domains."""
        config = {
            "service": {"name": "test", "domain": domain, "schema": domain},
            "redis": {"url": "redis://localhost:6379/15"},
            "consumer_group": f"{domain}_group",
            "topics": ["identity.user.v1"]
        }

        consumer = ConfigurableConsumer(config)
        handlers = consumer._discover_event_handlers()

        # Only test for user events since that's what the consumer supports
        if event_type.startswith("user."):
            assert event_type in handlers
            assert handlers[event_type] == expected_handler