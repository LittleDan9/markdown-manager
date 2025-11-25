#!/usr/bin/env python3
"""
DLQ (Dead Letter Queue) inspection and recovery tool.

This script provides utilities for:
- Inspecting failed messages in DLQ streams
- Reprocessing messages after fixes
- Marking messages as resolved
- Generating DLQ reports

Usage:
    python dlq_tool.py list --stream identity.dlq
    python dlq_tool.py inspect --stream identity.dlq --id 1700000000000-0
    python dlq_tool.py reprocess --stream identity.dlq --id 1700000000000-0
    python dlq_tool.py resolve --stream identity.dlq --id 1700000000000-0
    python dlq_tool.py report --stream identity.dlq --hours 24
"""

import argparse
import asyncio
import json
import logging
import sys
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any, Optional

import aioredis
from tabulate import tabulate

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class DLQManager:
    """Manager for DLQ operations."""

    def __init__(self, redis_url: str = "redis://localhost:6379"):
        """Initialize DLQ manager."""
        self.redis_url = redis_url
        self.redis = None

    async def connect(self):
        """Connect to Redis."""
        self.redis = aioredis.from_url(self.redis_url, decode_responses=True)
        await self.redis.ping()
        logger.info("Connected to Redis")

    async def disconnect(self):
        """Disconnect from Redis."""
        if self.redis:
            await self.redis.close()

    async def list_dlq_messages(self, stream_name: str, count: int = 50) -> List[Dict[str, Any]]:
        """List messages in DLQ stream."""
        try:
            # Get messages from stream (newest first)
            messages = await self.redis.xrevrange(stream_name, count=count)

            parsed_messages = []
            for message_id, fields in messages:
                parsed_message = {
                    "dlq_id": message_id,
                    "original_event_id": fields.get("original_event_id"),
                    "event_type": fields.get("event_type"),
                    "aggregate_id": fields.get("aggregate_id"),
                    "error_message": fields.get("error_message"),
                    "attempts": fields.get("attempts"),
                    "failed_at": fields.get("failed_at"),
                    "created_at": fields.get("created_at")
                }
                parsed_messages.append(parsed_message)

            return parsed_messages

        except Exception as e:
            logger.error(f"Failed to list DLQ messages: {e}")
            return []

    async def inspect_message(self, stream_name: str, message_id: str) -> Optional[Dict[str, Any]]:
        """Inspect a specific DLQ message."""
        try:
            # Get specific message
            messages = await self.redis.xrange(stream_name, min=message_id, max=message_id)

            if not messages:
                logger.error(f"Message {message_id} not found in {stream_name}")
                return None

            _, fields = messages[0]

            # Parse payload if it exists
            payload = fields.get("payload")
            if payload:
                try:
                    payload = json.loads(payload)
                except json.JSONDecodeError:
                    logger.warning("Failed to parse payload as JSON")

            return {
                "dlq_id": message_id,
                "original_event_id": fields.get("original_event_id"),
                "event_type": fields.get("event_type"),
                "aggregate_id": fields.get("aggregate_id"),
                "payload": payload,
                "error_message": fields.get("error_message"),
                "attempts": fields.get("attempts"),
                "failed_at": fields.get("failed_at"),
                "created_at": fields.get("created_at")
            }

        except Exception as e:
            logger.error(f"Failed to inspect message: {e}")
            return None

    async def reprocess_message(self, stream_name: str, message_id: str,
                              target_stream: str = None) -> bool:
        """Reprocess a DLQ message by republishing to original stream."""
        try:
            # Get the message details
            message = await self.inspect_message(stream_name, message_id)
            if not message:
                return False

            # Determine target stream (strip .dlq suffix if not provided)
            if not target_stream:
                target_stream = stream_name.replace(".dlq", "")

            # Create new event envelope for reprocessing
            envelope = {
                "event_id": message["original_event_id"],
                "event_type": message["event_type"],
                "topic": target_stream,
                "schema_version": "1",
                "occurred_at": datetime.now(timezone.utc).isoformat(),
                "tenant_id": message.get("payload", {}).get("tenant_id", "00000000-0000-0000-0000-000000000000"),
                "aggregate_id": message["aggregate_id"],
                "aggregate_type": message.get("payload", {}).get("aggregate_type", "unknown"),
                "payload": json.dumps(message["payload"]) if message["payload"] else "{}"
            }

            # Publish to target stream
            new_id = await self.redis.xadd(target_stream, envelope, maxlen=10000)

            # Mark original DLQ message as resolved
            await self.mark_resolved(stream_name, message_id)

            logger.info(f"Reprocessed message {message_id} -> {target_stream} (new ID: {new_id})")
            return True

        except Exception as e:
            logger.error(f"Failed to reprocess message: {e}")
            return False

    async def mark_resolved(self, stream_name: str, message_id: str) -> bool:
        """Mark DLQ message as resolved by adding resolution metadata."""
        try:
            resolved_stream = f"{stream_name}.resolved"

            # Get original message
            message = await self.inspect_message(stream_name, message_id)
            if not message:
                return False

            # Create resolution record
            resolution_data = {
                "original_dlq_id": message_id,
                "original_event_id": message["original_event_id"],
                "resolved_at": datetime.now(timezone.utc).isoformat(),
                "resolution_method": "manual"
            }

            # Add to resolved stream
            await self.redis.xadd(resolved_stream, resolution_data, maxlen=1000)

            # Remove from DLQ (optional - you might want to keep for audit)
            # await self.redis.xdel(stream_name, message_id)

            logger.info(f"Marked message {message_id} as resolved")
            return True

        except Exception as e:
            logger.error(f"Failed to mark message as resolved: {e}")
            return False

    async def get_dlq_report(self, stream_name: str, hours: int = 24) -> Dict[str, Any]:
        """Generate DLQ report for specified time window."""
        try:
            # Calculate time window
            end_time = datetime.now(timezone.utc)
            start_time = end_time - timedelta(hours=hours)

            # Get all messages in DLQ
            messages = await self.redis.xrange(stream_name)

            # Filter by time window and analyze
            recent_messages = []
            error_counts = {}
            event_type_counts = {}

            for message_id, fields in messages:
                failed_at_str = fields.get("failed_at")
                if failed_at_str:
                    try:
                        failed_at = datetime.fromisoformat(failed_at_str.replace('Z', '+00:00'))
                        if failed_at >= start_time:
                            recent_messages.append((message_id, fields))

                            # Count errors
                            error_msg = fields.get("error_message", "Unknown error")
                            error_counts[error_msg] = error_counts.get(error_msg, 0) + 1

                            # Count event types
                            event_type = fields.get("event_type", "Unknown")
                            event_type_counts[event_type] = event_type_counts.get(event_type, 0) + 1

                    except ValueError:
                        continue  # Skip messages with invalid timestamps

            return {
                "time_window_hours": hours,
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat(),
                "total_failed_messages": len(recent_messages),
                "top_errors": dict(sorted(error_counts.items(), key=lambda x: x[1], reverse=True)[:10]),
                "event_types": dict(sorted(event_type_counts.items(), key=lambda x: x[1], reverse=True)),
                "recent_messages": len(recent_messages)
            }

        except Exception as e:
            logger.error(f"Failed to generate DLQ report: {e}")
            return {}


async def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(description="DLQ Management Tool")
    parser.add_argument("--redis-url", default="redis://localhost:6379",
                       help="Redis connection URL")

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # List command
    list_parser = subparsers.add_parser("list", help="List DLQ messages")
    list_parser.add_argument("--stream", required=True, help="DLQ stream name")
    list_parser.add_argument("--count", type=int, default=50, help="Number of messages to show")

    # Inspect command
    inspect_parser = subparsers.add_parser("inspect", help="Inspect specific message")
    inspect_parser.add_argument("--stream", required=True, help="DLQ stream name")
    inspect_parser.add_argument("--id", required=True, help="Message ID")

    # Reprocess command
    reprocess_parser = subparsers.add_parser("reprocess", help="Reprocess DLQ message")
    reprocess_parser.add_argument("--stream", required=True, help="DLQ stream name")
    reprocess_parser.add_argument("--id", required=True, help="Message ID")
    reprocess_parser.add_argument("--target", help="Target stream (default: remove .dlq suffix)")

    # Resolve command
    resolve_parser = subparsers.add_parser("resolve", help="Mark message as resolved")
    resolve_parser.add_argument("--stream", required=True, help="DLQ stream name")
    resolve_parser.add_argument("--id", required=True, help="Message ID")

    # Report command
    report_parser = subparsers.add_parser("report", help="Generate DLQ report")
    report_parser.add_argument("--stream", required=True, help="DLQ stream name")
    report_parser.add_argument("--hours", type=int, default=24, help="Time window in hours")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    # Initialize DLQ manager
    dlq_manager = DLQManager(args.redis_url)

    try:
        await dlq_manager.connect()

        if args.command == "list":
            messages = await dlq_manager.list_dlq_messages(args.stream, args.count)
            if messages:
                headers = ["DLQ ID", "Event ID", "Type", "Error", "Failed At"]
                rows = []
                for msg in messages:
                    rows.append([
                        msg["dlq_id"][:16] + "...",
                        msg["original_event_id"][:16] + "..." if msg["original_event_id"] else "N/A",
                        msg["event_type"],
                        (msg["error_message"][:50] + "...") if len(msg["error_message"] or "") > 50 else msg["error_message"],
                        msg["failed_at"]
                    ])
                print(tabulate(rows, headers=headers, tablefmt="grid"))
            else:
                print(f"No messages found in {args.stream}")

        elif args.command == "inspect":
            message = await dlq_manager.inspect_message(args.stream, args.id)
            if message:
                print(json.dumps(message, indent=2))
            else:
                print(f"Message {args.id} not found")

        elif args.command == "reprocess":
            success = await dlq_manager.reprocess_message(args.stream, args.id, args.target)
            if success:
                print(f"Successfully reprocessed message {args.id}")
            else:
                print(f"Failed to reprocess message {args.id}")

        elif args.command == "resolve":
            success = await dlq_manager.mark_resolved(args.stream, args.id)
            if success:
                print(f"Successfully marked message {args.id} as resolved")
            else:
                print(f"Failed to mark message {args.id} as resolved")

        elif args.command == "report":
            report = await dlq_manager.get_dlq_report(args.stream, args.hours)
            if report:
                print(json.dumps(report, indent=2))
            else:
                print("Failed to generate report")

    except Exception as e:
        logger.error(f"Command failed: {e}")
        sys.exit(1)
    finally:
        await dlq_manager.disconnect()


if __name__ == "__main__":
    asyncio.run(main())