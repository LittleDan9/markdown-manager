/**
 * Contextual Analysis Routes
 * Endpoints for contextual suggestion analysis
 */

const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateContextualSuggestionsRequest } = require('../middleware/validation');
const { generalRateLimiter } = require('../middleware/security');

/**
 * Setup contextual analysis routes
 * @param {ServiceManager} serviceManager - Service manager instance
 * @param {ResponseBuilder} responseBuilder - Response builder instance
 * @returns {express.Router} Contextual analysis routes
 */
function setupContextualAnalysisRoutes(serviceManager, responseBuilder) {
  const router = express.Router();

  /**
   * Get contextual suggestions for a word
   * POST /contextual-suggestions
   */
  router.post('/contextual-suggestions',
    generalRateLimiter,
    validateContextualSuggestionsRequest,
    asyncHandler(async (req, res) => {
      try {
        const {
          word,
          context,
          position,
          basicSuggestions = [],
          options = {}
        } = req.body;

        const services = serviceManager.getServices();
        const { contextualAnalyzer } = services;

        if (!contextualAnalyzer) {
          const error = new Error('Contextual analyzer not initialized');
          error.name = 'ServiceUnavailableError';
          const errorResponse = responseBuilder.buildErrorResponse(error, 503, req);
          return res.status(503).json(errorResponse);
        }

        const startTime = Date.now();
        const result = await contextualAnalyzer.getContextualSuggestions(
          word,
          context,
          position,
          basicSuggestions,
          options
        );
        const processingTime = Date.now() - startTime;

        // Enhance response with additional metadata
        const enhancedResult = {
          word,
          position,
          suggestions: result.suggestions.map((suggestion, index) => ({
            ...suggestion,
            rank: index + 1,
            contextRelevance: suggestion.confidence || 0,
            isContextual: suggestion.contextual || false
          })),
          contextAnalysis: {
            ...result.contextAnalysis,
            surroundingText: {
              before: context.substring(Math.max(0, position - 50), position),
              after: context.substring(position + word.length, position + word.length + 50)
            }
          },
          statistics: {
            originalSuggestions: basicSuggestions.length,
            enhancedSuggestions: result.suggestions.length,
            improvementRatio: basicSuggestions.length > 0 ?
              result.suggestions.length / basicSuggestions.length : 1,
            processingTimeMs: processingTime,
            confidence: result.suggestions[0]?.confidence || 0
          },
          metadata: {
            analysisType: 'contextual',
            algorithmVersion: result.algorithmVersion || '1.0',
            cacheHit: result.cacheHit || false
          }
        };

        res.json(responseBuilder.formatResponse(enhancedResult, {
          processingTime,
          requestId: req.id
        }));

      } catch (error) {
        console.error('Failed to get contextual suggestions:', error);
        const errorResponse = responseBuilder.buildErrorResponse(error, 500, req);
        res.status(500).json(errorResponse);
      }
    })
  );

  /**
   * Analyze context for multiple words
   * POST /contextual-suggestions/batch
   */
  router.post('/contextual-suggestions/batch',
    generalRateLimiter,
    asyncHandler(async (req, res) => {
      try {
        const {
          words = [],
          context,
          options = {}
        } = req.body;

        // Validate input
        if (!Array.isArray(words) || words.length === 0) {
          const error = new Error('words must be a non-empty array');
          error.name = 'ValidationError';
          const errorResponse = responseBuilder.buildErrorResponse(error, 400, req);
          return res.status(400).json(errorResponse);
        }

        if (!context || typeof context !== 'string') {
          const error = new Error('context is required and must be a string');
          error.name = 'ValidationError';
          const errorResponse = responseBuilder.buildErrorResponse(error, 400, req);
          return res.status(400).json(errorResponse);
        }

        if (words.length > 20) {
          const error = new Error('Maximum 20 words allowed per batch request');
          error.name = 'ValidationError';
          const errorResponse = responseBuilder.buildErrorResponse(error, 400, req);
          return res.status(400).json(errorResponse);
        }

        const services = serviceManager.getServices();
        const { contextualAnalyzer } = services;

        if (!contextualAnalyzer) {
          const error = new Error('Contextual analyzer not initialized');
          error.name = 'ServiceUnavailableError';
          const errorResponse = responseBuilder.buildErrorResponse(error, 503, req);
          return res.status(503).json(errorResponse);
        }

        const startTime = Date.now();
        const results = [];

        // Process each word
        for (const wordInfo of words) {
          try {
            const {
              word,
              position,
              basicSuggestions = []
            } = wordInfo;

            if (!word || position === undefined) {
              results.push({
                word: word || 'unknown',
                position: position || 0,
                error: 'Missing word or position',
                suggestions: []
              });
              continue;
            }

            const result = await contextualAnalyzer.getContextualSuggestions(
              word,
              context,
              position,
              basicSuggestions,
              options
            );

            results.push({
              word,
              position,
              suggestions: result.suggestions,
              contextAnalysis: result.contextAnalysis,
              confidence: result.suggestions[0]?.confidence || 0
            });

          } catch (wordError) {
            console.warn(`Failed to process word "${wordInfo.word}":`, wordError.message);
            results.push({
              word: wordInfo.word || 'unknown',
              position: wordInfo.position || 0,
              error: wordError.message,
              suggestions: wordInfo.basicSuggestions || []
            });
          }
        }

        const processingTime = Date.now() - startTime;

        const response = {
          results,
          statistics: {
            totalWords: words.length,
            successfulAnalyses: results.filter(r => !r.error).length,
            failedAnalyses: results.filter(r => r.error).length,
            processingTimeMs: processingTime,
            averageTimePerWord: Math.round(processingTime / words.length)
          },
          context: {
            length: context.length,
            wordCount: context.split(/\s+/).length
          }
        };

        res.json(responseBuilder.formatResponse(response, {
          processingTime,
          requestId: req.id
        }));

      } catch (error) {
        console.error('Failed to process batch contextual suggestions:', error);
        const errorResponse = responseBuilder.buildErrorResponse(error, 500, req);
        res.status(500).json(errorResponse);
      }
    })
  );

  /**
   * Get contextual analyzer statistics and cache information
   * GET /contextual-suggestions/stats
   */
  router.get('/contextual-suggestions/stats', asyncHandler(async (req, res) => {
    try {
      const services = serviceManager.getServices();
      const { contextualAnalyzer } = services;

      if (!contextualAnalyzer) {
        const error = new Error('Contextual analyzer not initialized');
        error.name = 'ServiceUnavailableError';
        const errorResponse = responseBuilder.buildErrorResponse(error, 503, req);
        return res.status(503).json(errorResponse);
      }

      let stats = {};
      let cacheStats = {};

      try {
        if (contextualAnalyzer.getStatistics) {
          stats = contextualAnalyzer.getStatistics();
        }
        if (contextualAnalyzer.getCacheStats) {
          cacheStats = contextualAnalyzer.getCacheStats();
        }
      } catch (statsError) {
        console.warn('Failed to get contextual analyzer stats:', statsError.message);
      }

      const response = {
        service: 'contextual-analyzer',
        status: 'active',
        performance: {
          ...stats,
          memoryUsage: process.memoryUsage().heapUsed,
          uptime: process.uptime()
        },
        cache: {
          ...cacheStats,
          hitRate: cacheStats.hits && cacheStats.total ?
            Math.round((cacheStats.hits / cacheStats.total) * 100) : 0
        },
        capabilities: {
          supportedLanguages: stats.supportedLanguages || ['en'],
          maxContextLength: 10000,
          maxSuggestions: 10,
          batchProcessing: true
        }
      };

      res.json(responseBuilder.formatResponse(response));

    } catch (error) {
      console.error('Failed to get contextual analyzer stats:', error);
      const errorResponse = responseBuilder.buildErrorResponse(error, 500, req);
      res.status(500).json(errorResponse);
    }
  }));

  return router;
}

module.exports = setupContextualAnalysisRoutes;