/**
 * Outbox Event Relay Service
 * Phase 5: Publishes events from spell.outbox to Redis Streams
 *
 * This service implements the outbox pattern to ensure reliable event delivery:
 * 1. Polls spell.outbox table for unprocessed events
 * 2. Publishes events to appropriate Redis Streams
 * 3. Marks events as processed after successful publication
 * 4. Handles failures with retry logic and dead letter processing
 */

const Redis = require('ioredis');
const spellDatabase = require('../lib/database/models');
const { v4: uuidv4 } = require('uuid');

class OutboxRelay {
  constructor(config = {}) {
    this.config = {
      redis: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || null,
        db: process.env.REDIS_DB || 0,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true
      },
      polling: {
        interval: process.env.OUTBOX_POLL_INTERVAL || 5000, // 5 seconds
        batchSize: process.env.OUTBOX_BATCH_SIZE || 50,
        maxRetries: process.env.OUTBOX_MAX_RETRIES || 3,
        retryDelay: process.env.OUTBOX_RETRY_DELAY || 10000 // 10 seconds
      },
      streams: {
        dictionaryUpdated: 'dict.updated.v1',
        deadLetter: 'outbox.dead-letter.v1'
      },
      ...config
    };

    this.redis = null;
    this.isRunning = false;
    this.pollTimer = null;
    this.stats = {
      processed: 0,
      published: 0,
      failed: 0,
      retried: 0,
      deadLettered: 0
    };
  }

  /**
   * Initialize the outbox relay (ServiceManager compatibility)
   */
  async init() {
    return this.initialize();
  }

  /**
   * Initialize the outbox relay
   */
  async initialize() {
    console.log('[OutboxRelay] Initializing outbox relay service...');

    try {
      // Initialize Redis connection
      this.redis = new Redis(this.config.redis);

      // Test Redis connection
      await this.redis.ping();
      console.log('[OutboxRelay] Redis connection established');

      // Ensure required streams exist
      await this.ensureStreamsExist();

      console.log('[OutboxRelay] Outbox relay service initialized successfully');
    } catch (error) {
      console.error('[OutboxRelay] Failed to initialize outbox relay:', error);
      throw error;
    }
  }

  /**
   * Ensure required Redis streams exist
   */
  async ensureStreamsExist() {
    const streams = Object.values(this.config.streams);

    for (const streamName of streams) {
      try {
        // Check if stream exists by getting stream info
        await this.redis.xinfo('STREAM', streamName);
        console.log(`[OutboxRelay] Stream ${streamName} exists`);
      } catch (error) {
        if (error.message.includes('no such key')) {
          // Create stream with dummy entry that we'll remove
          const entryId = await this.redis.xadd(
            streamName,
            '*',
            'type', 'init',
            'data', JSON.stringify({ initialized: true, timestamp: new Date() })
          );

          // Remove the dummy entry
          await this.redis.xdel(streamName, entryId);
          console.log(`[OutboxRelay] Created stream ${streamName}`);
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Start the outbox relay polling
   */
  async start() {
    if (this.isRunning) {
      console.log('[OutboxRelay] Outbox relay is already running');
      return;
    }

    console.log('[OutboxRelay] Starting outbox relay polling...');
    this.isRunning = true;

    // Start polling loop
    this.scheduleNextPoll();

    console.log(`[OutboxRelay] Outbox relay started with ${this.config.polling.interval}ms interval`);
  }

  /**
   * Stop the outbox relay
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    console.log('[OutboxRelay] Stopping outbox relay...');
    this.isRunning = false;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }

    console.log('[OutboxRelay] Outbox relay stopped');
  }

  /**
   * Schedule the next polling cycle
   */
  scheduleNextPoll() {
    if (!this.isRunning) {
      return;
    }

    this.pollTimer = setTimeout(async () => {
      try {
        await this.pollAndProcess();
      } catch (error) {
        console.error('[OutboxRelay] Error during polling cycle:', error);
      } finally {
        this.scheduleNextPoll();
      }
    }, this.config.polling.interval);
  }

  /**
   * Poll outbox and process events
   */
  async pollAndProcess() {
    try {
      // Get unprocessed events from outbox
      const events = await this.getUnprocessedEvents();

      if (events.length === 0) {
        return; // No events to process
      }

      console.log(`[OutboxRelay] Processing ${events.length} outbox events`);

      // Process each event
      for (const event of events) {
        await this.processEvent(event);
        this.stats.processed++;
      }

    } catch (error) {
      console.error('[OutboxRelay] Failed to poll and process events:', error);
    }
  }

  /**
   * Get unprocessed events from outbox
   */
  async getUnprocessedEvents() {
    const query = `
      SELECT
        id, event_type, payload, aggregate_id, aggregate_type,
        retry_count, created_at, next_retry_at
      FROM spell.outbox
      WHERE
        processed_at IS NULL
        AND (next_retry_at IS NULL OR next_retry_at <= NOW())
        AND retry_count < $1
      ORDER BY created_at ASC
      LIMIT $2
    `;

    const result = await spellDatabase.db.query(query, [
      this.config.polling.maxRetries,
      this.config.polling.batchSize
    ]);

    return result.rows;
  }

  /**
   * Process a single outbox event
   */
  async processEvent(event) {
    try {
      console.log(`[OutboxRelay] Processing event ${event.id} of type ${event.event_type}`);

      // Determine target stream based on event type
      const streamName = this.getStreamName(event.event_type);

      if (!streamName) {
        console.warn(`[OutboxRelay] Unknown event type: ${event.event_type}, sending to dead letter`);
        await this.sendToDeadLetter(event, 'Unknown event type');
        return;
      }

      // Prepare event for Redis stream
      const streamEvent = this.prepareStreamEvent(event);

      // Publish to Redis stream
      const entryId = await this.redis.xadd(
        streamName,
        '*',
        ...this.flattenEventData(streamEvent)
      );

      console.log(`[OutboxRelay] Published event ${event.id} to ${streamName} as ${entryId}`);

      // Mark event as processed
      await this.markEventProcessed(event.id, entryId);
      this.stats.published++;

    } catch (error) {
      console.error(`[OutboxRelay] Failed to process event ${event.id}:`, error);
      await this.handleEventFailure(event, error);
    }
  }

  /**
   * Get stream name for event type
   */
  getStreamName(eventType) {
    const streamMap = {
      'dict.updated.v1': this.config.streams.dictionaryUpdated,
      'dict.created.v1': this.config.streams.dictionaryUpdated,
      'dict.deleted.v1': this.config.streams.dictionaryUpdated
    };

    return streamMap[eventType] || null;
  }

  /**
   * Prepare event for Redis stream format
   */
  prepareStreamEvent(event) {
    return {
      eventId: uuidv4(),
      eventType: event.event_type,
      aggregateId: event.aggregate_id,
      aggregateType: event.aggregate_type,
      payload: event.payload,
      metadata: {
        source: 'spell-check-service',
        outboxId: event.id,
        retryCount: event.retry_count,
        originalTimestamp: event.created_at,
        publishedAt: new Date()
      }
    };
  }

  /**
   * Flatten event data for Redis XADD command
   */
  flattenEventData(event) {
    return [
      'eventId', event.eventId,
      'eventType', event.eventType,
      'aggregateId', event.aggregateId,
      'aggregateType', event.aggregateType,
      'payload', JSON.stringify(event.payload),
      'metadata', JSON.stringify(event.metadata)
    ];
  }

  /**
   * Mark event as processed in outbox
   */
  async markEventProcessed(eventId, streamEntryId) {
    const query = `
      UPDATE spell.outbox
      SET
        processed_at = NOW(),
        stream_entry_id = $2,
        updated_at = NOW()
      WHERE id = $1
    `;

    await spellDatabase.db.query(query, [eventId, streamEntryId]);
  }

  /**
   * Handle event processing failure
   */
  async handleEventFailure(event, error) {
    const newRetryCount = event.retry_count + 1;

    if (newRetryCount >= this.config.polling.maxRetries) {
      // Send to dead letter
      await this.sendToDeadLetter(event, error.message);
      this.stats.deadLettered++;
    } else {
      // Schedule retry
      await this.scheduleEventRetry(event.id, newRetryCount, error.message);
      this.stats.retried++;
    }

    this.stats.failed++;
  }

  /**
   * Schedule event for retry
   */
  async scheduleEventRetry(eventId, retryCount, errorMessage) {
    const nextRetryAt = new Date(Date.now() + this.config.polling.retryDelay);

    const query = `
      UPDATE spell.outbox
      SET
        retry_count = $2,
        last_error = $3,
        next_retry_at = $4,
        updated_at = NOW()
      WHERE id = $1
    `;

    await spellDatabase.db.query(query, [eventId, retryCount, errorMessage, nextRetryAt]);

    console.log(`[OutboxRelay] Scheduled retry ${retryCount} for event ${eventId} at ${nextRetryAt}`);
  }

  /**
   * Send event to dead letter stream
   */
  async sendToDeadLetter(event, errorMessage) {
    try {
      const deadLetterEvent = {
        originalEvent: {
          id: event.id,
          eventType: event.event_type,
          aggregateId: event.aggregate_id,
          aggregateType: event.aggregate_type,
          payload: event.payload,
          retryCount: event.retry_count,
          createdAt: event.created_at
        },
        error: errorMessage,
        deadLetteredAt: new Date(),
        reason: 'Max retries exceeded'
      };

      await this.redis.xadd(
        this.config.streams.deadLetter,
        '*',
        'eventId', uuidv4(),
        'eventType', 'outbox.dead-letter.v1',
        'payload', JSON.stringify(deadLetterEvent),
        'metadata', JSON.stringify({
          source: 'spell-check-service-outbox-relay',
          originalEventId: event.id
        })
      );

      // Mark as processed (failed)
      const query = `
        UPDATE spell.outbox
        SET
          processed_at = NOW(),
          dead_lettered = true,
          last_error = $2,
          updated_at = NOW()
        WHERE id = $1
      `;

      await spellDatabase.db.query(query, [event.id, errorMessage]);

      console.log(`[OutboxRelay] Sent event ${event.id} to dead letter stream`);

    } catch (error) {
      console.error(`[OutboxRelay] Failed to send event ${event.id} to dead letter:`, error);
    }
  }

  /**
   * Get relay statistics
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      config: {
        pollingInterval: this.config.polling.interval,
        batchSize: this.config.polling.batchSize,
        maxRetries: this.config.polling.maxRetries
      }
    };
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      // Check Redis connection
      const redisPing = await this.redis.ping();

      // Check database connection
      await spellDatabase.db.query('SELECT 1');

      // Get pending events count
      const pendingQuery = `
        SELECT COUNT(*) as count
        FROM spell.outbox
        WHERE processed_at IS NULL AND retry_count < $1
      `;

      const pendingResult = await spellDatabase.db.query(pendingQuery, [this.config.polling.maxRetries]);
      const pendingCount = parseInt(pendingResult.rows[0].count);

      return {
        status: 'healthy',
        isRunning: this.isRunning,
        redis: redisPing === 'PONG' ? 'connected' : 'disconnected',
        database: 'connected',
        pendingEvents: pendingCount,
        stats: this.stats
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        isRunning: this.isRunning,
        stats: this.stats
      };
    }
  }
}

module.exports = OutboxRelay;