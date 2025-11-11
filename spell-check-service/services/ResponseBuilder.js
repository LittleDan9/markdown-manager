/**
 * Response Builder
 * Formats responses, calculates statistics, and handles response metadata
 */

const { SERVICE_INFO } = require('../utils/constants');
const StatisticsCalculator = require('./StatisticsCalculator');

/**
 * Response Builder Class
 * Handles response formatting and statistics calculation
 */
class ResponseBuilder {
  constructor(config = {}) {
    this.config = config;
    this.statisticsCalculator = new StatisticsCalculator();
  }

  /**
   * Build main spell check response
   */
  buildSpellCheckResponse(results, metadata = {}) {
    const {
      text,
      processingTime,
      detectedLanguage,
      languageDetectionResult,
      enabledFeatures = {},
      customWordsCount = 0,
      styleGuideApplied = null,
      readability = null,
      codeSpellStatistics = {},
      services = {}
    } = metadata;

    // Calculate comprehensive statistics
    const statistics = this.statisticsCalculator.calculateSpellCheckStatistics(results, text, processingTime, metadata);

    // Build feature status
    const featureStatus = {
      spellChecking: true,
      grammarChecking: enabledFeatures.enableGrammar !== false,
      styleAnalysis: enabledFeatures.enableStyle !== false,
      languageDetection: enabledFeatures.enableLanguageDetection !== false,
      contextualSuggestions: enabledFeatures.enableContextualSuggestions !== false,
      customDictionaries: !!enabledFeatures.authToken,
      styleGuides: !!styleGuideApplied,
      codeSpellCheck: enabledFeatures.enableCodeSpellCheck === true
    };

    // Get available options
    const availableLanguages = services.spellChecker
      ? services.spellChecker.dictionaryManager?.getAvailableLanguages() || []
      : [];

    const response = {
      results: results,
      language: detectedLanguage,
      languageDetection: languageDetectionResult,
      readability: readability,
      processingTime,
      statistics,
      service: SERVICE_INFO.name,
      version: SERVICE_INFO.version,
      phase: SERVICE_INFO.phase,
      timestamp: new Date().toISOString(),
      enabledFeatures: featureStatus,
      availableLanguages,
      styleGuideApplied,
      customWordsCount,
      codeSpellStatistics
    };

    // Add performance warnings if applicable
    const warnings = this.statisticsCalculator.generatePerformanceWarnings(statistics, processingTime);
    if (warnings.length > 0) {
      response.warnings = warnings;
    }

    return response;
  }

  /**
   * Build batch processing response
   */
  buildBatchResponse(results, metadata = {}) {
    const {
      processingTime,
      chunkInfo = {},
      statistics = {},
      customWordsCount = 0
    } = metadata;

    return {
      results: results,
      processingTime,
      statistics,
      service: SERVICE_INFO.name,
      version: SERVICE_INFO.version,
      phase: SERVICE_INFO.phase,
      timestamp: new Date().toISOString(),
      batchInfo: {
        chunkCount: chunkInfo.chunkCount || 0,
        averageChunkSize: chunkInfo.averageChunkSize || 0,
        maxConcurrency: chunkInfo.maxConcurrency || 3,
        processingStrategy: 'parallel-chunks'
      },
      customWordsCount
    };
  }

  /**
   * Build health response
   */
  buildHealthResponse(healthInfo, detailed = false) {
    const baseResponse = {
      status: 'healthy',
      service: SERVICE_INFO.name,
      version: SERVICE_INFO.version,
      phase: SERVICE_INFO.phase,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };

    if (detailed) {
      return {
        ...baseResponse,
        system: {
          memory: process.memoryUsage(),
          platform: process.platform,
          nodeVersion: process.version,
          cpuUsage: process.cpuUsage()
        },
        ...healthInfo
      };
    }

    return {
      ...baseResponse,
      memory: process.memoryUsage(),
      components: this.summarizeComponentHealth(healthInfo.services || {})
    };
  }

  /**
   * Build info response
   */
  buildInfoResponse(services = {}) {
    const { spellChecker, styleGuideManager, cspellCodeChecker } = services;

    return {
      service: SERVICE_INFO.name,
      version: SERVICE_INFO.version,
      phase: SERVICE_INFO.phase,
      description: SERVICE_INFO.description,
      features: {
        spellChecking: true,
        grammarChecking: true,
        styleAnalysis: true,
        languageDetection: true,
        multiLanguage: true,
        readabilityAnalysis: true,
        contextualSuggestions: true,
        customDictionaries: true,
        styleGuides: true,
        batchProcessing: true,
        codeSpellCheck: !!cspellCodeChecker
      },
      supportedLanguages: spellChecker
        ? spellChecker.dictionaryManager?.getAvailableLanguages() || []
        : [],
      supportedStyleGuides: styleGuideManager
        ? styleGuideManager.getAvailableStyleGuides()?.map(sg => sg.id) || []
        : [],
      codeSpellSupportedLanguages: cspellCodeChecker
        ? cspellCodeChecker.getSupportedLanguages() || []
        : [],
      maxTextSize: this.config.performance?.maxTextSizeBytes || 50000,
      performance: {
        targetResponseTime: '200ms for 5KB text',
        contextualAnalysis: '30% improved suggestion accuracy',
        caching: true,
        memoryOptimized: true,
        batchProcessing: 'up to 100KB documents'
      },
      endpoints: {
        health: '/health',
        check: '/check',
        batch: '/check-batch',
        languages: '/languages',
        styleGuides: '/style-guides',
        contextualSuggestions: '/contextual-suggestions'
      }
    };
  }

  /**
   * Summarize component health status
   */
  summarizeComponentHealth(services = {}) {
    const components = {};

    Object.entries(services).forEach(([name, service]) => {
      try {
        if (service && typeof service === 'object') {
          // Check if service has health check method
          if (typeof service.getHealth === 'function') {
            components[name] = service.getHealth();
          } else if (typeof service.isReady === 'function') {
            components[name] = { status: service.isReady() ? 'healthy' : 'unhealthy' };
          } else {
            // Assume healthy if service exists and initialized
            components[name] = { status: 'healthy' };
          }
        } else {
          components[name] = { status: 'unavailable' };
        }
      } catch (error) {
        components[name] = { 
          status: 'error', 
          error: error.message 
        };
      }
    });

    return components;
  }

  /**
   * Build error response
   */
  buildErrorResponse(error, statusCode, req = null) {
    const response = {
      error: error.name || 'Error',
      message: error.message,
      service: SERVICE_INFO.name,
      timestamp: new Date().toISOString(),
      statusCode
    };

    if (req) {
      response.path = req.path;
      response.method = req.method;
    }

    // Add request ID if available
    if (req?.id) {
      response.requestId = req.id;
    }

    // Add error details for specific error types
    if (error.field) {
      response.field = error.field;
    }

    if (error.service) {
      response.affectedService = error.service;
    }

    // Add stack trace in development
    if (process.env.NODE_ENV === 'development' && error.stack) {
      response.stack = error.stack;
    }

    return response;
  }

  /**
   * Format response with consistent structure
   */
  formatResponse(data, metadata = {}) {
    const formatted = {
      ...data,
      timestamp: new Date().toISOString(),
      service: SERVICE_INFO.name,
      version: SERVICE_INFO.version
    };

    // Add request correlation ID if available
    if (metadata.requestId) {
      formatted.requestId = metadata.requestId;
    }

    // Add processing metadata
    if (metadata.processingTime) {
      formatted.processingTime = metadata.processingTime;
    }

    return formatted;
  }
}

module.exports = ResponseBuilder;