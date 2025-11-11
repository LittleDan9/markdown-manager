/**
 * Service Constants and Configuration
 * Centralized configuration and constants for the spell check service
 */

// Service metadata
const SERVICE_INFO = {
  name: 'spell-check',
  version: '3.0.0',
  phase: 3,
  description: 'Advanced spell checking with custom dictionaries, contextual suggestions, and style guides'
};

// Default configuration values
const DEFAULT_CONFIG = {
  server: {
    port: process.env.SPELL_CHECK_PORT || 8003,
    host: '0.0.0.0',
    timeout: 30000, // 30 seconds
    keepAliveTimeout: 65000,
    headersTimeout: 66000
  },

  performance: {
    maxTextSizeBytes: 50000, // 50KB default
    batchMaxTextSizeBytes: 100000, // 100KB for batch
    targetResponseTimeMs: 200,
    maxConcurrentChunks: 3,
    defaultChunkSize: 10000,
    minChunkSize: 1000,
    maxChunkSize: 50000
  },

  features: {
    spellChecking: true,
    grammarChecking: true,
    styleAnalysis: true,
    languageDetection: true,
    multiLanguage: true,
    readabilityAnalysis: true,
    contextualSuggestions: true,
    customDictionaries: true,
    styleGuides: true,
    batchProcessing: true,
    codeSpellCheck: true
  },

  rateLimit: {
    enabled: process.env.NODE_ENV === 'production',
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    checkEndpointWindowMs: 5 * 60 * 1000, // 5 minutes
    checkEndpointMaxRequests: 50
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enablePerformanceLogging: true,
    enableEnhancedLogging: process.env.NODE_ENV === 'development',
    maxLogBodyLength: 1000
  },

  security: {
    enableCors: true,
    enableSecurityHeaders: true,
    enableRateLimit: process.env.NODE_ENV === 'production',
    maxRequestSizeBytes: 10 * 1024 * 1024 // 10MB
  }
};

// Supported languages
const SUPPORTED_LANGUAGES = [
  'en-US', 'en-GB', 'en-CA', 'en-AU',
  'es-ES', 'es-MX', 'es-AR',
  'fr-FR', 'fr-CA',
  'de-DE', 'de-AT', 'de-CH',
  'it-IT',
  'pt-PT', 'pt-BR',
  'nl-NL',
  'sv-SE',
  'da-DK',
  'no-NO',
  'fi-FI',
  'pl-PL',
  'cs-CZ',
  'sk-SK',
  'hu-HU',
  'ro-RO',
  'bg-BG',
  'hr-HR',
  'sl-SI',
  'et-EE',
  'lv-LV',
  'lt-LT',
  'ru-RU',
  'uk-UA',
  'be-BY',
  'mk-MK',
  'sr-RS',
  'bs-BA',
  'sq-AL',
  'el-GR',
  'tr-TR',
  'ar-SA',
  'he-IL',
  'fa-IR',
  'hi-IN',
  'bn-BD',
  'ur-PK',
  'th-TH',
  'vi-VN',
  'ko-KR',
  'ja-JP',
  'zh-CN', 'zh-TW',
  'id-ID',
  'ms-MY',
  'tl-PH'
];

// Available style guides
const STYLE_GUIDES = [
  {
    id: 'ap',
    name: 'Associated Press',
    description: 'AP Stylebook guidelines for journalism and news writing'
  },
  {
    id: 'chicago',
    name: 'Chicago Manual of Style',
    description: 'Comprehensive style guide for publishing and academic writing'
  },
  {
    id: 'mla',
    name: 'MLA Style',
    description: 'Modern Language Association style for humanities papers'
  },
  {
    id: 'apa',
    name: 'APA Style',
    description: 'American Psychological Association style for scientific writing'
  },
  {
    id: 'academic',
    name: 'Academic Writing',
    description: 'General academic writing conventions and best practices'
  },
  {
    id: 'technical',
    name: 'Technical Writing',
    description: 'Clear, concise style for technical documentation'
  },
  {
    id: 'business',
    name: 'Business Writing',
    description: 'Professional communication standards'
  },
  {
    id: 'creative',
    name: 'Creative Writing',
    description: 'Guidelines for fiction and creative non-fiction'
  }
];

// Code languages supported by CSpell
const CSPELL_SUPPORTED_LANGUAGES = [
  'javascript', 'typescript', 'jsx', 'tsx',
  'python', 'java', 'csharp', 'cpp', 'c',
  'php', 'ruby', 'go', 'rust', 'swift',
  'kotlin', 'scala', 'dart', 'elixir',
  'html', 'css', 'scss', 'sass', 'less',
  'xml', 'json', 'yaml', 'toml', 'ini',
  'sql', 'mongodb', 'graphql',
  'shell', 'bash', 'powershell', 'batch',
  'dockerfile', 'makefile',
  'markdown', 'latex', 'restructuredtext',
  'plaintext', 'text'
];

// HTTP status codes with descriptions
const HTTP_STATUS = {
  OK: { code: 200, message: 'OK' },
  BAD_REQUEST: { code: 400, message: 'Bad Request' },
  UNAUTHORIZED: { code: 401, message: 'Unauthorized' },
  FORBIDDEN: { code: 403, message: 'Forbidden' },
  NOT_FOUND: { code: 404, message: 'Not Found' },
  METHOD_NOT_ALLOWED: { code: 405, message: 'Method Not Allowed' },
  REQUEST_TIMEOUT: { code: 408, message: 'Request Timeout' },
  PAYLOAD_TOO_LARGE: { code: 413, message: 'Payload Too Large' },
  UNSUPPORTED_MEDIA_TYPE: { code: 415, message: 'Unsupported Media Type' },
  TOO_MANY_REQUESTS: { code: 429, message: 'Too Many Requests' },
  INTERNAL_SERVER_ERROR: { code: 500, message: 'Internal Server Error' },
  NOT_IMPLEMENTED: { code: 501, message: 'Not Implemented' },
  BAD_GATEWAY: { code: 502, message: 'Bad Gateway' },
  SERVICE_UNAVAILABLE: { code: 503, message: 'Service Unavailable' },
  GATEWAY_TIMEOUT: { code: 504, message: 'Gateway Timeout' }
};

// Error types and their default HTTP status codes
const ERROR_TYPES = {
  ValidationError: HTTP_STATUS.BAD_REQUEST.code,
  ServiceUnavailableError: HTTP_STATUS.SERVICE_UNAVAILABLE.code,
  TimeoutError: HTTP_STATUS.REQUEST_TIMEOUT.code,
  AuthenticationError: HTTP_STATUS.UNAUTHORIZED.code,
  AuthorizationError: HTTP_STATUS.FORBIDDEN.code,
  NotFoundError: HTTP_STATUS.NOT_FOUND.code,
  RateLimitError: HTTP_STATUS.TOO_MANY_REQUESTS.code,
  PayloadTooLargeError: HTTP_STATUS.PAYLOAD_TOO_LARGE.code
};

// API endpoints
const ENDPOINTS = {
  HEALTH: '/health',
  HEALTH_DETAILED: '/health/detailed',
  INFO: '/info',
  CHECK: '/check',
  CHECK_BATCH: '/check-batch',
  DETECT_LANGUAGE: '/detect-language',
  LANGUAGES: '/languages',
  STYLE_GUIDES: '/style-guides',
  STYLE_GUIDE_RULES: '/style-guides/:guide/rules',
  STYLE_GUIDE_RECOMMEND: '/style-guides/recommend',
  CONTEXTUAL_SUGGESTIONS: '/contextual-suggestions'
};

// Regular expressions for text analysis
const REGEX_PATTERNS = {
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  URL: /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g,
  PHONE: /\b(?:\+1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
  CREDIT_CARD: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
  SSN: /\b\d{3}-\d{2}-\d{4}\b/g,
  MARKDOWN_CODE_BLOCK: /```(\w+)?\n([\s\S]*?)```/g,
  MARKDOWN_INLINE_CODE: /`([^`]+)`/g,
  MARKDOWN_LINK: /\[([^\]]+)\]\([^)]+\)/g,
  SENTENCE_BOUNDARY: /[.!?]+[\s\n]/g,
  WORD_BOUNDARY: /\b\w+\b/g,
  PARAGRAPH_BOUNDARY: /\n\s*\n/g
};

// Performance thresholds
const PERFORMANCE_THRESHOLDS = {
  SLOW_REQUEST_MS: 5000,
  HIGH_MEMORY_MB: 500,
  MAX_PROCESSING_TIME_MS: 30000,
  WARNING_TEXT_SIZE_BYTES: 25000,
  CRITICAL_TEXT_SIZE_BYTES: 45000
};

// Cache settings
const CACHE_SETTINGS = {
  DEFAULT_TTL_MS: 15 * 60 * 1000, // 15 minutes
  LANGUAGE_DETECTION_TTL_MS: 60 * 60 * 1000, // 1 hour
  DICTIONARY_TTL_MS: 24 * 60 * 60 * 1000, // 24 hours
  MAX_CACHE_SIZE: 1000,
  CLEANUP_INTERVAL_MS: 10 * 60 * 1000 // 10 minutes
};

// Environment-specific overrides
const getEnvironmentConfig = () => {
  const env = process.env.NODE_ENV || 'development';

  const envConfigs = {
    development: {
      logging: {
        level: 'debug',
        enableEnhancedLogging: true
      },
      security: {
        enableRateLimit: false
      },
      performance: {
        maxTextSizeBytes: 100000 // 100KB for development
      }
    },

    test: {
      logging: {
        level: 'warn'
      },
      security: {
        enableRateLimit: false
      },
      performance: {
        maxTextSizeBytes: 10000 // 10KB for tests
      }
    },

    production: {
      logging: {
        level: 'info',
        enableEnhancedLogging: false
      },
      security: {
        enableRateLimit: true
      },
      performance: {
        maxTextSizeBytes: 50000 // 50KB for production
      }
    }
  };

  return envConfigs[env] || envConfigs.development;
};

module.exports = {
  SERVICE_INFO,
  DEFAULT_CONFIG,
  SUPPORTED_LANGUAGES,
  STYLE_GUIDES,
  CSPELL_SUPPORTED_LANGUAGES,
  HTTP_STATUS,
  ERROR_TYPES,
  ENDPOINTS,
  REGEX_PATTERNS,
  PERFORMANCE_THRESHOLDS,
  CACHE_SETTINGS,
  getEnvironmentConfig
};