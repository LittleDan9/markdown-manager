#!/usr/bin/env node

/**
 * Phase 5 Data Migration Script
 * Migrate custom dictionaries from Backend FastAPI to Spell-Check service
 *
 * This script:
 * 1. Connects to the backend PostgreSQL database
 * 2. Extracts all custom_dictionaries records
 * 3. Maps backend user IDs to spell service tenant/user format
 * 4. Inserts dictionary data into spell.user_dict table
 * 5. Validates migration success
 */

const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const CONFIG = {
  // Backend database (source)
  backend: {
    host: process.env.BACKEND_DB_HOST || 'localhost',
    port: process.env.BACKEND_DB_PORT || 5432,
    database: process.env.BACKEND_DB_NAME || 'markdown_manager',
    user: process.env.BACKEND_DB_USER || 'postgres',
    password: process.env.BACKEND_DB_PASSWORD || 'password'
  },

  // Spell service database (target)
  spell: {
    host: process.env.SPELL_DB_HOST || 'localhost',
    port: process.env.SPELL_DB_PORT || 5432,
    database: process.env.SPELL_DB_NAME || 'markdown_manager',
    user: process.env.SPELL_DB_USER || 'postgres',
    password: process.env.SPELL_DB_PASSWORD || 'password'
  },

  // Migration options
  dryRun: process.env.DRY_RUN === 'true',
  batchSize: parseInt(process.env.BATCH_SIZE) || 100,
  logFile: process.env.LOG_FILE || 'dictionary-migration.log'
};

class DictionaryMigration {
  constructor() {
    this.backendPool = null;
    this.spellPool = null;
    this.migrationLog = [];
    this.stats = {
      processed: 0,
      migrated: 0,
      skipped: 0,
      errors: 0
    };
  }

  /**
   * Initialize database connections
   */
  async initialize() {
    this.log('INFO', 'Initializing database connections...');

    try {
      // Backend database connection
      this.backendPool = new Pool({
        ...CONFIG.backend,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000
      });

      // Test backend connection
      const backendTest = await this.backendPool.query('SELECT NOW(), version()');
      this.log('INFO', `Backend DB connected: ${backendTest.rows[0].version.split(' ')[0]}`);

      // Spell service database connection
      this.spellPool = new Pool({
        ...CONFIG.spell,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000
      });

      // Test spell connection and verify schema
      const spellTest = await this.spellPool.query('SELECT NOW()');
      this.log('INFO', `Spell DB connected: ${spellTest.rows[0].now}`);

      // Verify spell schema exists
      const schemaCheck = await this.spellPool.query(`
        SELECT EXISTS(
          SELECT 1 FROM information_schema.schemata
          WHERE schema_name = 'spell'
        ) as schema_exists
      `);

      if (!schemaCheck.rows[0].schema_exists) {
        throw new Error('Spell schema does not exist. Please run migrations first.');
      }

      this.log('INFO', 'Database connections initialized successfully');
    } catch (error) {
      this.log('ERROR', `Failed to initialize database connections: ${error.message}`);
      throw error;
    }
  }

  /**
   * Analyze source data
   */
  async analyzeSourceData() {
    this.log('INFO', 'Analyzing source data...');

    try {
      // Get custom dictionaries count and sample
      const countQuery = `
        SELECT
          COUNT(*) as total_dictionaries,
          COUNT(DISTINCT user_id) as unique_users,
          MIN(created_at) as oldest_dict,
          MAX(created_at) as newest_dict
        FROM custom_dictionaries
      `;

      const countResult = await this.backendPool.query(countQuery);
      const stats = countResult.rows[0];

      this.log('INFO', `Found ${stats.total_dictionaries} dictionaries for ${stats.unique_users} users`);
      this.log('INFO', `Date range: ${stats.oldest_dict} to ${stats.newest_dict}`);

      // Sample dictionary structure
      const sampleQuery = `
        SELECT
          id, user_id, words, created_at, updated_at
        FROM custom_dictionaries
        ORDER BY created_at DESC
        LIMIT 3
      `;

      const sampleResult = await this.backendPool.query(sampleQuery);
      this.log('INFO', `Sample dictionaries:`);

      sampleResult.rows.forEach((row, idx) => {
        const wordCount = Array.isArray(row.words) ? row.words.length : 0;
        this.log('INFO', `  ${idx + 1}. User: ${row.user_id}, Words: ${wordCount}, Updated: ${row.updated_at}`);
      });

      return stats;
    } catch (error) {
      this.log('ERROR', `Failed to analyze source data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user mappings for tenant/user format
   */
  async getUserMappings() {
    this.log('INFO', 'Building user ID mappings...');

    try {
      // In this migration, we'll use a default tenant for all users
      // In a real scenario, you'd have a mapping table or API call
      const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

      const usersQuery = `
        SELECT DISTINCT user_id
        FROM custom_dictionaries
        ORDER BY user_id
      `;

      const result = await this.backendPool.query(usersQuery);
      const userMappings = new Map();

      for (const row of result.rows) {
        // Map backend user_id to spell service format
        userMappings.set(row.user_id, {
          tenantId: DEFAULT_TENANT_ID,
          userId: row.user_id // Assuming UUIDs are compatible
        });
      }

      this.log('INFO', `Built mappings for ${userMappings.size} users`);
      return userMappings;
    } catch (error) {
      this.log('ERROR', `Failed to build user mappings: ${error.message}`);
      throw error;
    }
  }

  /**
   * Migrate dictionary data
   */
  async migrateDictionaries(userMappings) {
    this.log('INFO', 'Starting dictionary migration...');

    try {
      // Get all dictionaries in batches
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const batch = await this.processBatch(offset, userMappings);
        offset += CONFIG.batchSize;
        hasMore = batch.length === CONFIG.batchSize;

        this.log('INFO', `Processed batch: offset ${offset - CONFIG.batchSize}, count ${batch.length}`);
      }

      this.log('INFO', 'Dictionary migration completed');
    } catch (error) {
      this.log('ERROR', `Migration failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process a batch of dictionaries
   */
  async processBatch(offset, userMappings) {
    const query = `
      SELECT
        id, user_id, words, created_at, updated_at
      FROM custom_dictionaries
      ORDER BY created_at
      LIMIT $1 OFFSET $2
    `;

    const result = await this.backendPool.query(query, [CONFIG.batchSize, offset]);
    const dictionaries = result.rows;

    for (const dict of dictionaries) {
      await this.migrateSingleDictionary(dict, userMappings);
      this.stats.processed++;
    }

    return dictionaries;
  }

  /**
   * Migrate a single dictionary
   */
  async migrateSingleDictionary(dict, userMappings) {
    try {
      const userMapping = userMappings.get(dict.user_id);
      if (!userMapping) {
        this.log('WARN', `No user mapping found for user ${dict.user_id}, skipping`);
        this.stats.skipped++;
        return;
      }

      const { tenantId, userId } = userMapping;

      // Validate words format
      const words = Array.isArray(dict.words) ? dict.words : [];
      const validWords = words.filter(word =>
        typeof word === 'string' && word.trim().length > 0
      );

      if (validWords.length === 0) {
        this.log('WARN', `No valid words for user ${dict.user_id}, skipping`);
        this.stats.skipped++;
        return;
      }

      if (CONFIG.dryRun) {
        this.log('INFO', `[DRY RUN] Would migrate ${validWords.length} words for user ${userId}`);
        this.stats.migrated++;
        return;
      }

      // Check if dictionary already exists
      const existsQuery = `
        SELECT id FROM spell.user_dict
        WHERE tenant_id = $1 AND user_id = $2
      `;
      const existsResult = await this.spellPool.query(existsQuery, [tenantId, userId]);

      if (existsResult.rows.length > 0) {
        this.log('WARN', `Dictionary already exists for user ${userId}, skipping`);
        this.stats.skipped++;
        return;
      }

      // Insert dictionary
      const insertQuery = `
        INSERT INTO spell.user_dict (
          tenant_id, user_id, words, version, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `;

      const values = [
        tenantId,
        userId,
        JSON.stringify(validWords),
        1, // Initial version
        dict.created_at,
        dict.updated_at
      ];

      await this.spellPool.query(insertQuery, values);

      // Create identity projection if needed
      await this.ensureIdentityProjection(tenantId, userId);

      this.log('INFO', `Migrated ${validWords.length} words for user ${userId}`);
      this.stats.migrated++;

    } catch (error) {
      this.log('ERROR', `Failed to migrate dictionary for user ${dict.user_id}: ${error.message}`);
      this.stats.errors++;
    }
  }

  /**
   * Ensure identity projection exists
   */
  async ensureIdentityProjection(tenantId, userId) {
    const existsQuery = `
      SELECT id FROM spell.identity_projection
      WHERE tenant_id = $1 AND user_id = $2
    `;
    const existsResult = await this.spellPool.query(existsQuery, [tenantId, userId]);

    if (existsResult.rows.length === 0) {
      const insertQuery = `
        INSERT INTO spell.identity_projection (
          tenant_id, user_id, status, profile_data, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, NOW(), NOW())
        ON CONFLICT (tenant_id, user_id) DO NOTHING
      `;

      const values = [
        tenantId,
        userId,
        'active',
        JSON.stringify({ migrated: true, migration_date: new Date() })
      ];

      await this.spellPool.query(insertQuery, values);
    }
  }

  /**
   * Validate migration results
   */
  async validateMigration() {
    this.log('INFO', 'Validating migration results...');

    try {
      // Count migrated dictionaries
      const spellCountQuery = `
        SELECT
          COUNT(*) as migrated_count,
          COUNT(DISTINCT tenant_id) as tenant_count,
          COUNT(DISTINCT user_id) as user_count
        FROM spell.user_dict
      `;

      const spellResult = await this.spellPool.query(spellCountQuery);
      const spellStats = spellResult.rows[0];

      this.log('INFO', `Validation: ${spellStats.migrated_count} dictionaries for ${spellStats.user_count} users in ${spellStats.tenant_count} tenants`);

      // Sample validation
      const sampleQuery = `
        SELECT
          tenant_id, user_id,
          jsonb_array_length(words) as word_count,
          version, updated_at
        FROM spell.user_dict
        ORDER BY updated_at DESC
        LIMIT 5
      `;

      const sampleResult = await this.spellPool.query(sampleQuery);
      this.log('INFO', 'Sample migrated dictionaries:');

      sampleResult.rows.forEach((row, idx) => {
        this.log('INFO', `  ${idx + 1}. User: ${row.user_id}, Words: ${row.word_count}, Version: ${row.version}`);
      });

    } catch (error) {
      this.log('ERROR', `Validation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate migration report
   */
  async generateReport() {
    const report = {
      timestamp: new Date(),
      configuration: CONFIG,
      statistics: this.stats,
      summary: {
        success: this.stats.errors === 0,
        successRate: ((this.stats.migrated / this.stats.processed) * 100).toFixed(2) + '%',
        totalProcessed: this.stats.processed,
        totalMigrated: this.stats.migrated,
        totalSkipped: this.stats.skipped,
        totalErrors: this.stats.errors
      },
      logs: this.migrationLog
    };

    // Write report to file
    const reportPath = path.join(__dirname, `migration-report-${Date.now()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    this.log('INFO', `Migration report written to: ${reportPath}`);
    return report;
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.log('INFO', 'Cleaning up resources...');

    if (this.backendPool) {
      await this.backendPool.end();
      this.log('INFO', 'Backend database connection closed');
    }

    if (this.spellPool) {
      await this.spellPool.end();
      this.log('INFO', 'Spell database connection closed');
    }

    // Write logs to file
    if (CONFIG.logFile) {
      const logContent = this.migrationLog.map(entry =>
        `${entry.timestamp} [${entry.level}] ${entry.message}`
      ).join('\n');

      await fs.writeFile(CONFIG.logFile, logContent);
      console.log(`Migration logs written to: ${CONFIG.logFile}`);
    }
  }

  /**
   * Log message with timestamp
   */
  log(level, message) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message
    };

    this.migrationLog.push(entry);
    console.log(`${entry.timestamp} [${level}] ${message}`);
  }

  /**
   * Run complete migration
   */
  async run() {
    try {
      this.log('INFO', '=== Phase 5 Dictionary Migration Started ===');
      this.log('INFO', `Dry run: ${CONFIG.dryRun}`);

      await this.initialize();

      const sourceStats = await this.analyzeSourceData();
      const userMappings = await this.getUserMappings();

      await this.migrateDictionaries(userMappings);

      if (!CONFIG.dryRun) {
        await this.validateMigration();
      }

      const report = await this.generateReport();

      this.log('INFO', '=== Migration Summary ===');
      this.log('INFO', `Processed: ${this.stats.processed}`);
      this.log('INFO', `Migrated: ${this.stats.migrated}`);
      this.log('INFO', `Skipped: ${this.stats.skipped}`);
      this.log('INFO', `Errors: ${this.stats.errors}`);
      this.log('INFO', `Success Rate: ${report.summary.successRate}`);
      this.log('INFO', '=== Phase 5 Dictionary Migration Completed ===');

      return report;

    } catch (error) {
      this.log('ERROR', `Migration failed: ${error.message}`);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

/**
 * Main entry point
 */
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const help = args.includes('--help') || args.includes('-h');

  if (help) {
    console.log(`
Phase 5 Dictionary Migration Script

Usage: node migrate-dictionaries.js [options]

Options:
  --dry-run         Run migration in dry-run mode (no actual changes)
  --help, -h        Show this help message

Environment Variables:
  BACKEND_DB_HOST       Backend database host (default: localhost)
  BACKEND_DB_PORT       Backend database port (default: 5432)
  BACKEND_DB_NAME       Backend database name (default: markdown_manager)
  BACKEND_DB_USER       Backend database user (default: postgres)
  BACKEND_DB_PASSWORD   Backend database password (default: password)

  SPELL_DB_HOST         Spell service database host (default: localhost)
  SPELL_DB_PORT         Spell service database port (default: 5432)
  SPELL_DB_NAME         Spell service database name (default: markdown_manager)
  SPELL_DB_USER         Spell service database user (default: postgres)
  SPELL_DB_PASSWORD     Spell service database password (default: password)

  DRY_RUN              Set to 'true' for dry run mode
  BATCH_SIZE           Number of records to process per batch (default: 100)
  LOG_FILE             Path to log file (default: dictionary-migration.log)

Examples:
  # Dry run to test migration
  node migrate-dictionaries.js --dry-run

  # Full migration
  node migrate-dictionaries.js

  # With custom database settings
  BACKEND_DB_HOST=prod-db.example.com node migrate-dictionaries.js --dry-run
    `);
    process.exit(0);
  }

  if (dryRun) {
    process.env.DRY_RUN = 'true';
  }

  const migration = new DictionaryMigration();

  try {
    const report = await migration.run();

    if (report.summary.success) {
      console.log('\n✅ Migration completed successfully!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Migration completed with errors. Check the logs for details.');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = DictionaryMigration;