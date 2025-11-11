/**
 * Statistics Calculator
 * Handles calculation of processing statistics and performance metrics
 */

const { PERFORMANCE_THRESHOLDS } = require('../utils/constants');
const { countWords } = require('../utils/textUtils');

/**
 * Statistics Calculator Class
 * Calculates comprehensive statistics for spell check operations
 */
class StatisticsCalculator {
  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Calculate comprehensive statistics for spell check results
   */
  calculateSpellCheckStatistics(results, text, processingTime, metadata = {}) {
    const {
      customWordsCount = 0,
      services = {},
      styleGuideResults = []
    } = metadata;

    const statistics = {
      text: this.calculateTextStatistics(text),
      processing: this.calculateProcessingStatistics(text, processingTime),
      issues: this.calculateIssueStatistics(results, styleGuideResults),
      enhancements: this.calculateEnhancementStatistics(results, customWordsCount, services)
    };

    // Add severity breakdown
    statistics.severity = this.calculateSeverityBreakdown(results);

    return statistics;
  }

  /**
   * Calculate text-related statistics
   */
  calculateTextStatistics(text) {
    if (!text || typeof text !== 'string') {
      return {
        characters: 0,
        words: 0,
        lines: 0
      };
    }

    return {
      characters: text.length,
      words: countWords(text),
      lines: text.split('\n').length
    };
  }

  /**
   * Calculate processing performance statistics
   */
  calculateProcessingStatistics(text, processingTime) {
    const textStats = this.calculateTextStatistics(text);

    const stats = {
      timeMs: processingTime || 0,
      wordsPerSecond: 0,
      charactersPerSecond: 0
    };

    // Calculate processing rates
    if (processingTime > 0) {
      stats.wordsPerSecond = Math.round((textStats.words / processingTime) * 1000);
      stats.charactersPerSecond = Math.round((textStats.characters / processingTime) * 1000);
    }

    return stats;
  }

  /**
   * Calculate issue statistics
   */
  calculateIssueStatistics(results, styleGuideResults = []) {
    return {
      spelling: results.spelling?.length || 0,
      grammar: results.grammar?.length || 0,
      style: results.style?.length || 0,
      codeSpelling: results.codeSpelling?.length || 0,
      styleGuide: styleGuideResults.length || 0,
      total: (results.spelling?.length || 0) +
             (results.grammar?.length || 0) +
             (results.style?.length || 0) +
             (results.codeSpelling?.length || 0)
    };
  }

  /**
   * Calculate enhancement statistics
   */
  calculateEnhancementStatistics(results, customWordsCount, services) {
    return {
      customWordsUsed: customWordsCount,
      contextualSuggestionsApplied: results.spelling?.filter(s => s.enhanced)?.length || 0,
      engineInfo: {
        spellEngine: services.spellChecker?.spellEngine?.getStatistics() || null,
        codeSpellEngine: services.cspellCodeChecker?.getStatistics() || null
      }
    };
  }

  /**
   * Calculate severity breakdown of issues
   */
  calculateSeverityBreakdown(results) {
    const severity = {
      error: 0,
      warning: 0,
      info: 0,
      suggestion: 0
    };

    ['spelling', 'grammar', 'style', 'codeSpelling'].forEach(type => {
      if (results[type]) {
        results[type].forEach(issue => {
          const level = issue.severity || 'warning';
          if (severity.hasOwnProperty(level)) {
            severity[level]++;
          } else {
            severity.warning++; // Default to warning
          }
        });
      }
    });

    return severity;
  }

  /**
   * Generate performance warnings based on statistics
   */
  generatePerformanceWarnings(statistics, processingTime) {
    const warnings = [];

    if (processingTime > PERFORMANCE_THRESHOLDS.SLOW_REQUEST_MS) {
      warnings.push({
        type: 'performance',
        message: `Request took ${processingTime}ms, which exceeds the target response time`,
        threshold: PERFORMANCE_THRESHOLDS.SLOW_REQUEST_MS
      });
    }

    if (statistics.text.characters > PERFORMANCE_THRESHOLDS.WARNING_TEXT_SIZE_BYTES) {
      warnings.push({
        type: 'text-size',
        message: `Text size (${statistics.text.characters} characters) is large and may impact performance`,
        threshold: PERFORMANCE_THRESHOLDS.WARNING_TEXT_SIZE_BYTES
      });
    }

    const memUsage = process.memoryUsage();
    if (memUsage.heapUsed > PERFORMANCE_THRESHOLDS.HIGH_MEMORY_MB * 1024 * 1024) {
      warnings.push({
        type: 'memory',
        message: `High memory usage detected: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        threshold: `${PERFORMANCE_THRESHOLDS.HIGH_MEMORY_MB}MB`
      });
    }

    return warnings;
  }

  /**
   * Calculate batch processing statistics
   */
  calculateBatchStatistics(results, chunkInfo, processingTime, customWordsCount) {
    const issueStats = this.calculateIssueStatistics(results);

    return {
      characters: chunkInfo.totalCharacters || 0,
      chunks: chunkInfo.chunkCount || 0,
      processingTimeMs: processingTime,
      customWordsUsed: customWordsCount,
      issuesFound: issueStats,
      performance: {
        averageTimePerChunk: chunkInfo.chunkCount > 0 ?
          Math.round(processingTime / chunkInfo.chunkCount) : 0,
        concurrency: chunkInfo.maxConcurrency || 1
      }
    };
  }

  /**
   * Get system performance metrics
   */
  getSystemMetrics() {
    const memUsage = process.memoryUsage();

    return {
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024),
        total: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024)
      },
      uptime: process.uptime(),
      cpu: process.cpuUsage(),
      platform: process.platform,
      nodeVersion: process.version
    };
  }
}

module.exports = StatisticsCalculator;