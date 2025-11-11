/**
 * Spell Check Service - Refactored Server
 * Phase 3 Advanced Spell Checking Service with Modular Architecture
 * Created: October 25, 2025 by AI Agent (Refactored)
 * 
 * This is the main entry point for the spell check service.
 * All business logic has been extracted into separate modules for maintainability.
 */

const express = require('express');
const path = require('path');

// Import configuration and constants
const config = require('./config/default-settings.json');
const { SERVICE_INFO, DEFAULT_CONFIG, getEnvironmentConfig } = require('./utils/constants');

// Import core services
const ServiceManager = require('./services/ServiceManager');
const ResponseBuilder = require('./services/ResponseBuilder');

// Import middleware
const { requestLogger, performanceLogger } = require('./middleware/logging');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { corsMiddleware, securityHeaders, requestSizeLimiter } = require('./middleware/security');

// Import routes
const setupRoutes = require('./routes');

/**
 * Main Application Class
 */
class SpellCheckApplication {
  constructor() {
    this.app = express();
    this.config = this.mergeConfiguration();
    this.serviceManager = null;
    this.responseBuilder = null;
    this.server = null;
  }

  /**
   * Merge configuration from multiple sources
   */
  mergeConfiguration() {
    const envConfig = getEnvironmentConfig();
    return {
      ...DEFAULT_CONFIG,
      ...config,
      ...envConfig
    };
  }

  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    // Trust proxy for proper IP detection
    this.app.set('trust proxy', true);

    // Security middleware
    this.app.use(securityHeaders);
    this.app.use(corsMiddleware);
    this.app.use(requestSizeLimiter(this.config.security.maxRequestSizeBytes));

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Logging middleware
    this.app.use(requestLogger);
    if (this.config.logging.enablePerformanceLogging) {
      this.app.use(performanceLogger);
    }
  }

  /**
   * Setup application routes
   */
  setupRoutes() {
    // API routes
    this.app.use('/', setupRoutes(this.serviceManager, this.responseBuilder));

    // 404 handler for unknown routes
    this.app.use(notFoundHandler);

    // Global error handler (must be last)
    this.app.use(errorHandler);
  }

  /**
   * Initialize services
   */
  async initializeServices() {
    console.log(`[${SERVICE_INFO.name}] Initializing services...`);
    
    // Initialize service manager
    this.serviceManager = new ServiceManager(this.config);
    await this.serviceManager.initialize();

    // Initialize response builder
    this.responseBuilder = new ResponseBuilder(this.config);

    console.log(`[${SERVICE_INFO.name}] Services initialized successfully`);
  }

  /**
   * Start the HTTP server
   */
  async startServer() {
    const port = this.config.server.port;
    const host = this.config.server.host;

    return new Promise((resolve, reject) => {
      this.server = this.app.listen(port, host, (error) => {
        if (error) {
          reject(error);
          return;
        }

        console.log(`[${SERVICE_INFO.name}] Server started successfully`);
        console.log(`[${SERVICE_INFO.name}] ========================================`);
        console.log(`[${SERVICE_INFO.name}] Service: ${SERVICE_INFO.name} v${SERVICE_INFO.version}`);
        console.log(`[${SERVICE_INFO.name}] Phase: ${SERVICE_INFO.phase}`);
        console.log(`[${SERVICE_INFO.name}] Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`[${SERVICE_INFO.name}] Server: http://${host}:${port}`);
        console.log(`[${SERVICE_INFO.name}] ========================================`);
        console.log(`[${SERVICE_INFO.name}] Available endpoints:`);
        console.log(`[${SERVICE_INFO.name}]   GET  /health           - Basic health check`);
        console.log(`[${SERVICE_INFO.name}]   GET  /health/detailed  - Detailed health information`);
        console.log(`[${SERVICE_INFO.name}]   GET  /info             - Service information`);
        console.log(`[${SERVICE_INFO.name}]   POST /check            - Main spell check endpoint`);
        console.log(`[${SERVICE_INFO.name}]   POST /check-batch      - Batch processing`);
        console.log(`[${SERVICE_INFO.name}]   POST /detect-language  - Language detection`);
        console.log(`[${SERVICE_INFO.name}]   GET  /languages        - Available languages`);
        console.log(`[${SERVICE_INFO.name}]   GET  /style-guides     - Available style guides`);
        console.log(`[${SERVICE_INFO.name}]   POST /contextual-suggestions - Contextual analysis`);
        console.log(`[${SERVICE_INFO.name}] ========================================`);
        
        resolve();
      });

      // Configure server timeouts
      this.server.timeout = this.config.server.timeout;
      this.server.keepAliveTimeout = this.config.server.keepAliveTimeout;
      this.server.headersTimeout = this.config.server.headersTimeout;
    });
  }

  /**
   * Setup graceful shutdown handlers
   */
  setupShutdownHandlers() {
    // Add server shutdown to service manager
    this.serviceManager.addShutdownHandler(async () => {
      if (this.server) {
        console.log(`[${SERVICE_INFO.name}] Closing HTTP server...`);
        await new Promise((resolve) => {
          this.server.close(resolve);
        });
        console.log(`[${SERVICE_INFO.name}] HTTP server closed`);
      }
    });
  }

  /**
   * Main application startup
   */
  async start() {
    try {
      console.log(`[${SERVICE_INFO.name}] Starting ${SERVICE_INFO.description}...`);
      console.log(`[${SERVICE_INFO.name}] Version: ${SERVICE_INFO.version}, Phase: ${SERVICE_INFO.phase}`);
      
      // Setup Express application
      this.setupMiddleware();
      
      // Initialize all services
      await this.initializeServices();
      
      // Setup routes after services are ready
      this.setupRoutes();
      
      // Setup graceful shutdown
      this.setupShutdownHandlers();
      
      // Start HTTP server
      await this.startServer();
      
      console.log(`[${SERVICE_INFO.name}] Application startup complete`);
      
    } catch (error) {
      console.error(`[${SERVICE_INFO.name}] Failed to start application:`, error);
      
      // Cleanup on startup failure
      if (this.serviceManager) {
        try {
          await this.serviceManager.cleanup();
        } catch (cleanupError) {
          console.error(`[${SERVICE_INFO.name}] Cleanup error:`, cleanupError);
        }
      }
      
      process.exit(1);
    }
  }
}

/**
 * Application entry point
 */
async function main() {
  const app = new SpellCheckApplication();
  await app.start();
}

// Start the application
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error during startup:', error);
    process.exit(1);
  });
}

module.exports = SpellCheckApplication;