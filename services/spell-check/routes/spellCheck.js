/**
 * Main Spell Check Routes
 * Core spell checking endpoint
 */

const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateTextInput, validateSpellCheckRequest } = require('../middleware/validation');
const { checkRateLimiter } = require('../middleware/security');
const { DEFAULT_CONFIG } = require('../utils/constants');

/**
 * Setup main spell check routes
 * @param {ServiceManager} serviceManager - Service manager instance
 * @param {ResponseBuilder} responseBuilder - Response builder instance
 * @returns {express.Router} Spell check routes
 */
function setupSpellCheckRoutes(serviceManager, responseBuilder) {
  const router = express.Router();

  /**
   * Main spell check endpoint
   * POST /check
   */
  router.post('/check',
    checkRateLimiter,
    validateTextInput({
      maxTextSizeBytes: DEFAULT_CONFIG.performance.maxTextSizeBytes
    }),
    validateSpellCheckRequest,
    asyncHandler(async (req, res) => {
      const startTime = Date.now();

      try {
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
        } = req.body;

        console.log(`Processing spell check - text length: ${text.length}, language: ${language || 'auto'}`);

        // Get services
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

        // Check CSpell availability if needed
        if (enableCodeSpellCheck && !cspellCodeChecker) {
          return res.status(503).json(
            responseBuilder.buildErrorResponse(
              new Error('CSpell code checker not initialized but code spell check requested'),
              503,
              req
            )
          );
        }

        // Get custom words from backend if authenticated
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
            console.log(`Retrieved ${backendCustomWords.length} custom words from backend`);
          } catch (error) {
            console.warn('Failed to retrieve custom words from backend:', error.message);
          }
        }

        // Detect language if not specified
        let detectedLanguage = language;
        let languageDetectionResult = null;

        if (enableLanguageDetection && !language && languageDetector) {
          try {
            languageDetectionResult = await languageDetector.detectLanguage(text);
            detectedLanguage = languageDetectionResult.language;
          } catch (error) {
            console.warn('Language detection failed:', error.message);
          }
        }

        // Perform spell checking
        const spellResults = await spellChecker.checkText(text, {
          customWords: allCustomWords,
          language: detectedLanguage,
          autoDetectLanguage: false,
          chunkOffset: chunk_offset
        });

        // Enhance suggestions with contextual analysis
        if (enableContextualSuggestions && spellResults.spelling && contextualAnalyzer) {
          console.log(`Enhancing ${spellResults.spelling.length} spelling suggestions with context analysis...`);

          for (const issue of spellResults.spelling) {
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
              issue.contextAnalysis = contextualResult.contextAnalysis;
              issue.enhanced = true;
            } catch (error) {
              console.warn(`Failed to enhance suggestions for word "${issue.word}":`, error.message);
            }
          }
        }

        // Perform grammar checking
        let grammarResults = { grammar: [] };
        if (enableGrammar && grammarChecker) {
          try {
            grammarResults = await grammarChecker.checkText(text, options);
          } catch (error) {
            console.warn('Grammar checking failed:', error.message);
          }
        }

        // Perform style analysis
        let styleResults = { style: [], readability: null };
        if (enableStyle && styleAnalyzer) {
          try {
            styleResults = await styleAnalyzer.analyzeText(text, options);
          } catch (error) {
            console.warn('Style analysis failed:', error.message);
          }
        }

        // Apply style guide rules if specified
        let styleGuideResults = [];
        if (styleGuide && styleGuideManager) {
          try {
            styleGuideResults = styleGuideManager.analyzeWithStyleGuide(text, styleGuide, options);
            console.log(`Applied ${styleGuide} style guide - found ${styleGuideResults.length} style guide issues`);
          } catch (error) {
            console.warn(`Failed to apply style guide ${styleGuide}:`, error.message);
          }
        }

        // CSpell: Check code fences if enabled
        let codeSpellResults = {
          codeSpelling: [],
          codeSpellStatistics: {
            codeBlocks: 0,
            languagesDetected: [],
            issuesFound: 0
          }
        };

        if (enableCodeSpellCheck && cspellCodeChecker) {
          try {
            console.log('Performing CSpell code fence analysis...');
            codeSpellResults = await cspellCodeChecker.checkCodeFences(text, {
              enableCodeSpellCheck: true,
              codeSpellSettings: {
                ...codeSpellSettings,
                customWords: allCustomWords
              }
            });
            console.log(`CSpell found ${codeSpellResults.codeSpelling.length} issues in ${codeSpellResults.codeSpellStatistics.codeBlocks} code blocks`);
          } catch (error) {
            console.warn('CSpell code fence checking failed:', error.message);
          }
        }

        const processingTime = Date.now() - startTime;

        // Combine all results
        const combinedResults = {
          spelling: spellResults.spelling || [],
          grammar: grammarResults.grammar || [],
          style: [...(styleResults.style || []), ...styleGuideResults],
          codeSpelling: codeSpellResults.codeSpelling || []
        };

        console.log(`Spell check complete: ${
          combinedResults.spelling.length +
          combinedResults.grammar.length +
          combinedResults.style.length +
          combinedResults.codeSpelling.length
        } total issues in ${processingTime}ms`);

        // Build response
        const response = responseBuilder.buildSpellCheckResponse(combinedResults, {
          text,
          processingTime,
          detectedLanguage,
          languageDetectionResult,
          enabledFeatures: {
            enableGrammar,
            enableStyle,
            enableLanguageDetection,
            enableContextualSuggestions,
            enableCodeSpellCheck,
            authToken: !!authToken
          },
          customWordsCount: allCustomWords.length,
          styleGuideApplied: styleGuide,
          readability: styleResults.readability,
          codeSpellStatistics: codeSpellResults.codeSpellStatistics,
          services,
          styleGuideResults
        });

        res.json(response);

      } catch (error) {
        console.error('Spell check error:', error);
        const errorResponse = responseBuilder.buildErrorResponse(error, 500, req);
        res.status(500).json(errorResponse);
      }
    })
  );

  return router;
}

module.exports = setupSpellCheckRoutes;