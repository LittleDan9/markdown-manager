/**
 * Style Guide Routes
 * Endpoints for style guide management and analysis
 */

const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateTextInput } = require('../middleware/validation');
const { generalRateLimiter } = require('../middleware/security');

/**
 * Setup style guide routes
 * @param {ServiceManager} serviceManager - Service manager instance
 * @param {ResponseBuilder} responseBuilder - Response builder instance
 * @returns {express.Router} Style guide routes
 */
function setupStyleGuideRoutes(serviceManager, responseBuilder) {
  const router = express.Router();

  /**
   * Get available style guides
   * GET /style-guides
   */
  router.get('/style-guides', asyncHandler(async (req, res) => {
    try {
      const services = serviceManager.getServices();
      const { styleGuideManager } = services;

      if (!styleGuideManager) {
        const error = new Error('Style guide manager not initialized');
        error.name = 'ServiceUnavailableError';
        const errorResponse = responseBuilder.buildErrorResponse(error, 503, req);
        return res.status(503).json(errorResponse);
      }

      const styleGuides = styleGuideManager.getAvailableStyleGuides();

      const response = {
        styleGuides: styleGuides.map(guide => ({
          ...guide,
          rulesCount: guide.ruleCount || 0,
          categories: guide.categories || []
        })),
        total: styleGuides.length,
        supported: true
      };

      res.json(responseBuilder.formatResponse(response));

    } catch (error) {
      console.error('Failed to get style guides:', error);
      const errorResponse = responseBuilder.buildErrorResponse(error, 500, req);
      res.status(500).json(errorResponse);
    }
  }));

  /**
   * Get style guide rules
   * GET /style-guides/:guide/rules
   */
  router.get('/style-guides/:guide/rules', asyncHandler(async (req, res) => {
    try {
      const { guide } = req.params;
      const { category } = req.query; // Optional category filter

      const services = serviceManager.getServices();
      const { styleGuideManager } = services;

      if (!styleGuideManager) {
        const error = new Error('Style guide manager not initialized');
        error.name = 'ServiceUnavailableError';
        const errorResponse = responseBuilder.buildErrorResponse(error, 503, req);
        return res.status(503).json(errorResponse);
      }

      try {
        let rules = styleGuideManager.getStyleGuideRules(guide);
        const categories = styleGuideManager.getStyleGuideCategories(guide);

        // Filter by category if specified
        if (category) {
          rules = rules.filter(rule => rule.category === category);
        }

        const response = {
          styleGuide: guide,
          rules: rules.map(rule => ({
            id: rule.id,
            name: rule.name,
            description: rule.description,
            category: rule.category,
            severity: rule.severity || 'warning',
            examples: rule.examples || [],
            enabled: rule.enabled !== false
          })),
          categories: categories,
          totalRules: rules.length,
          activeCategory: category || null
        };

        res.json(responseBuilder.formatResponse(response));

      } catch (styleError) {
        if (styleError.message.includes('Unknown style guide')) {
          const errorResponse = responseBuilder.buildErrorResponse(styleError, 404, req);
          return res.status(404).json(errorResponse);
        }
        throw styleError;
      }

    } catch (error) {
      console.error('Failed to get style guide rules:', error);
      const errorResponse = responseBuilder.buildErrorResponse(error, 500, req);
      res.status(500).json(errorResponse);
    }
  }));

  /**
   * Get style guide recommendations for text
   * POST /style-guides/recommend
   */
  router.post('/style-guides/recommend',
    generalRateLimiter,
    validateTextInput({ required: true, maxTextSizeBytes: 10000 }),
    asyncHandler(async (req, res) => {
      try {
        const { text } = req.body;

        const services = serviceManager.getServices();
        const { styleGuideManager } = services;

        if (!styleGuideManager) {
          const error = new Error('Style guide manager not initialized');
          error.name = 'ServiceUnavailableError';
          const errorResponse = responseBuilder.buildErrorResponse(error, 503, req);
          return res.status(503).json(errorResponse);
        }

        const recommendations = styleGuideManager.recommendStyleGuides(text);

        const response = {
          recommendations: recommendations.map(rec => ({
            styleGuide: rec.styleGuide,
            confidence: rec.confidence,
            reasons: rec.reasons || [],
            score: rec.score || 0,
            applicableRules: rec.applicableRules || 0
          })),
          analysisLength: text.length,
          wordCount: text.split(/\s+/).length,
          recommendationCount: recommendations.length
        };

        res.json(responseBuilder.formatResponse(response));

      } catch (error) {
        console.error('Failed to recommend style guides:', error);
        const errorResponse = responseBuilder.buildErrorResponse(error, 500, req);
        res.status(500).json(errorResponse);
      }
    })
  );

  /**
   * Analyze text with specific style guide
   * POST /style-guides/:guide/analyze
   */
  router.post('/style-guides/:guide/analyze',
    generalRateLimiter,
    validateTextInput({ required: true, maxTextSizeBytes: 25000 }),
    asyncHandler(async (req, res) => {
      try {
        const { guide } = req.params;
        const { text, options = {} } = req.body;

        const services = serviceManager.getServices();
        const { styleGuideManager } = services;

        if (!styleGuideManager) {
          const error = new Error('Style guide manager not initialized');
          error.name = 'ServiceUnavailableError';
          const errorResponse = responseBuilder.buildErrorResponse(error, 503, req);
          return res.status(503).json(errorResponse);
        }

        try {
          const startTime = Date.now();
          const results = styleGuideManager.analyzeWithStyleGuide(text, guide, options);
          const processingTime = Date.now() - startTime;

          const response = {
            styleGuide: guide,
            results: results.map(result => ({
              ...result,
              position: result.position || { start: 0, end: 0 },
              severity: result.severity || 'warning',
              category: result.category || 'style',
              rule: result.rule || 'unknown'
            })),
            statistics: {
              issuesFound: results.length,
              processingTimeMs: processingTime,
              textLength: text.length,
              rulesApplied: [...new Set(results.map(r => r.rule))].length
            },
            summary: {
              errors: results.filter(r => r.severity === 'error').length,
              warnings: results.filter(r => r.severity === 'warning').length,
              suggestions: results.filter(r => r.severity === 'suggestion').length
            }
          };

          res.json(responseBuilder.formatResponse(response, { processingTime }));

        } catch (styleError) {
          if (styleError.message.includes('Unknown style guide')) {
            const errorResponse = responseBuilder.buildErrorResponse(styleError, 404, req);
            return res.status(404).json(errorResponse);
          }
          throw styleError;
        }

      } catch (error) {
        console.error(`Failed to analyze with style guide ${req.params.guide}:`, error);
        const errorResponse = responseBuilder.buildErrorResponse(error, 500, req);
        res.status(500).json(errorResponse);
      }
    })
  );

  /**
   * Get style guide information
   * GET /style-guides/:guide
   */
  router.get('/style-guides/:guide', asyncHandler(async (req, res) => {
    try {
      const { guide } = req.params;

      const services = serviceManager.getServices();
      const { styleGuideManager } = services;

      if (!styleGuideManager) {
        const error = new Error('Style guide manager not initialized');
        error.name = 'ServiceUnavailableError';
        const errorResponse = responseBuilder.buildErrorResponse(error, 503, req);
        return res.status(503).json(errorResponse);
      }

      try {
        const styleGuides = styleGuideManager.getAvailableStyleGuides();
        const styleGuideInfo = styleGuides.find(sg => sg.id === guide);

        if (!styleGuideInfo) {
          const error = new Error(`Style guide '${guide}' not found`);
          error.name = 'NotFoundError';
          const errorResponse = responseBuilder.buildErrorResponse(error, 404, req);
          return res.status(404).json(errorResponse);
        }

        const rules = styleGuideManager.getStyleGuideRules(guide);
        const categories = styleGuideManager.getStyleGuideCategories(guide);

        const response = {
          ...styleGuideInfo,
          rules: {
            total: rules.length,
            byCategory: categories.reduce((acc, cat) => {
              acc[cat] = rules.filter(r => r.category === cat).length;
              return acc;
            }, {}),
            bySeverity: {
              error: rules.filter(r => r.severity === 'error').length,
              warning: rules.filter(r => r.severity === 'warning').length,
              suggestion: rules.filter(r => r.severity === 'suggestion').length
            }
          },
          categories: categories,
          supported: true
        };

        res.json(responseBuilder.formatResponse(response));

      } catch (styleError) {
        if (styleError.message.includes('Unknown style guide')) {
          const errorResponse = responseBuilder.buildErrorResponse(styleError, 404, req);
          return res.status(404).json(errorResponse);
        }
        throw styleError;
      }

    } catch (error) {
      console.error(`Failed to get style guide info for ${req.params.guide}:`, error);
      const errorResponse = responseBuilder.buildErrorResponse(error, 500, req);
      res.status(500).json(errorResponse);
    }
  }));

  return router;
}

module.exports = setupStyleGuideRoutes;