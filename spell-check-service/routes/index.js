/**
 * Routes Index
 * Central route registration and middleware setup
 */

const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');

// Import route modules
const healthRoutes = require('./health');
const spellCheckRoutes = require('./spellCheck');
const batchProcessingRoutes = require('./batchProcessing');
const languageDetectionRoutes = require('./languageDetection');
const styleGuideRoutes = require('./styleGuides');
const contextualAnalysisRoutes = require('./contextualAnalysis');
const dictionaryRoutes = require('./dictionary');

/**
 * Setup all application routes
 * @param {ServiceManager} serviceManager - Initialized service manager
 * @param {ResponseBuilder} responseBuilder - Response builder instance
 * @returns {express.Router} Configured router
 */
function setupRoutes(serviceManager, responseBuilder) {
  const router = express.Router();

  // Health and info routes (no rate limiting)
  router.use('/', healthRoutes(serviceManager, responseBuilder));

  // Main spell check routes (with rate limiting)
  router.use('/', spellCheckRoutes(serviceManager, responseBuilder));

  // Batch processing routes
  router.use('/', batchProcessingRoutes(serviceManager, responseBuilder));

  // Language detection routes
  router.use('/', languageDetectionRoutes(serviceManager, responseBuilder));

  // Style guide routes
  router.use('/', styleGuideRoutes(serviceManager, responseBuilder));

  // Contextual analysis routes
  router.use('/', contextualAnalysisRoutes(serviceManager, responseBuilder));

  // Dictionary management routes (Phase 5)
  router.use('/', dictionaryRoutes(serviceManager, responseBuilder));

  // Service info endpoint
  router.get('/info', asyncHandler(async (req, res) => {
    const services = serviceManager.getServices();
    const response = responseBuilder.buildInfoResponse(services);
    res.json(response);
  }));

  return router;
}

module.exports = setupRoutes;