/**
 * Corrected Functional Tests for Refactored Spell Check Service
 * Created: October 25, 2025
 * Purpose: Validate functionality that actually exists in the refactored service
 */

const https = require('https');
const http = require('http');

const SERVICE_URL = 'http://localhost:8003';

// Helper function to make API requests using built-in modules
const apiRequest = async (endpoint, options = {}) => {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SERVICE_URL}${endpoint}`);
    const requestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = http.request(requestOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`API request failed: ${res.statusCode} ${res.statusMessage}`));
          return;
        }

        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (error) {
          reject(new Error(`Failed to parse JSON: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
};

describe('Refactored Spell Check Service - Core Functionality Tests', () => {

  beforeAll(async () => {
    // Verify service is running
    try {
      const health = await apiRequest('/health');
      expect(health.status).toBe('healthy');
    } catch (error) {
      throw new Error('Service not running. Please start with: npm start');
    }
  });

  describe('Health and Service Management', () => {
    test('should return healthy status', async () => {
      const response = await apiRequest('/health');

      expect(response.status).toBe('healthy');
      expect(response.service).toBe('spell-check');
      expect(response.version).toBe('1.0.0');
      expect(response.phase).toBe(3);
      expect(response.components).toBeDefined();
    });

    test('should have all 8 service components loaded', async () => {
      const response = await apiRequest('/health');
      const components = response.components;

      expect(components.spellChecker.loaded).toBe(true);
      expect(components.grammarChecker.loaded).toBe(true);
      expect(components.styleAnalyzer.loaded).toBe(true);
      expect(components.languageDetector.loaded).toBe(true);
      expect(components.customDictionaryManager.loaded).toBe(true);
      expect(components.contextualAnalyzer.loaded).toBe(true);
      expect(components.styleGuideManager.loaded).toBe(true);
      expect(components.cspellCodeChecker.loaded).toBe(true);
    });

    test('should provide memory usage information', async () => {
      const response = await apiRequest('/health');

      expect(response.memory).toBeDefined();
      expect(response.memory.rss).toBeDefined();
      expect(response.memory.heapTotal).toBeDefined();
      expect(response.memory.heapUsed).toBeDefined();
      expect(typeof response.memory.heapUsed).toBe('number');
    });
  });

  describe('Core Spell Checking Functionality', () => {
    test('should identify misspelled words', async () => {
      const response = await apiRequest('/check', {
        method: 'POST',
        body: JSON.stringify({
          text: 'This sentnce has mltple misspellings and grammer errors.',
          enableGrammar: true,
          enableStyle: true
        })
      });

      expect(response.results).toBeDefined();
      expect(response.results.spelling).toBeDefined();
      expect(response.results.spelling.length).toBeGreaterThan(0);

      // Should find spelling errors
      const spellingWords = response.results.spelling.map(issue => issue.word);
      expect(spellingWords).toContain('sentnce');
      expect(spellingWords).toContain('mltple');
    });

    test('should provide suggestions for misspelled words', async () => {
      const response = await apiRequest('/check', {
        method: 'POST',
        body: JSON.stringify({
          text: 'This is a tset with misspeled words.'
        })
      });

      expect(response.results.spelling.length).toBeGreaterThan(0);

      const firstIssue = response.results.spelling[0];
      expect(firstIssue.suggestions).toBeDefined();
      expect(Array.isArray(firstIssue.suggestions)).toBe(true);
      expect(firstIssue.suggestions.length).toBeGreaterThan(0);
    });

    test('should handle correct text without errors', async () => {
      const response = await apiRequest('/check', {
        method: 'POST',
        body: JSON.stringify({
          text: 'This is a perfectly correct sentence with no errors.'
        })
      });

      expect(response.results.spelling).toHaveLength(0);
    });

    test('should provide position information', async () => {
      const response = await apiRequest('/check', {
        method: 'POST',
        body: JSON.stringify({
          text: 'Test misspeled word here.'
        })
      });

      expect(response.results.spelling.length).toBeGreaterThan(0);

      const issue = response.results.spelling[0];
      expect(issue.position).toBeDefined();
      expect(issue.position.start).toBeDefined();
      expect(issue.position.end).toBeDefined();
      expect(typeof issue.position.start).toBe('number');
      expect(typeof issue.position.end).toBe('number');
    });
  });

  describe('Response Structure Validation', () => {
    test('should include all expected result categories', async () => {
      const response = await apiRequest('/check', {
        method: 'POST',
        body: JSON.stringify({
          text: 'Test text with potential issues.',
          enableGrammar: true,
          enableStyle: true
        })
      });

      // All categories should be present (even if empty arrays)
      expect(response.results.spelling).toBeDefined();
      expect(response.results.grammar).toBeDefined();
      expect(response.results.style).toBeDefined();
      expect(response.results.codeSpelling).toBeDefined();

      expect(Array.isArray(response.results.spelling)).toBe(true);
      expect(Array.isArray(response.results.grammar)).toBe(true);
      expect(Array.isArray(response.results.style)).toBe(true);
      expect(Array.isArray(response.results.codeSpelling)).toBe(true);
    });

    test('should include response structure and statistics', async () => {
      const response = await apiRequest('/check', {
        method: 'POST',
        body: JSON.stringify({
          text: 'Test text for structure validation.'
        })
      });

      // Check for the actual response structure
      expect(response.processingTime).toBeDefined();
      expect(response.statistics).toBeDefined();
      expect(response.statistics.processingTimeMs).toBeDefined();
      expect(response.language).toBeDefined();
      expect(typeof response.processingTime).toBe('number');
    });
  });

  describe('Language Detection', () => {
    test('should detect English text', async () => {
      const response = await apiRequest('/detect-language', {
        method: 'POST',
        body: JSON.stringify({
          text: 'This is English text for language detection testing.'
        })
      });

      expect(response.language).toBeDefined();
      expect(response.confidence).toBeDefined();
      expect(response.language).toBe('en-US');
    });

    test('should handle short text', async () => {
      const response = await apiRequest('/detect-language', {
        method: 'POST',
        body: JSON.stringify({
          text: 'Short text.'
        })
      });

      expect(response.language).toBeDefined();
    });

    test('should list supported languages', async () => {
      const response = await apiRequest('/languages');

      expect(response.languages).toBeDefined();
      expect(Array.isArray(response.languages)).toBe(true);
      expect(response.languages.length).toBeGreaterThan(0);

      const englishLang = response.languages.find(lang => lang.code === 'en-US');
      expect(englishLang).toBeDefined();
      expect(englishLang.name).toBeDefined();
    });
  });

  describe('Batch Processing', () => {
    test('should process text in batches', async () => {
      const longText = 'This is a longer text for batch processing. ' +
                      'It contains multiple sentences with some errors. ' +
                      'The batch processor should handle this efficiently. ' +
                      'There are misspeled words and grammer mistakes here.';

      const response = await apiRequest('/check-batch', {
        method: 'POST',
        body: JSON.stringify({
          text: longText,
          chunkSize: 50,
          enableGrammar: true,
          enableStyle: true
        })
      });

      expect(response.results).toBeDefined();
      expect(response.batchInfo).toBeDefined();
      expect(response.batchInfo.chunkCount).toBeGreaterThan(1);
      expect(response.results.spelling).toBeDefined();
    });
  });

  describe('Contextual Analysis', () => {
    test('should provide contextual suggestions', async () => {
      const response = await apiRequest('/contextual-suggestions', {
        method: 'POST',
        body: JSON.stringify({
          word: 'there',
          context: 'Put the book over there on the table.',
          position: 18,
          basicSuggestions: ['their', 'there', 'they']
        })
      });

      expect(response.suggestions).toBeDefined();
      expect(Array.isArray(response.suggestions)).toBe(true);
    });

    test('should handle invalid position gracefully', async () => {
      const response = await apiRequest('/contextual-suggestions', {
        method: 'POST',
        body: JSON.stringify({
          word: 'test',
          context: 'Short text.',
          position: 100, // Invalid position
          basicSuggestions: ['test']
        })
      });

      expect(response.suggestions).toBeDefined();
      expect(Array.isArray(response.suggestions)).toBe(true);
    });
  });

  describe('Style Guide Management', () => {
    test('should list available style guides', async () => {
      const response = await apiRequest('/style-guides');

      expect(response.styleGuides).toBeDefined(); // Note: actual field name
      expect(Array.isArray(response.styleGuides)).toBe(true);
      expect(response.styleGuides.length).toBeGreaterThan(0);

      const guide = response.styleGuides[0];
      expect(guide.id).toBeDefined();
      expect(guide.name).toBeDefined();
      expect(guide.description).toBeDefined();
    });

    test('should get style guide recommendations', async () => {
      const response = await apiRequest('/style-guides/recommend', {
        method: 'POST',
        body: JSON.stringify({
          text: 'This is a test sentence that needs style guidance.',
          domain: 'academic'
        })
      });

      expect(response.recommendations).toBeDefined();
      expect(Array.isArray(response.recommendations)).toBe(true);
    });
  });

  describe('Performance and Reliability', () => {
    test('should respond within reasonable time', async () => {
      const start = Date.now();

      await apiRequest('/check', {
        method: 'POST',
        body: JSON.stringify({
          text: 'This is a performance test with some deliberate misspellings.',
          enableGrammar: true,
          enableStyle: true
        })
      });

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(500); // Should respond within 500ms
    });

    test('should handle large text efficiently', async () => {
      const largeText = 'This is a comprehensive test document. '.repeat(100) +
                       'It contains misspeled words and grammer errors.';

      const start = Date.now();

      const response = await apiRequest('/check', {
        method: 'POST',
        body: JSON.stringify({
          text: largeText,
          enableGrammar: true,
          enableStyle: true
        })
      });

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(2000); // Should handle large text within 2s
      expect(response.results.spelling.length).toBeGreaterThan(0);
    });

    test('should handle concurrent requests', async () => {
      const requests = Array(5).fill().map((_, i) =>
        apiRequest('/check', {
          method: 'POST',
          body: JSON.stringify({
            text: `Test request ${i} with misspeled word.`
          })
        })
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.results).toBeDefined();
        expect(response.results.spelling.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle missing text gracefully', async () => {
      try {
        await apiRequest('/check', {
          method: 'POST',
          body: JSON.stringify({})
        });
      } catch (error) {
        expect(error.message).toContain('400');
      }
    });

    test('should handle unsupported language gracefully', async () => {
      const response = await apiRequest('/check', {
        method: 'POST',
        body: JSON.stringify({
          text: 'Test text',
          language: 'unsupported-lang'
        })
      });

      // Should fall back to default language and still work
      expect(response.results).toBeDefined();
    });
  });

  describe('Service Information', () => {
    test('should provide service information', async () => {
      const response = await apiRequest('/info');

      expect(response.service).toBeDefined();
      expect(response.version).toBeDefined();
      expect(response.phase).toBeDefined();
      expect(response.features).toBeDefined();
    });
  });
});