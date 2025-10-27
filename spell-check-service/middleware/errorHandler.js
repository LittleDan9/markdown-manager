/**
 * Error Handling Middleware
 * Centralized error handling for the spell check service
 */

/**
 * Main error handling middleware
 * Catches and formats all application errors
 */
function errorHandler(err, req, res, next) {
  console.error('[Spell Check Service] Error:', err);

  // Default error response
  let statusCode = 500;
  let errorResponse = {
    error: 'Internal server error',
    message: err.message,
    service: 'spell-check',
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  };

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorResponse.error = 'Validation error';
  } else if (err.name === 'ServiceUnavailableError') {
    statusCode = 503;
    errorResponse.error = 'Service unavailable';
  } else if (err.name === 'TimeoutError') {
    statusCode = 408;
    errorResponse.error = 'Request timeout';
  } else if (err.code === 'ECONNREFUSED') {
    statusCode = 503;
    errorResponse.error = 'External service unavailable';
    errorResponse.message = 'Unable to connect to required service';
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }

  // Add request ID if available
  if (req.id) {
    errorResponse.requestId = req.id;
  }

  res.status(statusCode).json(errorResponse);
}

/**
 * Async error wrapper
 * Wraps async route handlers to catch Promise rejections
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 handler for unknown routes
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`,
    service: 'spell-check',
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      'GET /health',
      'GET /health/detailed',
      'GET /info',
      'POST /check',
      'POST /check-batch',
      'POST /detect-language',
      'GET /languages',
      'GET /style-guides',
      'POST /contextual-suggestions'
    ]
  });
}

/**
 * Creates custom error classes
 */
class ServiceUnavailableError extends Error {
  constructor(message, service) {
    super(message);
    this.name = 'ServiceUnavailableError';
    this.service = service;
  }
}

class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

class TimeoutError extends Error {
  constructor(message, timeout) {
    super(message);
    this.name = 'TimeoutError';
    this.timeout = timeout;
  }
}

module.exports = {
  errorHandler,
  asyncHandler,
  notFoundHandler,
  ServiceUnavailableError,
  ValidationError,
  TimeoutError
};