/**
 * Backend Spell Check Service - Phase 1
 * Created: October 22, 2025 by AI Agent
 * Purpose: Basic spell checking with nspell
 * Dependencies: express, nspell, dictionary-en-us
 * Integration: HTTP service for markdown-manager backend
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// Import configuration
const config = require('./config/default-settings.json');

// Import spell checking functionality
const BasicSpellChecker = require('./lib/BasicSpellChecker');

const app = express();
const PORT = process.env.SPELL_CHECK_PORT || 8003;

// Global spell checker instance
let spellChecker = null;

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
    dictionary: spellChecker ? {
      loaded: true,
      language: 'en-US',
      customWords: spellChecker.getCustomWordCount()
    } : {
      loaded: false
    }
  };
  
  res.json(health);
});

// Main spell check endpoint
app.post('/check', async (req, res) => {
  try {
    const startTime = Date.now();
    const { text, customWords = [], chunk_offset = 0, options = {} } = req.body;

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

    console.log(`Processing spell check - text length: ${text.length}, custom words: ${customWords.length}`);

    // Ensure spell checker is initialized
    if (!spellChecker) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Spell checker not initialized'
      });
    }

    // Perform spell checking
    const results = await spellChecker.checkText(text, customWords, chunk_offset);
    const processingTime = Date.now() - startTime;

    // Add statistics
    const statistics = {
      characters: text.length,
      words: spellChecker.countWords(text),
      processingTimeMs: processingTime,
      issuesFound: results.spelling.length
    };

    console.log(`Found ${results.spelling.length} issues in ${processingTime}ms`);

    res.json({
      results,
      language: 'en-US',
      processingTime,
      statistics,
      service: 'spell-check',
      version: config.version
    });

  } catch (error) {
    console.error('Spell check error:', error);
    res.status(500).json({
      error: 'Spell check failed',
      message: error.message,
      service: 'spell-check'
    });
  }
});

// Get service information
app.get('/info', (req, res) => {
  res.json({
    service: 'spell-check',
    version: config.version,
    features: {
      spellChecking: true,
      grammarChecking: false, // Phase 2
      styleAnalysis: false,   // Phase 2
      multiLanguage: false    // Phase 2
    },
    supportedLanguages: ['en-US'],
    maxTextSize: config.performance.maxTextSizeBytes,
    phase: 1
  });
});

// Initialize spell checker and start server
async function initializeService() {
  try {
    console.log('[Spell Check Service] Initializing...');
    
    // Initialize spell checker
    spellChecker = new BasicSpellChecker();
    await spellChecker.init();
    
    console.log('[Spell Check Service] Spell checker initialized successfully');
    
    // Start server
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Spell Check Service] Server running on port ${PORT}`);
      console.log(`[Spell Check Service] Health check: http://localhost:${PORT}/health`);
      console.log(`[Spell Check Service] API endpoint: http://localhost:${PORT}/check`);
      console.log(`[Spell Check Service] Phase 1 - Basic spell checking ready`);
    });
    
  } catch (error) {
    console.error('[Spell Check Service] Failed to initialize:', error);
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