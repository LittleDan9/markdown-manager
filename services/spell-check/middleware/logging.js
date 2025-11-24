/**
 * Request Logging Middleware
 * Provides comprehensive request/response logging for the spell check service
 */

/**
 * Request logging middleware
 * Logs request details and response times
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  // Log incoming request
  console.log(`[${timestamp}] ${req.method} ${req.path} - Request received`);

  // Log request body size for debugging
  if (req.body && req.body.text) {
    console.log(`[${timestamp}] Request text length: ${req.body.text.length} characters`);
  }

  // Capture response finish event
  res.on('finish', () => {
    const duration = Date.now() - start;
    const finishTimestamp = new Date().toISOString();

    console.log(`[${finishTimestamp}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);

    // Log additional details for errors
    if (res.statusCode >= 400) {
      console.log(`[${finishTimestamp}] Error response for ${req.method} ${req.path}`);
    }

    // Log slow requests
    if (duration > 5000) {
      console.warn(`[${finishTimestamp}] Slow request: ${req.method} ${req.path} took ${duration}ms`);
    }
  });

  next();
}

/**
 * Enhanced logging for specific endpoints
 */
function enhancedLogger(options = {}) {
  const {
    logBody = false,
    logHeaders = false,
    logQueryParams = true,
    maxBodyLength = 1000
  } = options;

  return (req, res, next) => {
    const timestamp = new Date().toISOString();

    // Enhanced logging for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${timestamp}] Enhanced Log - ${req.method} ${req.path}`);

      if (logQueryParams && Object.keys(req.query).length > 0) {
        console.log(`[${timestamp}] Query params:`, req.query);
      }

      if (logHeaders && req.headers) {
        console.log(`[${timestamp}] Headers:`, {
          'content-type': req.headers['content-type'],
          'user-agent': req.headers['user-agent'],
          'authorization': req.headers.authorization ? '[REDACTED]' : undefined
        });
      }

      if (logBody && req.body) {
        const bodyStr = JSON.stringify(req.body);
        const truncatedBody = bodyStr.length > maxBodyLength
          ? bodyStr.substring(0, maxBodyLength) + '...[TRUNCATED]'
          : bodyStr;
        console.log(`[${timestamp}] Request body:`, truncatedBody);
      }
    }

    next();
  };
}

/**
 * Performance monitoring middleware
 */
function performanceLogger(req, res, next) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1000000; // Convert to milliseconds

    // Log performance metrics
    const memUsage = process.memoryUsage();
    console.log(`[Performance] ${req.method} ${req.path} - ${durationMs.toFixed(2)}ms, Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);

    // Alert on high memory usage
    if (memUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
      console.warn(`[Performance] High memory usage detected: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
    }
  });

  next();
}

module.exports = {
  requestLogger,
  enhancedLogger,
  performanceLogger
};