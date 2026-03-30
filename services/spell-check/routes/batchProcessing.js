/**
 * Batch Processing Routes
 * Endpoints for processing large documents in chunks
 */

const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateTextInput, validateBatchRequest } = require('../middleware/validation');
const { generalRateLimiter } = require('../middleware/security');
const { DEFAULT_CONFIG } = require('../utils/constants');
const { splitTextIntoChunks, mergeChunkResults } = require('../utils/chunkUtils');

/**
 * Setup batch processing routes
 * @param {ServiceManager} serviceManager - Service manager instance
 * @param {ResponseBuilder} responseBuilder - Response builder instance
 * @returns {express.Router} Batch processing routes
 */
function setupBatchProcessingRoutes(serviceManager, responseBuilder) {
  const router = express.Router();

  /**
   * Batch spell check endpoint
   * POST /check-batch
   */
  router.post('/check-batch',
    generalRateLimiter,
    validateTextInput({
      maxTextSizeBytes: DEFAULT_CONFIG.performance.batchMaxTextSizeBytes
    }),
    validateBatchRequest,
    asyncHandler(async (req, res) => {
      const startTime = Date.now();

      try {
        const {
          text,
          chunkSize = 10000,
          customWords = [],
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
          folderPath = null
        } = req.body;

        console.log(`Processing batch request - text length: ${text.length}, chunk size: ${chunkSize}`);

        // Get services
        const services = serviceManager.getServices();
        const { customDictionaryManager } = services;

        // Get custom words if authenticated
        let allCustomWords = [...customWords];
        if (authToken && customDictionaryManager) {
          try {
            const backendCustomWords = await customDictionaryManager.getCustomWords({
              authToken,
              userId,
              categoryId,
              folderPath,
              includeGlobal: true
            });
            allCustomWords = [...new Set([...allCustomWords, ...backendCustomWords])];
          } catch (error) {
            console.warn('Failed to retrieve custom words for batch processing:', error.message);
          }
        }

        // Split text into chunks
        const chunks = splitTextIntoChunks(text, chunkSize, {
          preserveSentences: true,
          preserveParagraphs: true,
          maxBoundarySearch: 200
        });

        console.log(`Split into ${chunks.length} chunks for batch processing`);

        // Process chunks with limited concurrency
        const maxConcurrency = DEFAULT_CONFIG.performance.maxConcurrentChunks;
        const chunkResults = [];

        for (let i = 0; i < chunks.length; i += maxConcurrency) {
          const batch = chunks.slice(i, i + maxConcurrency);

          const batchPromises = batch.map(async (chunk, batchIndex) => {
            try {
              const chunkRequest = {
                text: chunk.text,
                customWords: allCustomWords,
                chunk_offset: chunk.offset,
                options,
                language,
                enableGrammar,
                enableStyle,
                enableLanguageDetection: false, // Skip for chunks to save time
                enableContextualSuggestions,
                styleGuide,
                authToken: null // Don't re-fetch custom words for each chunk
              };

              return await processTextChunk(chunkRequest, services);
            } catch (error) {
              console.error(`Error processing chunk at offset ${chunk.offset}:`, error);
              return { spelling: [], grammar: [], style: [], codeSpelling: [] };
            }
          });

          const batchChunkResults = await Promise.all(batchPromises);
          chunkResults.push(...batchChunkResults);

          console.log(`Processed ${Math.min(i + maxConcurrency, chunks.length)}/${chunks.length} chunks`);
        }

        // Merge results with position adjustment
        const mergedResults = mergeChunkResults(chunkResults, chunks);

        const processingTime = Date.now() - startTime;

        // Calculate statistics
        const statistics = {
          characters: text.length,
          chunks: chunks.length,
          processingTimeMs: processingTime,
          customWordsUsed: allCustomWords.length,
          issuesFound: {
            spelling: mergedResults.spelling.length,
            grammar: mergedResults.grammar.length,
            style: mergedResults.style.length,
            codeSpelling: mergedResults.codeSpelling.length,
            total: mergedResults.spelling.length +
                   mergedResults.grammar.length +
                   mergedResults.style.length +
                   mergedResults.codeSpelling.length
          }
        };

        console.log(`Batch processing complete: ${statistics.issuesFound.total} total issues in ${processingTime}ms`);

        // Build response
        const response = responseBuilder.buildBatchResponse(mergedResults, {
          processingTime,
          chunkInfo: {
            chunkCount: chunks.length,
            averageChunkSize: Math.round(text.length / chunks.length),
            maxConcurrency: maxConcurrency
          },
          statistics,
          customWordsCount: allCustomWords.length
        });

        res.json(response);

      } catch (error) {
        console.error('Batch processing error:', error);
        const errorResponse = responseBuilder.buildErrorResponse(error, 500, req);
        res.status(500).json(errorResponse);
      }
    })
  );

  return router;
}

/**
 * Process a single text chunk
 * @param {Object} chunkRequest - Chunk processing request
 * @param {Object} services - Service instances
 * @returns {Object} Processing results
 */
async function processTextChunk(chunkRequest, services) {
  const {
    text,
    customWords = [],
    options = {},
    language = null,
    enableGrammar = true,
    enableStyle = true,
    enableContextualSuggestions = true,
    enableCodeSpellCheck = false,
    styleGuide = null
  } = chunkRequest;

  const {
    spellChecker,
    grammarChecker,
    styleAnalyzer,
    contextualAnalyzer,
    styleGuideManager,
    cspellCodeChecker
  } = services;

  // Perform spell checking
  const spellResults = await spellChecker.checkText(text, {
    customWords,
    language,
    autoDetectLanguage: false
  });

  // Enhance with contextual suggestions if enabled (batched, capped)
  const MAX_CONTEXTUAL_ISSUES = 30;
  const CONTEXTUAL_BATCH_SIZE = 10;

  if (enableContextualSuggestions && spellResults.spelling && contextualAnalyzer) {
    const issuesToEnhance = spellResults.spelling.slice(0, MAX_CONTEXTUAL_ISSUES);
    for (let i = 0; i < issuesToEnhance.length; i += CONTEXTUAL_BATCH_SIZE) {
      const batch = issuesToEnhance.slice(i, i + CONTEXTUAL_BATCH_SIZE);
      await Promise.all(batch.map(async (issue) => {
        try {
          const contextualResult = await contextualAnalyzer.getContextualSuggestions(
            issue.word,
            text,
            issue.position.start,
            issue.suggestions || [],
            options
          );

          issue.suggestions = contextualResult.suggestions.map(s => s.word);
          issue.confidence = contextualResult.suggestions[0]?.confidence || issue.confidence;
          issue.enhanced = true;
        } catch (error) {
          // Keep original suggestions on error
        }
      }));
    }
  }

  // Run grammar, style, style guide, and code spell analyses in parallel
  const [grammarResults, styleResults, styleGuideResults, codeSpellResults] = await Promise.all([
    // Grammar checking
    (async () => {
      if (enableGrammar && grammarChecker) {
        try {
          return await grammarChecker.checkText(text, options);
        } catch (error) {
          console.warn('Grammar checking failed for chunk:', error.message);
        }
      }
      return { grammar: [] };
    })(),

    // Style analysis
    (async () => {
      if (enableStyle && styleAnalyzer) {
        try {
          return await styleAnalyzer.analyzeText(text, options);
        } catch (error) {
          console.warn('Style analysis failed for chunk:', error.message);
        }
      }
      return { style: [] };
    })(),

    // Style guide rules
    (async () => {
      if (styleGuide && styleGuideManager) {
        try {
          return styleGuideManager.analyzeWithStyleGuide(text, styleGuide, options);
        } catch (error) {
          console.warn(`Failed to apply style guide ${styleGuide} to chunk:`, error.message);
        }
      }
      return [];
    })(),

    // CSpell code checking
    (async () => {
      if (enableCodeSpellCheck && cspellCodeChecker) {
        try {
          const codeResults = await cspellCodeChecker.checkCodeFences(text, {
            enableCodeSpellCheck: true,
            codeSpellSettings: {
              checkComments: true,
              checkStrings: false,
              checkIdentifiers: true,
              customWords
            }
          });
          return codeResults.codeSpelling || [];
        } catch (error) {
          console.warn('CSpell failed for chunk:', error.message);
        }
      }
      return [];
    })()
  ]);

  return {
    spelling: spellResults.spelling || [],
    grammar: grammarResults.grammar || [],
    style: [...(styleResults.style || []), ...styleGuideResults],
    codeSpelling: codeSpellResults
  };
}

module.exports = setupBatchProcessingRoutes;