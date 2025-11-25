"""Metrics collection and reporting for consumer services."""

import asyncio
import logging
import time
from collections import defaultdict
from typing import Dict, Any
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class ConsumerMetrics:
    """Metrics collector for consumer service operations."""

    def __init__(self, service_name: str, consumer_group: str):
        """Initialize metrics collector."""
        self.service_name = service_name
        self.consumer_group = consumer_group
        self.events_consumed_total = defaultdict(int)  # {topic: count}
        self.events_processed_success = 0
        self.events_processed_failure = 0
        self.last_consumed_timestamp = None
        self.last_processed_event_id = None
        self.consumer_lag_seconds = 0
        self.processing_errors = []
        self.start_time = time.time()

    def increment_consumed(self, topic: str, event_id: str):
        """Increment consumed events counter."""
        self.events_consumed_total[topic] += 1
        self.events_processed_success += 1
        self.last_consumed_timestamp = datetime.now(timezone.utc)
        self.last_processed_event_id = event_id

    def increment_failure(self, error: str, event_id: str = None):
        """Increment failure counter and log error."""
        self.events_processed_failure += 1
        self.add_error(error, event_id)

    def set_consumer_lag(self, lag_seconds: float):
        """Set current consumer lag in seconds."""
        self.consumer_lag_seconds = lag_seconds

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
            "service_name": self.service_name,
            "consumer_group": self.consumer_group,
            "uptime_seconds": round(uptime_seconds, 2),
            "events_consumed_total": dict(self.events_consumed_total),
            "events_processed_success": self.events_processed_success,
            "events_processed_failure": self.events_processed_failure,
            "consumer_lag_seconds": round(self.consumer_lag_seconds, 2),
            "last_consumed_timestamp": (self.last_consumed_timestamp.isoformat()
                                      if self.last_consumed_timestamp else None),
            "last_processed_event_id": self.last_processed_event_id,
            "recent_errors": self.processing_errors[-10:],  # Last 10 errors
            "success_rate": self._calculate_success_rate()
        }

    def _calculate_success_rate(self) -> float:
        """Calculate success rate percentage."""
        total_processed = self.events_processed_success + self.events_processed_failure
        if total_processed == 0:
            return 100.0
        return round((self.events_processed_success / total_processed) * 100, 2)

    def reset_metrics(self):
        """Reset all metrics (for admin use)."""
        self.events_consumed_total.clear()
        self.events_processed_success = 0
        self.events_processed_failure = 0
        self.last_consumed_timestamp = None
        self.last_processed_event_id = None
        self.consumer_lag_seconds = 0
        self.processing_errors.clear()
        self.start_time = time.time()
        logger.info(f"Consumer metrics reset for {self.service_name}")