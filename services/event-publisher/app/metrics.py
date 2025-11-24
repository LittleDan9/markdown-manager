"""Metrics collection and reporting for relay service."""

import asyncio
import logging
import time
from collections import defaultdict
from typing import Dict, Any
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class RelayMetrics:
    """Metrics collector for relay service operations."""

    def __init__(self):
        """Initialize metrics collector."""
        self.events_published_total = defaultdict(int)  # {topic: count}
        self.events_dlq_total = defaultdict(int)  # {topic: count}
        self.outbox_backlog_current = 0
        self.publish_success_total = 0
        self.publish_failure_total = 0
        self.last_publish_timestamp = None
        self.processing_errors = []
        self.start_time = time.time()

    def increment_published(self, topic: str):
        """Increment published events counter."""
        self.events_published_total[topic] += 1
        self.publish_success_total += 1
        self.last_publish_timestamp = datetime.now(timezone.utc)

    def increment_dlq(self, topic: str):
        """Increment DLQ events counter."""
        self.events_dlq_total[topic] += 1

    def increment_failure(self):
        """Increment failure counter."""
        self.publish_failure_total += 1

    def set_outbox_backlog(self, count: int):
        """Set current outbox backlog count."""
        self.outbox_backlog_current = count

    def add_error(self, error: str, event_id: str = None):
        """Add processing error to recent errors list."""
        error_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "error": error,
            "event_id": event_id
        }
        self.processing_errors.append(error_entry)

        # Keep only last 50 errors
        if len(self.processing_errors) > 50:
            self.processing_errors = self.processing_errors[-50:]

    def get_metrics(self) -> Dict[str, Any]:
        """Get current metrics snapshot."""
        uptime_seconds = time.time() - self.start_time

        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "uptime_seconds": round(uptime_seconds, 2),
            "events_published_total": dict(self.events_published_total),
            "events_dlq_total": dict(self.events_dlq_total),
            "outbox_backlog": self.outbox_backlog_current,
            "publish_success_total": self.publish_success_total,
            "publish_failure_total": self.publish_failure_total,
            "last_publish_timestamp": self.last_publish_timestamp.isoformat() if self.last_publish_timestamp else None,
            "recent_errors": self.processing_errors[-10:],  # Last 10 errors
            "success_rate": self._calculate_success_rate()
        }

    def _calculate_success_rate(self) -> float:
        """Calculate success rate percentage."""
        total_attempts = self.publish_success_total + self.publish_failure_total
        if total_attempts == 0:
            return 100.0
        return round((self.publish_success_total / total_attempts) * 100, 2)

    def reset_metrics(self):
        """Reset all metrics (for admin use)."""
        self.events_published_total.clear()
        self.events_dlq_total.clear()
        self.outbox_backlog_current = 0
        self.publish_success_total = 0
        self.publish_failure_total = 0
        self.last_publish_timestamp = None
        self.processing_errors.clear()
        self.start_time = time.time()
        logger.info("Relay metrics reset")


# Global metrics instance
relay_metrics = RelayMetrics()