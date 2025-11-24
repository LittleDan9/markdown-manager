/**
 * Health Check Routes
 * Health monitoring endpoints for the spell check service
 */

const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Setup health check routes
 * @param {ServiceManager} serviceManager - Service manager instance
 * @param {ResponseBuilder} responseBuilder - Response builder instance
 * @returns {express.Router} Health routes
 */
function setupHealthRoutes(serviceManager, responseBuilder) {
  const router = express.Router();

  /**
   * Basic health check endpoint
   * GET /health
   */
  router.get('/health', asyncHandler(async (req, res) => {
    try {
      const healthInfo = serviceManager.getHealthInfo();
      const response = responseBuilder.buildHealthResponse(healthInfo, false);

      // Return 503 if services are not ready
      if (!serviceManager.isReady()) {
        return res.status(503).json({
          ...response,
          status: 'initializing',
          message: 'Services are still initializing'
        });
      }

      res.json(response);

    } catch (error) {
      const errorResponse = responseBuilder.buildErrorResponse(error, 503, req);
      res.status(503).json({
        ...errorResponse,
        status: 'unhealthy',
        message: 'Health check failed'
      });
    }
  }));

  /**
   * Detailed health check endpoint
   * GET /health/detailed
   */
  router.get('/health/detailed', asyncHandler(async (req, res) => {
    try {
      const healthInfo = serviceManager.getHealthInfo();
      const response = responseBuilder.buildHealthResponse(healthInfo, true);

      // Add additional system information
      response.performance = {
        uptime: process.uptime(),
        loadAverage: process.platform !== 'win32' ? require('os').loadavg() : null,
        freeMem: require('os').freemem(),
        totalMem: require('os').totalmem(),
        cpuCount: require('os').cpus().length
      };

      // Add service configuration
      response.configuration = {
        maxTextSizeBytes: serviceManager.config?.performance?.maxTextSizeBytes || 50000,
        batchMaxTextSizeBytes: serviceManager.config?.performance?.batchMaxTextSizeBytes || 100000,
        enabledFeatures: serviceManager.config?.features || {},
        rateLimitEnabled: serviceManager.config?.rateLimit?.enabled || false
      };

      // Add endpoint availability
      response.endpoints = {
        available: [
          'GET /health',
          'GET /health/detailed',
          'GET /info',
          'POST /check',
          'POST /check-batch',
          'POST /detect-language',
          'GET /languages',
          'GET /style-guides',
          'GET /style-guides/:guide/rules',
          'POST /style-guides/recommend',
          'POST /contextual-suggestions'
        ],
        experimental: [],
        deprecated: []
      };

      res.json(response);

    } catch (error) {
      const errorResponse = responseBuilder.buildErrorResponse(error, 503, req);
      res.status(503).json({
        ...errorResponse,
        status: 'unhealthy',
        message: 'Detailed health check failed'
      });
    }
  }));

  /**
   * Service readiness check
   * GET /health/ready
   */
  router.get('/health/ready', asyncHandler(async (req, res) => {
    try {
      const isReady = serviceManager.isReady();

      if (isReady) {
        res.json({
          status: 'ready',
          message: 'Service is ready to accept requests',
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(503).json({
          status: 'not-ready',
          message: 'Service is not ready to accept requests',
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      res.status(503).json({
        status: 'error',
        message: 'Readiness check failed',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }));

  /**
   * Service liveness check (for Kubernetes)
   * GET /health/live
   */
  router.get('/health/live', (req, res) => {
    // Simple liveness check - if we can respond, we're alive
    res.json({
      status: 'alive',
      message: 'Service is alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  /**
   * Memory usage endpoint
   * GET /health/memory
   */
  router.get('/health/memory', asyncHandler(async (req, res) => {
    try {
      const memUsage = process.memoryUsage();
      const osFreeMem = require('os').freemem();
      const osTotalMem = require('os').totalmem();

      // Convert bytes to MB for readability
      const formatBytes = (bytes) => Math.round(bytes / 1024 / 1024);

      const response = {
        process: {
          rss: formatBytes(memUsage.rss),
          heapTotal: formatBytes(memUsage.heapTotal),
          heapUsed: formatBytes(memUsage.heapUsed),
          external: formatBytes(memUsage.external),
          arrayBuffers: formatBytes(memUsage.arrayBuffers || 0)
        },
        system: {
          free: formatBytes(osFreeMem),
          total: formatBytes(osTotalMem),
          used: formatBytes(osTotalMem - osFreeMem),
          usage: Math.round(((osTotalMem - osFreeMem) / osTotalMem) * 100)
        },
        warnings: [],
        timestamp: new Date().toISOString()
      };

      // Add memory warnings
      const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      if (heapUsagePercent > 90) {
        response.warnings.push({
          type: 'high-heap-usage',
          message: `Heap usage is ${heapUsagePercent.toFixed(1)}%`,
          severity: 'critical'
        });
      } else if (heapUsagePercent > 75) {
        response.warnings.push({
          type: 'elevated-heap-usage',
          message: `Heap usage is ${heapUsagePercent.toFixed(1)}%`,
          severity: 'warning'
        });
      }

      if (response.system.usage > 95) {
        response.warnings.push({
          type: 'high-system-memory',
          message: `System memory usage is ${response.system.usage}%`,
          severity: 'critical'
        });
      }

      res.json(response);

    } catch (error) {
      const errorResponse = responseBuilder.buildErrorResponse(error, 500, req);
      res.status(500).json(errorResponse);
    }
  }));

  return router;
}

module.exports = setupHealthRoutes;