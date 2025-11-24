/**
 * Database Configuration for Spell-Check Service
 * Phase 5: Local database ownership
 */

const { Pool } = require('pg');

class DatabaseConfig {
  constructor() {
    this.config = {
      host: process.env.SPELL_DB_HOST || 'localhost',
      port: parseInt(process.env.SPELL_DB_PORT || '5432'),
      database: process.env.SPELL_DB_NAME || 'markdown_manager',
      user: process.env.SPELL_DB_USER || 'postgres',
      password: process.env.SPELL_DB_PASSWORD || 'postgres',

      // Connection pool settings
      max: 20, // maximum number of clients
      idleTimeoutMillis: 30000, // how long a client is allowed to remain idle
      connectionTimeoutMillis: 2000, // how long to wait when connecting

      // Schema-specific settings
      searchPath: ['spell', 'public'],

      // SSL configuration (for production)
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    };

    this.pool = null;
  }

  /**
   * Initialize database connection pool
   */
  async initialize() {
    try {
      this.pool = new Pool(this.config);

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      console.log('[Database] Connection pool initialized successfully');
      return true;
    } catch (error) {
      console.error('[Database] Failed to initialize connection pool:', error);
      throw error;
    }
  }

  /**
   * Get a client from the pool
   */
  async getClient() {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }
    return await this.pool.connect();
  }

  /**
   * Execute a query with automatic client release
   */
  async query(text, params = []) {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction(queries) {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const results = [];
      for (const { text, params = [] } of queries) {
        const result = await client.query(text, params);
        results.push(result);
      }

      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Close the database connection pool
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('[Database] Connection pool closed');
    }
  }

  /**
   * Get pool status for health checks
   */
  getStatus() {
    if (!this.pool) {
      return { status: 'not_initialized' };
    }

    return {
      status: 'connected',
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount
    };
  }
}

// Export singleton instance
module.exports = new DatabaseConfig();