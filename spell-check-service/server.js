/**
 * Backend Spell Check Service - Phase 2
 * Created: October 22, 2025 by AI Agent
 * Purpose: Enhanced spell checking with grammar, style, and multi-language support
 * Dependencies: express, nspell, retext, write-good, franc, multiple dictionaries
 * Integration: HTTP service for markdown-manager backend
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// Import configuration
const config = require('./config/default-settings.json');

// Import Phase 2 enhanced functionality
const EnhancedSpellChecker = require('./lib/EnhancedSpellChecker');
const GrammarChecker = require('./lib/GrammarChecker');
const StyleAnalyzer = require('./lib/StyleAnalyzer');
const LanguageDetector = require('./lib/LanguageDetector');

const app = express();
const PORT = process.env.SPELL_CHECK_PORT || 8003;

// Global service instances
let spellChecker = null;
let grammarChecker = null;
let styleAnalyzer = null;
let languageDetector = null;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Support large documents

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Request received`);
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Spell Check Service] Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    service: 'spell-check'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    service: 'spell-check',
    version: config.version,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    components: {
      spellChecker: spellChecker ? {
        loaded: true,
        statistics: spellChecker.getStatistics()
      } : { loaded: false },
      grammarChecker: grammarChecker ? {
        loaded: true,
        rules: grammarChecker.getRuleConfiguration()
      } : { loaded: false },
      styleAnalyzer: styleAnalyzer ? {
        loaded: true,
        settings: styleAnalyzer.getSettings()
      } : { loaded: false },
      languageDetector: languageDetector ? {
        loaded: true,
        stats: languageDetector.getCacheStats()
      } : { loaded: false }
    }
  };
  
  res.json(health);
});

// Main spell check endpoint - Phase 2 Enhanced
app.post('/check', async (req, res) => {
  try {
    const startTime = Date.now();
    const { 
      text, 
      customWords = [], 
      chunk_offset = 0, 
      options = {},
      language = null,
      enableGrammar = true,
      enableStyle = true,
      enableLanguageDetection = true
    } = req.body;

    // Validate input
    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Text field is required and must be a string'
      });
    }

    if (text.length > config.performance.maxTextSizeBytes) {
      return res.status(400).json({
        error: 'Text too large',
        message: `Maximum text size is ${config.performance.maxTextSizeBytes} bytes`
      });
    }

    console.log(`Processing enhanced check - text length: ${text.length}, language: ${language || 'auto'}`);

    // Ensure services are initialized
    if (!spellChecker || !grammarChecker || !styleAnalyzer || !languageDetector) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'One or more analysis services not initialized'
      });
    }

    // Detect language if not specified
    let detectedLanguage = language;
    let languageDetectionResult = null;
    
    if (enableLanguageDetection && !language) {
      languageDetectionResult = await languageDetector.detectLanguage(text);
      detectedLanguage = languageDetectionResult.language;
    }

    // Perform spell checking with detected/specified language
    const spellResults = await spellChecker.checkText(text, {
      customWords,
      language: detectedLanguage,
      autoDetectLanguage: false,
      chunkOffset: chunk_offset
    });

    // Perform grammar checking
    let grammarResults = { grammar: [] };
    if (enableGrammar) {
      try {
        grammarResults = await grammarChecker.checkText(text, options);
      } catch (error) {
        console.warn('Grammar checking failed:', error.message);
      }
    }

    // Perform style analysis
    let styleResults = { style: [], readability: null };
    if (enableStyle) {
      try {
        styleResults = await styleAnalyzer.analyzeText(text, options);
      } catch (error) {
        console.warn('Style analysis failed:', error.message);
      }
    }

    const processingTime = Date.now() - startTime;

    // Combine all results
    const combinedResults = {
      spelling: spellResults.spelling || [],
      grammar: grammarResults.grammar || [],
      style: styleResults.style || []
    };

    // Add statistics
    const statistics = {
      characters: text.length,
      words: spellChecker.countWords(text),
      processingTimeMs: processingTime,
      issuesFound: {
        spelling: combinedResults.spelling.length,
        grammar: combinedResults.grammar.length,
        style: combinedResults.style.length,
        total: combinedResults.spelling.length + combinedResults.grammar.length + combinedResults.style.length
      }
    };

    console.log(`Enhanced analysis complete: ${statistics.issuesFound.total} total issues in ${processingTime}ms`);

    // Phase 2 Enhanced Response Format
    const response = {
      results: combinedResults,
      language: detectedLanguage,
      languageDetection: languageDetectionResult,
      readability: styleResults.readability,
      processingTime,
      statistics,
      service: 'spell-check',
      version: config.version,
      phase: 2,
      enabledFeatures: {
        spellChecking: true,
        grammarChecking: enableGrammar,
        styleAnalysis: enableStyle,
        languageDetection: enableLanguageDetection
      },
      availableLanguages: spellChecker.dictionaryManager.getAvailableLanguages()
    };

    res.json(response);

  } catch (error) {
    console.error('Enhanced spell check error:', error);
    res.status(500).json({
      error: 'Analysis failed',
      message: error.message,
      service: 'spell-check',
      phase: 2
    });
  }
});

// Get service information - Phase 2 Enhanced
app.get('/info', (req, res) => {
  res.json({
    service: 'spell-check',
    version: config.version,
    phase: 2,
    features: {
      spellChecking: true,
      grammarChecking: true,
      styleAnalysis: true,
      languageDetection: true,
      multiLanguage: true,
      readabilityAnalysis: true
    },
    supportedLanguages: spellChecker ? 
      spellChecker.dictionaryManager.getAvailableLanguages() : 
      ['en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE'],
    maxTextSize: config.performance.maxTextSizeBytes,
    performance: {
      targetResponseTime: '200ms for 5KB text',
      caching: true,
      memoryOptimized: true
    }
  });
});

// Language detection endpoint
app.post('/detect-language', async (req, res) => {
  try {
    const { text, options = {} } = req.body;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Text field is required and must be a string'
      });
    }

    if (!languageDetector) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Language detector not initialized'
      });
    }

    const result = await languageDetector.detectLanguage(text, options);
    res.json(result);

  } catch (error) {
    console.error('Language detection error:', error);
    res.status(500).json({
      error: 'Language detection failed',
      message: error.message
    });
  }
});

// Available languages endpoint
app.get('/languages', (req, res) => {
  if (!spellChecker) {
    return res.status(503).json({
      error: 'Service unavailable',
      message: 'Spell checker not initialized'
    });
  }

  res.json({
    languages: spellChecker.dictionaryManager.getAvailableLanguages(),
    supported: spellChecker.dictionaryManager.supportedLanguages.size,
    memoryUsage: spellChecker.dictionaryManager.getMemoryUsage()
  });
});

// Detailed health check endpoint
app.get('/health/detailed', (req, res) => {
  const detailed = {
    status: 'healthy',
    service: 'spell-check',
    version: config.version,
    phase: 2,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    system: {
      memory: process.memoryUsage(),
      platform: process.platform,
      nodeVersion: process.version
    },
    components: {
      spellChecker: spellChecker ? {
        loaded: true,
        statistics: spellChecker.getStatistics(),
        memoryUsage: spellChecker.dictionaryManager.getMemoryUsage()
      } : { loaded: false },
      grammarChecker: grammarChecker ? {
        loaded: true,
        rules: grammarChecker.getRuleConfiguration()
      } : { loaded: false },
      styleAnalyzer: styleAnalyzer ? {
        loaded: true,
        settings: styleAnalyzer.getSettings()
      } : { loaded: false },
      languageDetector: languageDetector ? {
        loaded: true,
        supportedLanguages: languageDetector.getSupportedLanguages(),
        cacheStats: languageDetector.getCacheStats()
      } : { loaded: false }
    },
    performance: {
      maxTextSize: config.performance.maxTextSizeBytes,
      targetResponseTime: '200ms for 5KB text'
    }
  };
  
  res.json(detailed);
});

// Initialize enhanced services and start server - Phase 2
async function initializeService() {
  try {
    console.log('[Spell Check Service] Initializing Phase 2 enhanced services...');
    
    // Initialize all components in parallel for faster startup
    const initPromises = [];

    // Initialize enhanced spell checker (includes dictionary manager)
    console.log('[Spell Check Service] Loading enhanced spell checker...');
    spellChecker = new EnhancedSpellChecker();
    initPromises.push(spellChecker.init());

    // Initialize grammar checker
    console.log('[Spell Check Service] Loading grammar checker...');
    grammarChecker = new GrammarChecker();
    initPromises.push(grammarChecker.init());

    // Initialize style analyzer
    console.log('[Spell Check Service] Loading style analyzer...');
    styleAnalyzer = new StyleAnalyzer();
    initPromises.push(styleAnalyzer.init());

    // Initialize language detector
    console.log('[Spell Check Service] Loading language detector...');
    languageDetector = new LanguageDetector();
    initPromises.push(languageDetector.init());

    // Wait for all components to initialize
    await Promise.all(initPromises);
    
    console.log('[Spell Check Service] All Phase 2 components initialized successfully');
    
    // Start server
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Spell Check Service] Phase 2 server running on port ${PORT}`);
      console.log(`[Spell Check Service] Health check: http://localhost:${PORT}/health`);
      console.log(`[Spell Check Service] Enhanced API: http://localhost:${PORT}/check`);
      console.log(`[Spell Check Service] Language detection: http://localhost:${PORT}/detect-language`);
      console.log(`[Spell Check Service] Available languages: http://localhost:${PORT}/languages`);
      console.log(`[Spell Check Service] Phase 2 - Enhanced analysis ready`);
      console.log(`[Spell Check Service] Features: Spell + Grammar + Style + Multi-language + Auto-detection`);
    });
    
  } catch (error) {
    console.error('[Spell Check Service] Failed to initialize Phase 2 services:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[Spell Check Service] Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[Spell Check Service] Shutting down gracefully...');
  process.exit(0);
});

// Start the service
initializeService();