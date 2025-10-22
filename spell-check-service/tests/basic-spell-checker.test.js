/**
 * Basic Tests for Spell Check Service - Phase 1
 * Created: October 22, 2025 by AI Agent
 * Purpose: Validate core functionality and measure performance
 */

const { BasicSpellChecker } = require('../lib/BasicSpellChecker');

describe('Phase 1 - Basic Spell Check Service', () => {
  let spellChecker;

  beforeAll(async () => {
    spellChecker = new BasicSpellChecker();
    await spellChecker.init();
  });

  describe('Core Functionality', () => {
    test('should identify misspelled words', async () => {
      const text = "This is a test with misspeled words.";
      const result = await spellChecker.checkText(text);
      
      expect(result.spelling).toHaveLength(1);
      expect(result.spelling[0].word).toBe('misspeled');
      expect(result.spelling[0].suggestions).toContain('misspelled');
    });

    test('should respect custom words', async () => {
      const text = "This uses webpack and nspell libraries.";
      const customWords = ['webpack', 'nspell'];
      const result = await spellChecker.checkText(text, customWords);
      
      expect(result.spelling).toHaveLength(0);
    });

    test('should skip code blocks', async () => {
      const text = "Normal text with `codeblock misspeled` word.";
      const result = await spellChecker.checkText(text);
      
      // Should not flag 'misspeled' inside code block
      const codeBLockIssues = result.spelling.filter(issue => 
        issue.word === 'misspeled'
      );
      expect(codeBLockIssues).toHaveLength(0);
    });

    test('should provide position information', async () => {
      const text = "Test misspeled word";
      const result = await spellChecker.checkText(text);
      
      expect(result.spelling[0].position.start).toBe(5);
      expect(result.spelling[0].position.end).toBe(14);
      expect(result.spelling[0].lineNumber).toBe(1);
      expect(result.spelling[0].column).toBe(6);
    });
  });

  describe('Performance', () => {
    test('should process small text quickly', async () => {
      const text = "This is a small test text with one misspeled word.";
      const start = Date.now();
      
      const result = await spellChecker.checkText(text);
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(100); // < 100ms for small text
      expect(result.spelling).toHaveLength(1);
    });

    test('should handle medium text efficiently', async () => {
      const text = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(50) + "misspeled";
      const start = Date.now();
      
      const result = await spellChecker.checkText(text);
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(300); // < 300ms for medium text (~3KB)
      expect(result.spelling).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    test('should handle empty text', async () => {
      const result = await spellChecker.checkText("");
      expect(result.spelling).toHaveLength(0);
    });

    test('should handle text with no misspellings', async () => {
      const text = "This is a perfectly correct sentence.";
      const result = await spellChecker.checkText(text);
      expect(result.spelling).toHaveLength(0);
    });
  });
});

// Performance baseline measurement
describe('Performance Baseline', () => {
  test('measure baseline performance', async () => {
    const spellChecker = new BasicSpellChecker();
    await spellChecker.init();

    // Test cases with different sizes
    const testCases = [
      { name: 'Small (1KB)', text: "Test misspeled word. ".repeat(50) },
      { name: 'Medium (5KB)', text: "Test misspeled word. ".repeat(250) },
      { name: 'Large (10KB)', text: "Test misspeled word. ".repeat(500) }
    ];

    console.log('\n=== Phase 1 Performance Baseline ===');
    
    for (const testCase of testCases) {
      const iterations = 5;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await spellChecker.checkText(testCase.text);
        times.push(Date.now() - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);

      console.log(`${testCase.name}: avg=${avgTime.toFixed(1)}ms, min=${minTime}ms, max=${maxTime}ms`);
      
      // Assertions for performance targets
      if (testCase.name.includes('Small')) {
        expect(avgTime).toBeLessThan(100);
      } else if (testCase.name.includes('Medium')) {
        expect(avgTime).toBeLessThan(300);
      }
    }
  });
});