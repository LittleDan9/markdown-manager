/**
 * Direct Dictionary API Routes
 * Phase 5: Direct access to user dictionaries without backend proxy
 */

const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const spellDatabase = require('../lib/database/models');
const CustomDictionaryManager = require('../lib/CustomDictionaryManager');

/**
 * Setup direct dictionary routes
 * @param {Object} serviceManager - Service manager instance
 * @param {Object} responseBuilder - Response builder instance
 * @returns {express.Router} Dictionary routes
 */
function setupDictionaryRoutes(serviceManager, responseBuilder) {
  const router = express.Router();
  const customDictionaryManager = new CustomDictionaryManager();

  /**
   * Get user dictionary
   * GET /dict/:tenant_id/:user_id
   */
  router.get('/dict/:tenant_id/:user_id',
    asyncHandler(async (req, res) => {
      const { tenant_id: tenantId, user_id: userId } = req.params;

      try {
        // Validate UUID format
        if (!isValidUUID(tenantId) || !isValidUUID(userId)) {
          return res.status(400).json({
            error: 'Invalid tenant_id or user_id format'
          });
        }

        // Get dictionary using CustomDictionaryManager
        const words = await customDictionaryManager.getCustomWords({
          tenantId,
          userId
        });

        // Get additional metadata
        const dictionary = await spellDatabase.getUserDictionary(tenantId, userId);
        const identity = await spellDatabase.getIdentityProjection(tenantId, userId);

        const response = {
          tenantId,
          userId,
          words,
          version: dictionary?.version || 1,
          wordCount: words.length,
          updatedAt: dictionary?.updatedAt || new Date(),
          userStatus: identity?.status || 'unknown'
        };

        res.json(response);
      } catch (error) {
        console.error(`[DictionaryAPI] Failed to get dictionary for user ${userId}:`, error);
        const errorResponse = responseBuilder.buildErrorResponse(error, 500, req);
        res.status(500).json(errorResponse);
      }
    })
  );

  /**
   * Update user dictionary
   * PUT /dict/:tenant_id/:user_id
   */
  router.put('/dict/:tenant_id/:user_id',
    asyncHandler(async (req, res) => {
      const { tenant_id: tenantId, user_id: userId } = req.params;
      const { words, version } = req.body;

      try {
        // Validate UUID format
        if (!isValidUUID(tenantId) || !isValidUUID(userId)) {
          return res.status(400).json({
            error: 'Invalid tenant_id or user_id format'
          });
        }

        // Validate request body
        if (!Array.isArray(words)) {
          return res.status(400).json({
            error: 'Words must be an array'
          });
        }

        if (!customDictionaryManager.validateCustomWords(words)) {
          return res.status(400).json({
            error: 'Invalid words format - must be array of strings with length <= 100'
          });
        }

        // Update dictionary
        await customDictionaryManager.updateUserDictionary({
          tenantId,
          userId,
          words,
          version
        });

        // Get updated dictionary for response
        const updatedDictionary = await spellDatabase.getUserDictionary(tenantId, userId);

        const response = {
          tenantId,
          userId,
          words: updatedDictionary.words,
          version: updatedDictionary.version,
          wordCount: updatedDictionary.words.length,
          updatedAt: updatedDictionary.updatedAt,
          message: 'Dictionary updated successfully'
        };

        res.json(response);
      } catch (error) {
        console.error(`[DictionaryAPI] Failed to update dictionary for user ${userId}:`, error);

        if (error.message.includes('version conflict')) {
          return res.status(409).json({
            error: 'Dictionary version conflict - please refresh and retry',
            code: 'VERSION_CONFLICT'
          });
        }

        const errorResponse = responseBuilder.buildErrorResponse(error, 500, req);
        res.status(500).json(errorResponse);
      }
    })
  );

  /**
   * Add words to user dictionary
   * POST /dict/:tenant_id/:user_id/words
   */
  router.post('/dict/:tenant_id/:user_id/words',
    asyncHandler(async (req, res) => {
      const { tenant_id: tenantId, user_id: userId } = req.params;
      const { words } = req.body;

      try {
        // Validate UUID format
        if (!isValidUUID(tenantId) || !isValidUUID(userId)) {
          return res.status(400).json({
            error: 'Invalid tenant_id or user_id format'
          });
        }

        // Validate request body
        if (!Array.isArray(words) || words.length === 0) {
          return res.status(400).json({
            error: 'Words must be a non-empty array'
          });
        }

        if (!customDictionaryManager.validateCustomWords(words)) {
          return res.status(400).json({
            error: 'Invalid words format - must be array of strings with length <= 100'
          });
        }

        // Add words
        await customDictionaryManager.addCustomWords({
          tenantId,
          userId,
          words
        });

        // Get updated dictionary for response
        const updatedDictionary = await spellDatabase.getUserDictionary(tenantId, userId);

        const response = {
          tenantId,
          userId,
          addedWords: words,
          totalWords: updatedDictionary.words.length,
          version: updatedDictionary.version,
          updatedAt: updatedDictionary.updatedAt,
          message: `Added ${words.length} words to dictionary`
        };

        res.status(201).json(response);
      } catch (error) {
        console.error(`[DictionaryAPI] Failed to add words for user ${userId}:`, error);
        const errorResponse = responseBuilder.buildErrorResponse(error, 500, req);
        res.status(500).json(errorResponse);
      }
    })
  );

  /**
   * Remove words from user dictionary
   * DELETE /dict/:tenant_id/:user_id/words
   */
  router.delete('/dict/:tenant_id/:user_id/words',
    asyncHandler(async (req, res) => {
      const { tenant_id: tenantId, user_id: userId } = req.params;
      const { words } = req.body;

      try {
        // Validate UUID format
        if (!isValidUUID(tenantId) || !isValidUUID(userId)) {
          return res.status(400).json({
            error: 'Invalid tenant_id or user_id format'
          });
        }

        // Validate request body
        if (!Array.isArray(words) || words.length === 0) {
          return res.status(400).json({
            error: 'Words must be a non-empty array'
          });
        }

        // Remove words
        await customDictionaryManager.removeCustomWords({
          tenantId,
          userId,
          words
        });

        // Get updated dictionary for response
        const updatedDictionary = await spellDatabase.getUserDictionary(tenantId, userId);

        const response = {
          tenantId,
          userId,
          removedWords: words,
          totalWords: updatedDictionary.words.length,
          version: updatedDictionary.version,
          updatedAt: updatedDictionary.updatedAt,
          message: `Removed ${words.length} words from dictionary`
        };

        res.json(response);
      } catch (error) {
        console.error(`[DictionaryAPI] Failed to remove words for user ${userId}:`, error);
        const errorResponse = responseBuilder.buildErrorResponse(error, 500, req);
        res.status(500).json(errorResponse);
      }
    })
  );

  /**
   * Search user dictionary
   * GET /dict/:tenant_id/:user_id/search?term=word&limit=20
   */
  router.get('/dict/:tenant_id/:user_id/search',
    asyncHandler(async (req, res) => {
      const { tenant_id: tenantId, user_id: userId } = req.params;
      const { term: searchTerm, limit = 20 } = req.query;

      try {
        // Validate UUID format
        if (!isValidUUID(tenantId) || !isValidUUID(userId)) {
          return res.status(400).json({
            error: 'Invalid tenant_id or user_id format'
          });
        }

        if (!searchTerm || typeof searchTerm !== 'string') {
          return res.status(400).json({
            error: 'Search term is required'
          });
        }

        const results = await customDictionaryManager.searchUserDictionary({
          tenantId,
          userId,
          searchTerm,
          limit: Math.min(parseInt(limit) || 20, 100)
        });

        res.json({
          tenantId,
          userId,
          searchTerm,
          results,
          count: results.length
        });
      } catch (error) {
        console.error(`[DictionaryAPI] Failed to search dictionary for user ${userId}:`, error);
        const errorResponse = responseBuilder.buildErrorResponse(error, 500, req);
        res.status(500).json(errorResponse);
      }
    })
  );

  return router;
}

/**
 * Validate UUID format
 * @param {string} uuid - UUID to validate
 * @returns {boolean} True if valid UUID
 */
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

module.exports = setupDictionaryRoutes;