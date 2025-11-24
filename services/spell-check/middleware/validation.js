/**
 * Request Validation Middleware
 * Input validation for spell check service endpoints
 */

const { ValidationError } = require('./errorHandler');

/**
 * Validates text input for spell check endpoints
 */
function validateTextInput(options = {}) {
  const {
    maxTextSizeBytes = 50000,
    required = true,
    fieldName = 'text'
  } = options;

  return (req, res, next) => {
    const text = req.body[fieldName];

    if (required && (!text || typeof text !== 'string')) {
      return next(new ValidationError(
        `${fieldName} field is required and must be a string`,
        fieldName
      ));
    }

    if (text && text.length > maxTextSizeBytes) {
      return next(new ValidationError(
        `Maximum ${fieldName} size is ${maxTextSizeBytes} bytes`,
        fieldName
      ));
    }

    // Store validated text length for logging
    if (text) {
      req.validatedTextLength = text.length;
    }

    next();
  };
}

/**
 * Validates spell check request parameters
 */
function validateSpellCheckRequest(req, res, next) {
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
    codeSpellSettings = {}
  } = req.body;

  // Validate custom words array
  if (customWords && !Array.isArray(customWords)) {
    return next(new ValidationError(
      'customWords must be an array',
      'customWords'
    ));
  }

  // Validate chunk offset
  if (typeof chunk_offset !== 'number' || chunk_offset < 0) {
    return next(new ValidationError(
      'chunk_offset must be a non-negative number',
      'chunk_offset'
    ));
  }

  // Validate options object
  if (options && typeof options !== 'object') {
    return next(new ValidationError(
      'options must be an object',
      'options'
    ));
  }

  // Validate language code
  if (language && typeof language !== 'string') {
    return next(new ValidationError(
      'language must be a string',
      'language'
    ));
  }

  // Validate boolean flags
  const booleanFields = [
    'enableGrammar',
    'enableStyle',
    'enableLanguageDetection',
    'enableContextualSuggestions',
    'enableCodeSpellCheck'
  ];

  for (const field of booleanFields) {
    const value = req.body[field];
    if (value !== undefined && typeof value !== 'boolean') {
      return next(new ValidationError(
        `${field} must be a boolean`,
        field
      ));
    }
  }

  // Validate style guide
  if (styleGuide && typeof styleGuide !== 'string') {
    return next(new ValidationError(
      'styleGuide must be a string',
      'styleGuide'
    ));
  }

  // Validate code spell settings
  if (codeSpellSettings && typeof codeSpellSettings !== 'object') {
    return next(new ValidationError(
      'codeSpellSettings must be an object',
      'codeSpellSettings'
    ));
  }

  next();
}

/**
 * Validates batch processing request
 */
function validateBatchRequest(req, res, next) {
  const { chunkSize = 10000 } = req.body;

  if (typeof chunkSize !== 'number' || chunkSize <= 0 || chunkSize > 50000) {
    return next(new ValidationError(
      'chunkSize must be a number between 1 and 50000',
      'chunkSize'
    ));
  }

  next();
}

/**
 * Validates language detection request
 */
function validateLanguageDetectionRequest(req, res, next) {
  const { text, options = {} } = req.body;

  if (!text || typeof text !== 'string') {
    return next(new ValidationError(
      'text field is required and must be a string',
      'text'
    ));
  }

  if (options && typeof options !== 'object') {
    return next(new ValidationError(
      'options must be an object',
      'options'
    ));
  }

  next();
}

/**
 * Validates contextual suggestions request
 */
function validateContextualSuggestionsRequest(req, res, next) {
  const { word, context, position, basicSuggestions = [], options = {} } = req.body;

  if (!word || typeof word !== 'string') {
    return next(new ValidationError(
      'word field is required and must be a string',
      'word'
    ));
  }

  if (!context || typeof context !== 'string') {
    return next(new ValidationError(
      'context field is required and must be a string',
      'context'
    ));
  }

  if (position === undefined || typeof position !== 'number') {
    return next(new ValidationError(
      'position field is required and must be a number',
      'position'
    ));
  }

  if (!Array.isArray(basicSuggestions)) {
    return next(new ValidationError(
      'basicSuggestions must be an array',
      'basicSuggestions'
    ));
  }

  if (typeof options !== 'object') {
    return next(new ValidationError(
      'options must be an object',
      'options'
    ));
  }

  next();
}

module.exports = {
  validateTextInput,
  validateSpellCheckRequest,
  validateBatchRequest,
  validateLanguageDetectionRequest,
  validateContextualSuggestionsRequest
};