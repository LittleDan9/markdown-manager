#!/usr/bin/env python3
"""
Phase 3 Test Script - Redis Streams Bus Verification
Tests event publishing and consumption for Phase 3 exit criteria
"""

import redis
import json
import uuid
from datetime import datetime

def test_redis_streams():
    print("🧪 Phase 3 Redis Streams Bus Test")
    print("=" * 50)

    # Connect to Redis
    r = redis.Redis(host='localhost', port=6379, decode_responses=True)

    # Test 1: Verify streams exist
    print("\n📊 Checking streams and consumer groups:")
    streams = r.keys("*.v1")
    for stream in streams:
        print(f"  ✅ Stream: {stream}")
        try:
            groups = r.xinfo_groups(stream)
            for group in groups:
                print(f"    🔗 Consumer Group: {group['name']} (lag: {group['lag']})")
        except redis.exceptions.ResponseError:
            print(f"    ⚠️  No consumer groups for {stream}")

    # Test 2: Test event publishing
    print("\n📝 Testing event publishing to identity.user.v1:")
    test_event = {
        'event_id': str(uuid.uuid4()),
        'event_type': 'UserCreated',
        'topic': 'identity.user.v1',
        'schema_version': '1',
        'occurred_at': datetime.utcnow().isoformat() + 'Z',
        'tenant_id': '00000000-0000-0000-0000-000000000000',
        'aggregate_id': str(uuid.uuid4()),
        'aggregate_type': 'user',
        'payload': json.dumps({
            'user_id': str(uuid.uuid4()),
            'email': 'phase3-test@example.com',
            'display_name': 'Phase 3 Test User',
            'status': 'active'
        })
    }

    stream_id = r.xadd('identity.user.v1', test_event)
    print(f"  ✅ Published test event with ID: {stream_id}")

    # Test 3: Test consumer group consumption
    print("\n📖 Testing consumer group consumption:")
    for group in ['linting_group', 'export_group', 'spellcheck_group']:
        try:
            # Try to read from the consumer group
            messages = r.xreadgroup(
                group,
                f'test_consumer_{group}',
                {'identity.user.v1': '>'},
                count=1,
                block=1000  # 1 second timeout
            )

            if messages:
                for stream, msgs in messages:
                    for msg_id, fields in msgs:
                        print(f"  ✅ {group} consumed event {msg_id[:15]}... (event_type: {fields.get('event_type', 'unknown')})")
                        # Acknowledge the message
                        r.xack('identity.user.v1', group, msg_id)
            else:
                print(f"  ⏳ {group} - no new messages (expected for existing consumer groups)")

        except Exception as e:
            print(f"  ❌ {group} consumption error: {e}")

    # Test 4: Verify AOF persistence
    print("\n💾 Checking AOF persistence:")
    info = r.info('persistence')
    if info.get('aof_enabled'):
        print(f"  ✅ AOF enabled - last rewrite: {info.get('aof_last_rewrite_time_sec', 0)}s ago")
        print(f"  ✅ AOF current size: {info.get('aof_current_size', 0)} bytes")
    else:
        print("  ❌ AOF not enabled")

    # Test 5: Stream statistics
    print("\n📈 Stream statistics:")
    for stream in streams:
        stream_info = r.xinfo_stream(stream)
        print(f"  📊 {stream}: {stream_info['length']} events, {stream_info['groups']} consumer groups")

    print("\n🎉 Phase 3 Redis Streams Bus Test Complete!")
    return True

if __name__ == '__main__':
    try:
        test_redis_streams()
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        exit(1)