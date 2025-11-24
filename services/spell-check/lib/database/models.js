/**
 * Database Models and Queries for Spell-Check Service
 * Phase 5: Local dictionary and identity management
 */

const databaseConfig = require('./config');
const { v4: uuidv4 } = require('uuid');

class SpellDatabase {
  /**
   * Identity Projection Operations
   */

  /**
   * Get user identity projection
   */
  async getIdentityProjection(tenantId, userId) {
    const result = await databaseConfig.query(`
      SELECT tenant_id, user_id, email, status, updated_at
      FROM spell.identity_projection
      WHERE tenant_id = $1 AND user_id = $2
    `, [tenantId, userId]);

    return result.rows[0] || null;
  }

  /**
   * Upsert identity projection
   */
  async upsertIdentityProjection(tenantId, userId, email, status, updatedAt = new Date()) {
    const result = await databaseConfig.query(`
      INSERT INTO spell.identity_projection (tenant_id, user_id, email, status, updated_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (tenant_id, user_id)
      DO UPDATE SET
        email = EXCLUDED.email,
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at
      RETURNING *
    `, [tenantId, userId, email, status, updatedAt]);

    return result.rows[0];
  }

  /**
   * User Dictionary Operations
   */

  /**
   * Get user dictionary
   */
  async getUserDictionary(tenantId, userId) {
    const result = await databaseConfig.query(`
      SELECT tenant_id, user_id, words, version, updated_at
      FROM spell.user_dict
      WHERE tenant_id = $1 AND user_id = $2
    `, [tenantId, userId]);

    const row = result.rows[0];
    if (!row) return null;

    return {
      tenantId: row.tenant_id,
      userId: row.user_id,
      words: row.words || [],
      version: row.version,
      updatedAt: row.updated_at
    };
  }

  /**
   * Create or update user dictionary
   */
  async upsertUserDictionary(tenantId, userId, words, version = null) {
    const wordsJson = JSON.stringify(Array.isArray(words) ? words : []);

    if (version !== null) {
      // Update with version check (optimistic locking)
      const result = await databaseConfig.query(`
        UPDATE spell.user_dict
        SET words = $3::jsonb, version = version + 1, updated_at = NOW()
        WHERE tenant_id = $1 AND user_id = $2 AND version = $4
        RETURNING *
      `, [tenantId, userId, wordsJson, version]);

      if (result.rows.length === 0) {
        throw new Error('Dictionary version conflict - please retry');
      }
      return result.rows[0];
    } else {
      // Upsert without version check
      const result = await databaseConfig.query(`
        INSERT INTO spell.user_dict (tenant_id, user_id, words, version, updated_at)
        VALUES ($1, $2, $3::jsonb, 1, NOW())
        ON CONFLICT (tenant_id, user_id)
        DO UPDATE SET
          words = EXCLUDED.words,
          version = spell.user_dict.version + 1,
          updated_at = NOW()
        RETURNING *
      `, [tenantId, userId, wordsJson]);

      return result.rows[0];
    }
  }

  /**
   * Add words to user dictionary
   */
  async addWordsToUserDictionary(tenantId, userId, newWords) {
    if (!Array.isArray(newWords) || newWords.length === 0) {
      throw new Error('newWords must be a non-empty array');
    }

    const normalizedWords = newWords.map(word =>
      typeof word === 'string' ? word.toLowerCase().trim() : ''
    ).filter(word => word.length > 0);

    if (normalizedWords.length === 0) {
      throw new Error('No valid words to add');
    }

    const result = await databaseConfig.query(`
      INSERT INTO spell.user_dict (tenant_id, user_id, words, version, updated_at)
      VALUES ($1, $2, $3::jsonb, 1, NOW())
      ON CONFLICT (tenant_id, user_id)
      DO UPDATE SET
        words = (
          SELECT COALESCE(
            jsonb_agg(DISTINCT word),
            '[]'::jsonb
          )
          FROM (
            SELECT jsonb_array_elements_text(spell.user_dict.words) as word
            UNION
            SELECT unnest($3::text[]) as word
          ) combined_words
        ),
        version = spell.user_dict.version + 1,
        updated_at = NOW()
      RETURNING *
    `, [tenantId, userId, normalizedWords]);

    return result.rows[0];
  }

  /**
   * Remove words from user dictionary
   */
  async removeWordsFromUserDictionary(tenantId, userId, wordsToRemove) {
    if (!Array.isArray(wordsToRemove) || wordsToRemove.length === 0) {
      throw new Error('wordsToRemove must be a non-empty array');
    }

    const normalizedWords = wordsToRemove.map(word =>
      typeof word === 'string' ? word.toLowerCase().trim() : ''
    ).filter(word => word.length > 0);

    const result = await databaseConfig.query(`
      UPDATE spell.user_dict
      SET
        words = (
          SELECT COALESCE(
            jsonb_agg(word),
            '[]'::jsonb
          )
          FROM (
            SELECT jsonb_array_elements_text(words) as word
            WHERE jsonb_array_elements_text(words) != ALL($3::text[])
          ) remaining_words
        ),
        version = version + 1,
        updated_at = NOW()
      WHERE tenant_id = $1 AND user_id = $2
      RETURNING *
    `, [tenantId, userId, normalizedWords]);

    return result.rows[0];
  }

  /**
   * Search words in dictionary (for autocomplete/suggestions)
   */
  async searchUserDictionary(tenantId, userId, searchTerm, limit = 20) {
    const result = await databaseConfig.query(`
      SELECT word
      FROM (
        SELECT jsonb_array_elements_text(words) as word
        FROM spell.user_dict
        WHERE tenant_id = $1 AND user_id = $2
      ) dict_words
      WHERE word ILIKE $3
      ORDER BY word
      LIMIT $4
    `, [tenantId, userId, `${searchTerm}%`, limit]);

    return result.rows.map(row => row.word);
  }

  /**
   * Event Processing Operations
   */

  /**
   * Check if event has been processed
   */
  async isEventProcessed(eventId) {
    const result = await databaseConfig.query(`
      SELECT 1 FROM spell.event_ledger WHERE event_id = $1
    `, [eventId]);

    return result.rows.length > 0;
  }

  /**
   * Record event as processed
   */
  async recordEventProcessed(eventId) {
    await databaseConfig.query(`
      INSERT INTO spell.event_ledger (event_id, received_at)
      VALUES ($1, NOW())
      ON CONFLICT (event_id) DO NOTHING
    `, [eventId]);
  }

  /**
   * Outbox Operations
   */

  /**
   * Add event to outbox for publishing
   */
  async addToOutbox(eventType, tenantId, aggregateId, payload, topic = 'spell.user-dict.v1') {
    const eventId = uuidv4();

    const result = await databaseConfig.query(`
      INSERT INTO spell.outbox (
        event_id, event_type, topic, schema_version,
        tenant_id, aggregate_id, aggregate_type, payload,
        occurred_at
      )
      VALUES ($1, $2, $3, 1, $4, $5, 'user_dict', $6::jsonb, NOW())
      RETURNING *
    `, [eventId, eventType, topic, tenantId, aggregateId, JSON.stringify(payload)]);

    return result.rows[0];
  }

  /**
   * Get unprocessed outbox events
   */
  async getUnprocessedOutboxEvents(limit = 100) {
    const result = await databaseConfig.query(`
      SELECT * FROM spell.outbox
      WHERE processed_at IS NULL
        AND (next_retry_at IS NULL OR next_retry_at <= NOW())
        AND retry_count < max_retries
      ORDER BY occurred_at ASC
      LIMIT $1
    `, [limit]);

    return result.rows;
  }

  /**
   * Mark outbox event as processed
   */
  async markOutboxEventProcessed(eventId) {
    await databaseConfig.query(`
      UPDATE spell.outbox
      SET processed_at = NOW()
      WHERE event_id = $1
    `, [eventId]);
  }

  /**
   * Mark outbox event as failed (for retry)
   */
  async markOutboxEventFailed(eventId) {
    await databaseConfig.query(`
      UPDATE spell.outbox
      SET
        retry_count = retry_count + 1,
        next_retry_at = NOW() + (retry_count + 1) * INTERVAL '1 minute'
      WHERE event_id = $1
    `, [eventId]);
  }

  /**
   * Utility Operations
   */

  /**
   * Get database health status
   */
  async getHealthStatus() {
    try {
      const result = await databaseConfig.query('SELECT NOW() as current_time');
      const counts = await databaseConfig.query(`
        SELECT
          (SELECT COUNT(*) FROM spell.identity_projection WHERE status = 'active') as active_users,
          (SELECT COUNT(*) FROM spell.user_dict) as dictionaries,
          (SELECT COUNT(*) FROM spell.outbox WHERE processed_at IS NULL) as pending_events
      `);

      return {
        status: 'healthy',
        timestamp: result.rows[0].current_time,
        stats: counts.rows[0],
        pool: databaseConfig.getStatus()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        pool: databaseConfig.getStatus()
      };
    }
  }
}

// Export singleton instance
module.exports = new SpellDatabase();