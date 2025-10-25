/**
 * Phase 4 Integration Tests for Spell Check Service Backend Migration
 *
 * Tests the migration from worker-based to backend API-based spell checking
 * Validates API integration, error handling, and compatibility
 *
 * Created: October 22, 2025 by AI Agent
 * Phase: 4 - Frontend Migration Testing
 */

import spellCheckApi from '../src/api/spellCheckApi';
import SpellCheckService from '../src/services/editor/SpellCheckService';

describe('Phase 4 Spell Check Integration Tests', () => {
  beforeAll(async () => {
    // Setup test environment
    console.log('Starting Phase 4 Integration Tests');
  });

  describe('Backend API Integration', () => {
    test('should connect to backend spell check service', async () => {
      const health = await spellCheckApi.checkHealth();
      expect(health.status).toBe('healthy');
      expect(health.service).toBeDefined();
    });

    test('should get service information', async () => {
      const info = await spellCheckApi.getServiceInfo();
      expect(info.service).toBeDefined();
      expect(info.integration).toBeDefined();
      expect(info.integration.features).toContain('spelling');
    });

    test('should check text for spelling errors', async () => {
      const testText = 'This is a test with a mispelled word.';
      const result = await spellCheckApi.checkText(testText);

      expect(result.results).toBeDefined();
      expect(result.results.spelling).toBeDefined();
      expect(Array.isArray(result.results.spelling)).toBe(true);

      // Should find the misspelled word
      const misspelledIssue = result.results.spelling.find(issue =>
        issue.word === 'mispelled'
      );
      expect(misspelledIssue).toBeDefined();
      expect(misspelledIssue.suggestions).toContain('misspelled');
    });

    test('should handle custom words', async () => {
      const testText = 'This contains a specialized technicalterm.';
      const customWords = ['technicalterm'];

      const result = await spellCheckApi.checkText(testText, customWords);

      // Should not flag custom words as errors
      const customWordIssue = result.results.spelling.find(issue =>
        issue.word === 'technicalterm'
      );
      expect(customWordIssue).toBeUndefined();
    });

    test('should handle large text gracefully', async () => {
      const largeText = 'This is a test sentence. '.repeat(1000);
      const result = await spellCheckApi.checkText(largeText);

      expect(result.results).toBeDefined();
      expect(result.statistics).toBeDefined();
      expect(result.statistics.words_checked).toBeGreaterThan(1000);
    });

    test('should handle empty text', async () => {
      const result = await spellCheckApi.checkText('');
      expect(result.results).toBeDefined();
      expect(result.results.spelling).toBeDefined();
      expect(result.results.spelling.length).toBe(0);
    });
  });

  describe('SpellCheckService Migration', () => {
    test('should initialize without errors', async () => {
      const service = new SpellCheckService.constructor();
      const initialized = await service.init();
      expect(initialized).toBeDefined();
    });

    test('should maintain compatibility with existing scan interface', async () => {
      const testText = 'This text has a mispelled word.';
      const issues = await SpellCheckService.scan(testText);

      expect(Array.isArray(issues)).toBe(true);

      if (issues.length > 0) {
        const issue = issues[0];
        expect(issue).toHaveProperty('word');
        expect(issue).toHaveProperty('suggestions');
        expect(issue).toHaveProperty('position');
      }
    });

    test('should handle progress callbacks', async () => {
      const testText = 'This text contains several mispelled words and errorss.';
      let progressCalled = false;

      const issues = await SpellCheckService.scan(testText, (progress, currentIssues) => {
        progressCalled = true;
        expect(typeof progress).toBe('number');
        expect(Array.isArray(currentIssues)).toBe(true);
      });

      expect(progressCalled).toBe(true);
      expect(Array.isArray(issues)).toBe(true);
    });

    test('should support category and folder context', async () => {
      const testText = 'Testing category-specific words.';
      const categoryId = 'test-category';
      const folderPath = '/test/folder';

      // Should not throw error with category/folder parameters
      const issues = await SpellCheckService.scan(testText, () => {}, categoryId, folderPath);
      expect(Array.isArray(issues)).toBe(true);
    });

    test('should provide service status information', async () => {
      const isAvailable = SpellCheckService.isBackendAvailable();
      expect(typeof isAvailable).toBe('boolean');

      const serviceInfo = await SpellCheckService.getServiceInfo();
      expect(serviceInfo).toBeDefined();
      expect(serviceInfo.service).toBeDefined();
    });
  });

  describe('Error Handling and Fallback', () => {
    test('should handle backend unavailable gracefully', async () => {
      // Mock a failed API call
      const originalCheckText = spellCheckApi.checkText;
      spellCheckApi.checkText = jest.fn().mockRejectedValue(new Error('Service unavailable'));

      try {
        const issues = await SpellCheckService.scan('Test text');
        expect(Array.isArray(issues)).toBe(true);
      } finally {
        // Restore original method
        spellCheckApi.checkText = originalCheckText;
      }
    });

    test('should provide meaningful error messages', async () => {
      const originalCheckText = spellCheckApi.checkText;
      spellCheckApi.checkText = jest.fn().mockRejectedValue(new Error('Network error'));

      try {
        await spellCheckApi.checkText('Test');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain('Service unavailable');
      } finally {
        spellCheckApi.checkText = originalCheckText;
      }
    });

    test('should refresh service status', async () => {
      const refreshed = await SpellCheckService.refreshServiceStatus();
      expect(typeof refreshed).toBe('boolean');
    });
  });

  describe('Custom Dictionary Integration', () => {
    test('should maintain custom word interface', () => {
      // These methods should exist for compatibility
      expect(typeof SpellCheckService.getCustomWords).toBe('function');
      expect(typeof SpellCheckService.addCustomWord).toBe('function');
      expect(typeof SpellCheckService.removeCustomWord).toBe('function');

      const customWords = SpellCheckService.getCustomWords();
      expect(Array.isArray(customWords)).toBe(true);
    });

    test('should handle custom word operations', () => {
      const testWord = 'technicalterm';

      // Add custom word
      SpellCheckService.addCustomWord(testWord);
      const wordsAfterAdd = SpellCheckService.getCustomWords();
      expect(wordsAfterAdd).toContain(testWord);

      // Remove custom word
      SpellCheckService.removeCustomWord(testWord);
      const wordsAfterRemove = SpellCheckService.getCustomWords();
      expect(wordsAfterRemove).not.toContain(testWord);
    });
  });

  describe('Performance and Reliability', () => {
    test('should respond within reasonable time limits', async () => {
      const startTime = Date.now();
      const testText = 'This is a performance test with some mispelled words.';

      const result = await spellCheckApi.checkText(testText);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should handle concurrent requests', async () => {
      const testTexts = [
        'First text with mispelled word.',
        'Second text with errorss.',
        'Third text with typos.'
      ];

      const promises = testTexts.map(text => spellCheckApi.checkText(text));
      const results = await Promise.all(promises);

      expect(results.length).toBe(3);
      results.forEach(result => {
        expect(result.results).toBeDefined();
        expect(result.results.spelling).toBeDefined();
      });
    });

    test('should provide processing statistics', async () => {
      const testText = 'This text is for testing statistics collection.';
      const result = await spellCheckApi.checkText(testText);

      expect(result.statistics).toBeDefined();
      expect(result.statistics.words_checked).toBeGreaterThan(0);
      expect(result.statistics.processing_time).toBeDefined();
      expect(typeof result.statistics.processing_time).toBe('number');
    });
  });

  afterAll(() => {
    console.log('Phase 4 Integration Tests completed');
  });
});

/**
 * Manual Test Scenarios for Browser Testing
 *
 * These scenarios should be manually tested in the browser:
 *
 * 1. Open editor with existing document
 * 2. Click spell check button in toolbar
 * 3. Verify issues are highlighted correctly
 * 4. Right-click on highlighted word to see suggestions
 * 5. Add word to custom dictionary
 * 6. Verify word is no longer flagged
 * 7. Test with document containing code blocks
 * 8. Test with large document (>1000 words)
 * 9. Test with network disconnected (fallback mode)
 * 10. Test performance compared to old worker-based system
 */