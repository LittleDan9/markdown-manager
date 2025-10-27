/**
 * Security Middleware
 * CORS, rate limiting, and security headers for the spell check service
 */

const cors = require('cors');

/**
 * CORS configuration for the spell check service
 */
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);

    // In production, configure specific allowed origins
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000', 'http://localhost:8080', 'http://localhost:5173'];

    if (process.env.NODE_ENV === 'development') {
      return callback(null, true); // Allow all origins in development
    }

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400 // 24 hours
};

/**
 * Simple in-memory rate limiter
 */
class SimpleRateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes
    this.maxRequests = options.maxRequests || 100;
    this.requests = new Map();
    this.enabled = options.enabled !== false;
  }

  middleware() {
    if (!this.enabled) {
      return (req, res, next) => next();
    }

    return (req, res, next) => {
      const clientId = this.getClientId(req);
      const now = Date.now();

      // Clean up old entries
      this.cleanup(now);

      // Get or create client record
      if (!this.requests.has(clientId)) {
        this.requests.set(clientId, []);
      }

      const clientRequests = this.requests.get(clientId);

      // Add current request
      clientRequests.push(now);

      // Check if limit exceeded
      const recentRequests = clientRequests.filter(
        timestamp => now - timestamp < this.windowMs
      );

      if (recentRequests.length > this.maxRequests) {
        return res.status(429).json({
          error: 'Too many requests',
          message: `Rate limit exceeded. Max ${this.maxRequests} requests per ${this.windowMs / 1000} seconds`,
          retryAfter: Math.ceil((recentRequests[0] + this.windowMs - now) / 1000)
        });
      }

      // Update the requests array with only recent requests
      this.requests.set(clientId, recentRequests);

      next();
    };
  }

  getClientId(req) {
    // Use IP address as client identifier
    return req.ip || req.connection.remoteAddress || 'unknown';
  }

  cleanup(now) {
    // Remove expired entries to prevent memory leaks
    for (const [clientId, requests] of this.requests.entries()) {
      const recentRequests = requests.filter(
        timestamp => now - timestamp < this.windowMs
      );

      if (recentRequests.length === 0) {
        this.requests.delete(clientId);
      } else {
        this.requests.set(clientId, recentRequests);
      }
    }
  }
}

/**
 * Security headers middleware
 */
function securityHeaders(req, res, next) {
  // Basic security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Remove server information
  res.removeHeader('X-Powered-By');

  next();
}

/**
 * Request size limiter
 */
function requestSizeLimiter(maxSize = '10mb') {
  return (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length']);

    if (contentLength) {
      const maxBytes = typeof maxSize === 'string'
        ? parseSize(maxSize)
        : maxSize;

      if (contentLength > maxBytes) {
        return res.status(413).json({
          error: 'Request too large',
          message: `Request size ${contentLength} bytes exceeds maximum ${maxBytes} bytes`
        });
      }
    }

    next();
  };
}

/**
 * Parse size string to bytes
 */
function parseSize(sizeStr) {
  const units = {
    'b': 1,
    'kb': 1024,
    'mb': 1024 * 1024,
    'gb': 1024 * 1024 * 1024
  };

  const match = sizeStr.toLowerCase().match(/^(\d+(?:\.\d+)?)(b|kb|mb|gb)?$/);
  if (!match) return 1024 * 1024; // Default 1MB

  const size = parseFloat(match[1]);
  const unit = match[2] || 'b';

  return Math.floor(size * units[unit]);
}

// Create rate limiter instances
const generalRateLimiter = new SimpleRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  enabled: process.env.NODE_ENV === 'production'
});

const checkRateLimiter = new SimpleRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 50,
  enabled: process.env.NODE_ENV === 'production'
});

module.exports = {
  corsOptions,
  corsMiddleware: cors(corsOptions),
  securityHeaders,
  requestSizeLimiter,
  generalRateLimiter: generalRateLimiter.middleware(),
  checkRateLimiter: checkRateLimiter.middleware(),
  SimpleRateLimiter
};