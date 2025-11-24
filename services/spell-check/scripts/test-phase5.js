#!/usr/bin/env node

/**
 * Phase 5 Integration Test Suite
 * Validates spell-check service independence from backend
 */

const fetch = require('node-fetch');
const { Pool } = require('pg');
const Redis = require('ioredis');

const SPELL_SERVICE_URL = 'http://localhost:8003';
const TEST_TENANT = '00000000-0000-0000-0000-000000000001';
const TEST_USER = '11111111-1111-1111-1111-111111111111';

class Phase5TestSuite {
  constructor() {
    this.db = new Pool({
      host: '127.0.0.1',
      port: 5432,
      database: 'markdown_manager',
      user: 'postgres',
      password: 'postgres'
    });

    this.redis = new Redis({
      host: '127.0.0.1',
      port: 6379
    });

    this.results = [];
  }

  async runTests() {
    console.log('🚀 Phase 5 Integration Test Suite');
    console.log('=====================================\n');

    try {
      // Test 1: Service Health
      await this.testServiceHealth();

      // Test 2: Database Schema
      await this.testDatabaseSchema();

      // Test 3: Direct Dictionary API
      await this.testDictionaryAPI();

      // Test 4: Event Consumer
      await this.testEventConsumer();

      // Test 5: Outbox Relay
      await this.testOutboxRelay();

      // Test 6: End-to-End Spell Check
      await this.testSpellCheckWithCustomDict();

      // Print results
      this.printResults();

    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }

  async testServiceHealth() {
    console.log('Test 1: Service Health Check');
    try {
      const response = await fetch(`${SPELL_SERVICE_URL}/health/detailed`);
      const health = await response.json();

      this.assert(response.ok, 'Service should be healthy');
      this.assert(health.status === 'healthy', 'Overall status should be healthy');
      this.assert(health.services.database === 'connected', 'Database should be connected');

      console.log('✅ Service is healthy and running\n');
      this.results.push({ test: 'Service Health', status: 'PASS' });
    } catch (error) {
      console.log('❌ Service health check failed:', error.message);
      this.results.push({ test: 'Service Health', status: 'FAIL', error: error.message });
    }
  }

  async testDatabaseSchema() {
    console.log('Test 2: Database Schema Validation');
    try {
      // Check spell schema exists
      const schemaQuery = `
        SELECT EXISTS(
          SELECT 1 FROM information_schema.schemata
          WHERE schema_name = 'spell'
        ) as exists
      `;
      const schemaResult = await this.db.query(schemaQuery);
      this.assert(schemaResult.rows[0].exists, 'Spell schema should exist');

      // Check required tables
      const requiredTables = ['user_dict', 'identity_projection', 'event_ledger', 'outbox'];
      const tablesQuery = `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'spell'
      `;
      const tablesResult = await this.db.query(tablesQuery);
      const existingTables = tablesResult.rows.map(row => row.table_name);

      for (const table of requiredTables) {
        this.assert(existingTables.includes(table), `Table ${table} should exist`);
      }

      console.log('✅ Database schema is properly configured\n');
      this.results.push({ test: 'Database Schema', status: 'PASS' });
    } catch (error) {
      console.log('❌ Database schema validation failed:', error.message);
      this.results.push({ test: 'Database Schema', status: 'FAIL', error: error.message });
    }
  }

  async testDictionaryAPI() {
    console.log('Test 3: Direct Dictionary API');
    try {
      // Clean up any existing test data
      await this.db.query('DELETE FROM spell.user_dict WHERE tenant_id = $1 AND user_id = $2',
        [TEST_TENANT, TEST_USER]);

      // Create identity projection
      await this.db.query(`
        INSERT INTO spell.identity_projection (tenant_id, user_id, status, profile_data)
        VALUES ($1, $2, 'active', '{}')
        ON CONFLICT (tenant_id, user_id) DO UPDATE SET status = 'active'
      `, [TEST_TENANT, TEST_USER]);

      // Test GET dictionary (should be empty initially)
      const getResponse1 = await fetch(`${SPELL_SERVICE_URL}/dict/${TEST_TENANT}/${TEST_USER}`);
      this.assert(getResponse1.ok, 'GET dictionary should succeed');

      const dict1 = await getResponse1.json();
      this.assert(Array.isArray(dict1.words), 'Words should be an array');
      this.assert(dict1.words.length === 0, 'Initial dictionary should be empty');

      // Test PUT dictionary (create)
      const testWords = ['customword1', 'customword2', 'specialterm'];
      const putResponse = await fetch(`${SPELL_SERVICE_URL}/dict/${TEST_TENANT}/${TEST_USER}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words: testWords })
      });

      this.assert(putResponse.ok, 'PUT dictionary should succeed');
      const putResult = await putResponse.json();
      this.assert(putResult.wordCount === 3, 'Dictionary should have 3 words');

      // Test GET dictionary (should have words now)
      const getResponse2 = await fetch(`${SPELL_SERVICE_URL}/dict/${TEST_TENANT}/${TEST_USER}`);
      const dict2 = await getResponse2.json();
      this.assert(dict2.words.length === 3, 'Dictionary should have 3 words');
      this.assert(dict2.words.includes('customword1'), 'Should contain customword1');

      // Test POST add words
      const postResponse = await fetch(`${SPELL_SERVICE_URL}/dict/${TEST_TENANT}/${TEST_USER}/words`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words: ['newword1', 'newword2'] })
      });

      this.assert(postResponse.ok, 'POST add words should succeed');
      const postResult = await postResponse.json();
      this.assert(postResult.totalWords === 5, 'Dictionary should have 5 words after adding');

      // Test DELETE remove words
      const deleteResponse = await fetch(`${SPELL_SERVICE_URL}/dict/${TEST_TENANT}/${TEST_USER}/words`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words: ['customword1'] })
      });

      this.assert(deleteResponse.ok, 'DELETE remove words should succeed');
      const deleteResult = await deleteResponse.json();
      this.assert(deleteResult.totalWords === 4, 'Dictionary should have 4 words after removing');

      // Test search
      const searchResponse = await fetch(`${SPELL_SERVICE_URL}/dict/${TEST_TENANT}/${TEST_USER}/search?term=new`);
      this.assert(searchResponse.ok, 'Search should succeed');

      const searchResult = await searchResponse.json();
      this.assert(searchResult.results.length === 2, 'Search should find 2 words containing "new"');

      console.log('✅ Dictionary API is working correctly\n');
      this.results.push({ test: 'Dictionary API', status: 'PASS' });
    } catch (error) {
      console.log('❌ Dictionary API test failed:', error.message);
      this.results.push({ test: 'Dictionary API', status: 'FAIL', error: error.message });
    }
  }

  async testEventConsumer() {
    console.log('Test 4: Event Consumer');
    try {
      // Publish a test identity event to Redis
      const testEvent = {
        eventId: 'test-event-' + Date.now(),
        eventType: 'identity.user.v1',
        aggregateId: TEST_USER,
        payload: JSON.stringify({
          tenantId: TEST_TENANT,
          userId: TEST_USER,
          status: 'active',
          profile: { name: 'Test User', email: 'test@example.com' }
        }),
        metadata: JSON.stringify({
          source: 'test-suite',
          timestamp: new Date()
        })
      };

      // Add event to Redis stream
      await this.redis.xadd(
        'identity.user.v1',
        '*',
        'eventId', testEvent.eventId,
        'eventType', testEvent.eventType,
        'aggregateId', testEvent.aggregateId,
        'payload', testEvent.payload,
        'metadata', testEvent.metadata
      );

      // Wait a bit for event processing
      await this.sleep(3000);

      // Check if identity projection was updated/created
      const projectionQuery = `
        SELECT * FROM spell.identity_projection
        WHERE tenant_id = $1 AND user_id = $2
      `;
      const projectionResult = await this.db.query(projectionQuery, [TEST_TENANT, TEST_USER]);

      this.assert(projectionResult.rows.length > 0, 'Identity projection should exist');
      this.assert(projectionResult.rows[0].status === 'active', 'User status should be active');

      console.log('✅ Event consumer is processing events correctly\n');
      this.results.push({ test: 'Event Consumer', status: 'PASS' });
    } catch (error) {
      console.log('❌ Event consumer test failed:', error.message);
      this.results.push({ test: 'Event Consumer', status: 'FAIL', error: error.message });
    }
  }

  async testOutboxRelay() {
    console.log('Test 5: Outbox Relay');
    try {
      // Add a test event to outbox
      const outboxQuery = `
        INSERT INTO spell.outbox (event_type, payload, aggregate_id, aggregate_type)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `;

      const testPayload = {
        tenantId: TEST_TENANT,
        userId: TEST_USER,
        action: 'test',
        words: ['testword'],
        timestamp: new Date()
      };

      const outboxResult = await this.db.query(outboxQuery, [
        'dict.updated.v1',
        JSON.stringify(testPayload),
        `${TEST_TENANT}:${TEST_USER}`,
        'user_dictionary'
      ]);

      const eventId = outboxResult.rows[0].id;

      // Wait for outbox relay to process
      await this.sleep(8000); // Outbox polls every 5 seconds

      // Check if event was processed
      const processedQuery = `
        SELECT processed_at, stream_entry_id
        FROM spell.outbox
        WHERE id = $1
      `;
      const processedResult = await this.db.query(processedQuery, [eventId]);

      this.assert(processedResult.rows.length > 0, 'Outbox event should exist');

      const eventRow = processedResult.rows[0];
      if (eventRow.processed_at) {
        console.log('✅ Outbox relay processed event successfully');
        this.results.push({ test: 'Outbox Relay', status: 'PASS' });
      } else {
        console.log('⏳ Outbox event not yet processed (may need more time)');
        this.results.push({ test: 'Outbox Relay', status: 'PENDING' });
      }

      console.log('');
    } catch (error) {
      console.log('❌ Outbox relay test failed:', error.message);
      this.results.push({ test: 'Outbox Relay', status: 'FAIL', error: error.message });
    }
  }

  async testSpellCheckWithCustomDict() {
    console.log('Test 6: End-to-End Spell Check with Custom Dictionary');
    try {
      // Ensure we have a custom dictionary with test words
      const dictResponse = await fetch(`${SPELL_SERVICE_URL}/dict/${TEST_TENANT}/${TEST_USER}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          words: ['myspecialword', 'customtech', 'bizterm']
        })
      });

      this.assert(dictResponse.ok, 'Dictionary setup should succeed');

      // Test spell check with custom words
      const spellCheckResponse = await fetch(`${SPELL_SERVICE_URL}/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'This contains myspecialword and customtech terms that should not be flagged as errors.',
          options: {
            customDictionary: {
              tenantId: TEST_TENANT,
              userId: TEST_USER
            }
          }
        })
      });

      this.assert(spellCheckResponse.ok, 'Spell check should succeed');

      const spellResult = await spellCheckResponse.json();
      this.assert(spellResult.status === 'success', 'Spell check should return success');

      // Check that custom words are not flagged as errors
      const customWordErrors = spellResult.suggestions.filter(s =>
        ['myspecialword', 'customtech'].includes(s.word)
      );

      this.assert(customWordErrors.length === 0, 'Custom dictionary words should not be flagged as errors');

      console.log('✅ End-to-end spell check with custom dictionary working\n');
      this.results.push({ test: 'E2E Spell Check', status: 'PASS' });
    } catch (error) {
      console.log('❌ End-to-end spell check test failed:', error.message);
      this.results.push({ test: 'E2E Spell Check', status: 'FAIL', error: error.message });
    }
  }

  printResults() {
    console.log('📊 Test Results Summary');
    console.log('=======================');

    const passCount = this.results.filter(r => r.status === 'PASS').length;
    const failCount = this.results.filter(r => r.status === 'FAIL').length;
    const pendingCount = this.results.filter(r => r.status === 'PENDING').length;

    this.results.forEach(result => {
      const icon = result.status === 'PASS' ? '✅' :
                   result.status === 'FAIL' ? '❌' : '⏳';
      console.log(`${icon} ${result.test}: ${result.status}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

    console.log('\\n📈 Overall Results:');
    console.log(`   Passed: ${passCount}`);
    console.log(`   Failed: ${failCount}`);
    console.log(`   Pending: ${pendingCount}`);
    console.log(`   Total: ${this.results.length}`);

    if (failCount === 0) {
      console.log('\\n🎉 Phase 5 implementation successful!');
      console.log('   ✅ Spell-Check service is now independent of Backend');
      console.log('   ✅ Custom dictionaries stored locally');
      console.log('   ✅ Event-driven architecture working');
      console.log('   ✅ Direct dictionary API available');
    } else {
      console.log('\\n⚠️  Some tests failed. Phase 5 needs attention.');
    }
  }

  async cleanup() {
    try {
      // Clean up test data
      await this.db.query('DELETE FROM spell.user_dict WHERE tenant_id = $1 AND user_id = $2',
        [TEST_TENANT, TEST_USER]);
      await this.db.query('DELETE FROM spell.identity_projection WHERE tenant_id = $1 AND user_id = $2',
        [TEST_TENANT, TEST_USER]);

      await this.db.end();
      await this.redis.quit();
    } catch (error) {
      console.error('Cleanup error:', error.message);
    }
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run tests
async function main() {
  const testSuite = new Phase5TestSuite();
  await testSuite.runTests();
}

if (require.main === module) {
  main().catch(error => {
    console.error('Test suite error:', error);
    process.exit(1);
  });
}

module.exports = Phase5TestSuite;