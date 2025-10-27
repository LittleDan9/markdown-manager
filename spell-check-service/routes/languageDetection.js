/**
 * Language Detection Routes
 * Endpoints for language detection and language information
 */

const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateLanguageDetectionRequest } = require('../middleware/validation');
const { generalRateLimiter } = require('../middleware/security');

/**
 * Setup language detection routes
 * @param {ServiceManager} serviceManager - Service manager instance
 * @param {ResponseBuilder} responseBuilder - Response builder instance
 * @returns {express.Router} Language detection routes
 */
function setupLanguageDetectionRoutes(serviceManager, responseBuilder) {
  const router = express.Router();

  /**
   * Language detection endpoint
   * POST /detect-language
   */
  router.post('/detect-language',
    generalRateLimiter,
    validateLanguageDetectionRequest,
    asyncHandler(async (req, res) => {
      try {
        const { text, options = {} } = req.body;

        const services = serviceManager.getServices();
        const { languageDetector } = services;

        if (!languageDetector) {
          const error = new Error('Language detector not initialized');
          error.name = 'ServiceUnavailableError';
          const errorResponse = responseBuilder.buildErrorResponse(error, 503, req);
          return res.status(503).json(errorResponse);
        }

        const result = await languageDetector.detectLanguage(text, options);

        const response = responseBuilder.formatResponse(result, {
          requestId: req.id,
          processingTime: result.processingTime
        });

        res.json(response);

      } catch (error) {
        console.error('Language detection error:', error);
        const errorResponse = responseBuilder.buildErrorResponse(error, 500, req);
        res.status(500).json(errorResponse);
      }
    })
  );

  /**
   * Available languages endpoint
   * GET /languages
   */
  router.get('/languages', asyncHandler(async (req, res) => {
    try {
      const services = serviceManager.getServices();
      const { spellChecker } = services;

      if (!spellChecker) {
        const error = new Error('Spell checker not initialized');
        error.name = 'ServiceUnavailableError';
        const errorResponse = responseBuilder.buildErrorResponse(error, 503, req);
        return res.status(503).json(errorResponse);
      }

      const languageInfo = {
        languages: spellChecker.dictionaryManager.getAvailableLanguages(),
        supported: spellChecker.dictionaryManager.supportedLanguages.size,
        memoryUsage: spellChecker.dictionaryManager.getMemoryUsage(),
        details: []
      };

      // Add detailed information for each language if requested
      if (req.query.detailed === 'true') {
        const availableLanguages = spellChecker.dictionaryManager.getAvailableLanguages();

        languageInfo.details = availableLanguages.map(lang => {
          try {
            const stats = spellChecker.dictionaryManager.getLanguageStats(lang);
            return {
              code: lang,
              name: getLanguageName(lang),
              region: getLanguageRegion(lang),
              wordCount: stats ? stats.wordCount : 0,
              loaded: stats ? stats.loaded : false,
              memoryUsage: stats ? stats.memoryUsage : 0
            };
          } catch (error) {
            return {
              code: lang,
              name: getLanguageName(lang),
              region: getLanguageRegion(lang),
              error: 'Failed to get language details'
            };
          }
        });
      }

      const response = responseBuilder.formatResponse(languageInfo);
      res.json(response);

    } catch (error) {
      console.error('Failed to get language information:', error);
      const errorResponse = responseBuilder.buildErrorResponse(error, 500, req);
      res.status(500).json(errorResponse);
    }
  }));

  /**
   * Language statistics endpoint
   * GET /languages/:languageCode/stats
   */
  router.get('/languages/:languageCode/stats', asyncHandler(async (req, res) => {
    try {
      const { languageCode } = req.params;

      const services = serviceManager.getServices();
      const { spellChecker } = services;

      if (!spellChecker) {
        const error = new Error('Spell checker not initialized');
        error.name = 'ServiceUnavailableError';
        const errorResponse = responseBuilder.buildErrorResponse(error, 503, req);
        return res.status(503).json(errorResponse);
      }

      // Validate language code
      const availableLanguages = spellChecker.dictionaryManager.getAvailableLanguages();
      if (!availableLanguages.includes(languageCode)) {
        const error = new Error(`Language '${languageCode}' not supported`);
        error.name = 'NotFoundError';
        const errorResponse = responseBuilder.buildErrorResponse(error, 404, req);
        return res.status(404).json(errorResponse);
      }

      const stats = spellChecker.dictionaryManager.getLanguageStats(languageCode);
      const languageInfo = {
        language: {
          code: languageCode,
          name: getLanguageName(languageCode),
          region: getLanguageRegion(languageCode)
        },
        statistics: stats || {
          wordCount: 0,
          loaded: false,
          memoryUsage: 0,
          lastAccessed: null
        },
        performance: {
          avgLookupTime: stats ? stats.avgLookupTime : null,
          cacheHitRate: stats ? stats.cacheHitRate : null,
          totalLookups: stats ? stats.totalLookups : 0
        }
      };

      const response = responseBuilder.formatResponse(languageInfo);
      res.json(response);

    } catch (error) {
      console.error(`Failed to get statistics for language ${req.params.languageCode}:`, error);
      const errorResponse = responseBuilder.buildErrorResponse(error, 500, req);
      res.status(500).json(errorResponse);
    }
  }));

  return router;
}

/**
 * Get human-readable language name from language code
 * @param {string} langCode - Language code (e.g., 'en-US')
 * @returns {string} Language name
 */
function getLanguageName(langCode) {
  const languageNames = {
    'en-US': 'English (United States)',
    'en-GB': 'English (United Kingdom)',
    'en-CA': 'English (Canada)',
    'en-AU': 'English (Australia)',
    'es-ES': 'Spanish (Spain)',
    'es-MX': 'Spanish (Mexico)',
    'fr-FR': 'French (France)',
    'fr-CA': 'French (Canada)',
    'de-DE': 'German (Germany)',
    'de-AT': 'German (Austria)',
    'it-IT': 'Italian (Italy)',
    'pt-PT': 'Portuguese (Portugal)',
    'pt-BR': 'Portuguese (Brazil)',
    'nl-NL': 'Dutch (Netherlands)',
    'sv-SE': 'Swedish (Sweden)',
    'da-DK': 'Danish (Denmark)',
    'no-NO': 'Norwegian (Norway)',
    'fi-FI': 'Finnish (Finland)',
    'pl-PL': 'Polish (Poland)',
    'cs-CZ': 'Czech (Czech Republic)',
    'ru-RU': 'Russian (Russia)',
    'ja-JP': 'Japanese (Japan)',
    'ko-KR': 'Korean (Korea)',
    'zh-CN': 'Chinese (Simplified)',
    'zh-TW': 'Chinese (Traditional)',
    'ar-SA': 'Arabic (Saudi Arabia)',
    'hi-IN': 'Hindi (India)',
    'th-TH': 'Thai (Thailand)',
    'vi-VN': 'Vietnamese (Vietnam)'
  };

  return languageNames[langCode] || langCode;
}

/**
 * Get language region from language code
 * @param {string} langCode - Language code (e.g., 'en-US')
 * @returns {string} Region code
 */
function getLanguageRegion(langCode) {
  const parts = langCode.split('-');
  return parts.length > 1 ? parts[1] : '';
}

module.exports = setupLanguageDetectionRoutes;