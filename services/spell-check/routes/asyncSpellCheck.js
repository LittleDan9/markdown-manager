/**
 * Async Spell Check Routes
 * POST /check-async  — submit a spell-check job, returns { jobId } immediately
 * GET  /check-status/:jobId — poll for results
 *
 * Background processing uses setImmediate to yield the event loop between
 * CPU-bound analysis stages so the server stays responsive.
 */

const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateTextInput, validateSpellCheckRequest } = require('../middleware/validation');
const { checkRateLimiter } = require('../middleware/security');
const { DEFAULT_CONFIG } = require('../utils/constants');
const asyncJobManager = require('../services/AsyncJobManager');

/**
 * Run the full spell-check pipeline for a job, storing the result in Redis.
 * Each major analysis stage is scheduled via setImmediate so the event loop
 * can service other requests between stages.
 */
function processJobInBackground(jobId, body, serviceManager, responseBuilder) {
  // Use setImmediate to not block the request that created the job
  setImmediate(async () => {
    try {
      await asyncJobManager.markProcessing(jobId);

      const {
        text,
        customWords = [],
        chunk_offset = 0,
        options = {},
        language = null,
        enableGrammar = true,
        enableStyle = true,
        enableLanguageDetection = true,
        enableContextualSuggestions = true,
        enableCodeSpellCheck = false,
        styleGuide = null,
        authToken = null,
        userId = null,
        categoryId = null,
        folderPath = null,
        codeSpellSettings = {
          checkComments: true,
          checkStrings: false,
          checkIdentifiers: true,
          severity: 'info'
        }
      } = body;

      const startTime = Date.now();
      const services = serviceManager.getServices();
      const {
        spellChecker,
        grammarChecker,
        styleAnalyzer,
        languageDetector,
        customDictionaryManager,
        contextualAnalyzer,
        styleGuideManager,
        cspellCodeChecker
      } = services;

      // --- Stage 1: custom words ---
      let allCustomWords = [...customWords];
      if (authToken && customDictionaryManager) {
        try {
          const backendCustomWords = await customDictionaryManager.getCustomWords({
            authToken, userId, categoryId, folderPath, includeGlobal: true
          });
          allCustomWords = [...new Set([...allCustomWords, ...backendCustomWords])];
        } catch (error) {
          console.warn('[AsyncJob] Failed to retrieve custom words:', error.message);
        }
      }

      // --- Stage 2: language detection ---
      let detectedLanguage = language;
      let languageDetectionResult = null;
      if (enableLanguageDetection && !language && languageDetector) {
        try {
          languageDetectionResult = await languageDetector.detectLanguage(text);
          detectedLanguage = languageDetectionResult.language;
        } catch (error) {
          console.warn('[AsyncJob] Language detection failed:', error.message);
        }
      }

      // Yield to event loop
      await new Promise(r => setImmediate(r));

      // --- Stage 3: core spell check ---
      const spellResults = await spellChecker.checkText(text, {
        customWords: allCustomWords,
        language: detectedLanguage,
        autoDetectLanguage: false,
        chunkOffset: chunk_offset
      });

      // Yield to event loop
      await new Promise(r => setImmediate(r));

      // --- Stage 4: contextual enhancement (batched, capped) ---
      const MAX_CONTEXTUAL_ISSUES = 30;
      const CONTEXTUAL_BATCH_SIZE = 10;

      if (enableContextualSuggestions && spellResults.spelling && contextualAnalyzer) {
        const issuesToEnhance = spellResults.spelling.slice(0, MAX_CONTEXTUAL_ISSUES);
        for (let i = 0; i < issuesToEnhance.length; i += CONTEXTUAL_BATCH_SIZE) {
          const batch = issuesToEnhance.slice(i, i + CONTEXTUAL_BATCH_SIZE);
          await Promise.all(batch.map(async (issue) => {
            try {
              const contextualResult = await contextualAnalyzer.getContextualSuggestions(
                issue.word, text, issue.position.start, issue.suggestions || [], options
              );
              issue.suggestions = contextualResult.suggestions.map(s => s.word);
              issue.confidence = contextualResult.suggestions[0]?.confidence || issue.confidence;
              issue.contextAnalysis = contextualResult.contextAnalysis;
              issue.enhanced = true;
            } catch (error) {
              // Keep original suggestions on error
            }
          }));
          // Yield between batches
          await new Promise(r => setImmediate(r));
        }
      }

      // --- Stage 5: parallel grammar / style / style-guide / code-spell ---
      const [grammarResults, styleResults, styleGuideResults, codeSpellResults] = await Promise.all([
        (async () => {
          if (enableGrammar && grammarChecker) {
            try { return await grammarChecker.checkText(text, options); }
            catch (e) { console.warn('[AsyncJob] Grammar failed:', e.message); }
          }
          return { grammar: [] };
        })(),
        (async () => {
          if (enableStyle && styleAnalyzer) {
            try { return await styleAnalyzer.analyzeText(text, options); }
            catch (e) { console.warn('[AsyncJob] Style failed:', e.message); }
          }
          return { style: [], readability: null };
        })(),
        (async () => {
          if (styleGuide && styleGuideManager) {
            try { return styleGuideManager.analyzeWithStyleGuide(text, styleGuide, options); }
            catch (e) { console.warn('[AsyncJob] Style guide failed:', e.message); }
          }
          return [];
        })(),
        (async () => {
          const defaultResult = { codeSpelling: [], codeSpellStatistics: { codeBlocks: 0, languagesDetected: [], issuesFound: 0 } };
          if (enableCodeSpellCheck && cspellCodeChecker) {
            try {
              return await cspellCodeChecker.checkCodeFences(text, {
                enableCodeSpellCheck: true,
                codeSpellSettings: { ...codeSpellSettings, customWords: allCustomWords }
              });
            } catch (e) { console.warn('[AsyncJob] CSpell failed:', e.message); }
          }
          return defaultResult;
        })()
      ]);

      const processingTime = Date.now() - startTime;

      const combinedResults = {
        spelling: spellResults.spelling || [],
        grammar: grammarResults.grammar || [],
        style: [...(styleResults.style || []), ...styleGuideResults],
        codeSpelling: codeSpellResults.codeSpelling || []
      };

      console.log(`[AsyncJob ${jobId}] Complete: ${
        combinedResults.spelling.length + combinedResults.grammar.length +
        combinedResults.style.length + combinedResults.codeSpelling.length
      } issues in ${processingTime}ms`);

      const response = responseBuilder.buildSpellCheckResponse(combinedResults, {
        text,
        processingTime,
        detectedLanguage,
        languageDetectionResult,
        enabledFeatures: {
          enableGrammar, enableStyle, enableLanguageDetection,
          enableContextualSuggestions, enableCodeSpellCheck,
          authToken: !!authToken
        },
        customWordsCount: allCustomWords.length,
        styleGuideApplied: styleGuide,
        readability: styleResults.readability,
        codeSpellStatistics: codeSpellResults.codeSpellStatistics,
        services,
        styleGuideResults
      });

      await asyncJobManager.markCompleted(jobId, response);
    } catch (error) {
      console.error(`[AsyncJob ${jobId}] Failed:`, error);
      await asyncJobManager.markFailed(jobId, error.message);
    }
  });
}

/**
 * Setup async spell check routes
 * @param {ServiceManager} serviceManager
 * @param {ResponseBuilder} responseBuilder
 * @returns {express.Router}
 */
function setupAsyncSpellCheckRoutes(serviceManager, responseBuilder) {
  const router = express.Router();

  /**
   * Submit an async spell-check job
   * POST /check-async
   */
  router.post('/check-async',
    checkRateLimiter,
    validateTextInput({ maxTextSizeBytes: DEFAULT_CONFIG.performance.maxTextSizeBytes }),
    validateSpellCheckRequest,
    asyncHandler(async (req, res) => {
      // Create job in Redis and return immediately
      const jobId = await asyncJobManager.createJob(req.body);

      // Kick off background processing (non-blocking)
      processJobInBackground(jobId, req.body, serviceManager, responseBuilder);

      res.status(202).json({ jobId });
    })
  );

  /**
   * Poll for job results
   * GET /check-status/:jobId
   */
  router.get('/check-status/:jobId',
    asyncHandler(async (req, res) => {
      const { jobId } = req.params;

      // Basic format validation — UUIDs are 36 chars of hex + hyphens
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId)) {
        return res.status(400).json({ error: 'Invalid job ID format' });
      }

      const job = await asyncJobManager.getJob(jobId);

      if (!job) {
        return res.status(404).json({ error: 'Job not found or expired' });
      }

      if (job.status === 'completed') {
        return res.json({ status: 'completed', result: job.result });
      }

      if (job.status === 'failed') {
        return res.status(500).json({ status: 'failed', error: job.error });
      }

      // queued or processing
      res.json({ status: job.status });
    })
  );

  return router;
}

module.exports = setupAsyncSpellCheckRoutes;
