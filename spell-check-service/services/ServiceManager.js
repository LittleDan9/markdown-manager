/**
 * Service Manager
 * Handles initialization, lifecycle, and management of all spell check service components
 */

const { SERVICE_INFO, DEFAULT_CONFIG } = require('../utils/constants');
const ServiceHealthMonitor = require('./ServiceHealthMonitor');

// Import Phase 2 enhanced functionality
const EnhancedSpellChecker = require('../lib/EnhancedSpellChecker');
const GrammarChecker = require('../lib/GrammarChecker');
const StyleAnalyzer = require('../lib/StyleAnalyzer');
const LanguageDetector = require('../lib/LanguageDetector');

// Import Phase 3 advanced functionality
const CustomDictionaryManager = require('../lib/CustomDictionaryManager');
const ContextualAnalyzer = require('../lib/ContextualAnalyzer');
const StyleGuideManager = require('../lib/StyleGuideManager');

// Import CSpell integration
const CSpellCodeChecker = require('../lib/CSpellCodeChecker');

// Phase 5 services removed - now handled by separate spell-check-consumer-service

/**
 * Service Manager Class
 * Manages the lifecycle of all service components
 */
class ServiceManager {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.services = {};
    this.initialized = false;
    this.shutdownHandlers = [];
    this.healthMonitor = new ServiceHealthMonitor();

    // Bind methods to preserve context
    this.gracefulShutdown = this.gracefulShutdown.bind(this);
    this.handleUncaughtException = this.handleUncaughtException.bind(this);
    this.handleUnhandledRejection = this.handleUnhandledRejection.bind(this);
  }

  /**
   * Initialize all service components
   */
  async initialize() {
    if (this.initialized) {
      console.warn('[ServiceManager] Services already initialized');
      return;
    }

    try {
      console.log(`[ServiceManager] Initializing ${SERVICE_INFO.name} v${SERVICE_INFO.version} Phase ${SERVICE_INFO.phase}...`);

      // Set up process event handlers
      this.setupProcessHandlers();

      // Initialize all components in parallel for faster startup
      const initPromises = [];

      // Core services (Phase 2)
      console.log('[ServiceManager] Loading enhanced spell checker...');
      this.services.spellChecker = new EnhancedSpellChecker();
      initPromises.push(this.initializeService('spellChecker', this.services.spellChecker));

      console.log('[ServiceManager] Loading grammar checker...');
      this.services.grammarChecker = new GrammarChecker();
      initPromises.push(this.initializeService('grammarChecker', this.services.grammarChecker));

      console.log('[ServiceManager] Loading style analyzer...');
      this.services.styleAnalyzer = new StyleAnalyzer();
      initPromises.push(this.initializeService('styleAnalyzer', this.services.styleAnalyzer));

      console.log('[ServiceManager] Loading language detector...');
      this.services.languageDetector = new LanguageDetector();
      initPromises.push(this.initializeService('languageDetector', this.services.languageDetector));

      // Advanced services (Phase 3)
      console.log('[ServiceManager] Loading custom dictionary manager...');
      this.services.customDictionaryManager = new CustomDictionaryManager();
      initPromises.push(this.initializeService('customDictionaryManager', this.services.customDictionaryManager));

      console.log('[ServiceManager] Loading contextual analyzer...');
      this.services.contextualAnalyzer = new ContextualAnalyzer();
      initPromises.push(this.initializeService('contextualAnalyzer', this.services.contextualAnalyzer));

      console.log('[ServiceManager] Loading style guide manager...');
      this.services.styleGuideManager = new StyleGuideManager();
      initPromises.push(this.initializeService('styleGuideManager', this.services.styleGuideManager));

      console.log('[ServiceManager] Loading CSpell code checker...');
      this.services.cspellCodeChecker = new CSpellCodeChecker();
      initPromises.push(this.initializeService('cspellCodeChecker', this.services.cspellCodeChecker));

      // Phase 5 services now handled by separate spell-check-consumer-service
      console.log('[ServiceManager] Phase 5 consumer services are external');

      // Wait for all services to initialize
      const results = await Promise.allSettled(initPromises);

      // Check for failures
      const failures = results
        .map((result, index) => ({ result, service: Object.keys(this.services)[index] }))
        .filter(({ result }) => result.status === 'rejected');

      if (failures.length > 0) {
        console.error('[ServiceManager] Some services failed to initialize:');
        failures.forEach(({ result, service }) => {
          console.error(`[ServiceManager] ${service}: ${result.reason.message}`);
        });

        // Decide whether to continue with partial functionality
        const criticalServices = ['spellChecker', 'grammarChecker'];
        const criticalFailures = failures.filter(({ service }) => criticalServices.includes(service));

        if (criticalFailures.length > 0) {
          throw new Error(`Critical services failed to initialize: ${criticalFailures.map(f => f.service).join(', ')}`);
        } else {
          console.warn('[ServiceManager] Continuing with reduced functionality due to service failures');
        }
      }

      this.initialized = true;
      console.log('[ServiceManager] All services initialized successfully');

      // Start Phase 5 background services
      await this.startBackgroundServices();

      // Log service status
      this.logServiceStatus();

    } catch (error) {
      console.error('[ServiceManager] Failed to initialize services:', error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Initialize individual service with timeout and error handling
   */
  async initializeService(name, service) {
    const startTime = Date.now();

    try {
      await Promise.race([
        service.init(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Initialization timeout')), 30000)
        )
      ]);

      const duration = Date.now() - startTime;
      console.log(`[ServiceManager] ${name} initialized in ${duration}ms`);

    } catch (error) {
      console.error(`[ServiceManager] Failed to initialize ${name}:`, error.message);
      throw error;
    }
  }

  /**
   * Get a service instance
   */
  getService(serviceName) {
    if (!this.initialized) {
      throw new Error('Services not initialized');
    }

    const service = this.services[serviceName];
    if (!service) {
      throw new Error(`Service '${serviceName}' not found`);
    }

    return service;
  }

  /**
   * Get all services
   */
  getServices() {
    if (!this.initialized) {
      throw new Error('Services not initialized');
    }

    return { ...this.services };
  }

  /**
   * Check if services are ready
   */
  isReady() {
    return this.initialized && Object.keys(this.services).length > 0;
  }

  /**
   * Get service health information
   */
  getHealthInfo() {
    return this.healthMonitor.getHealthInfo(this.services, this.initialized);
  }

  /**
   * Setup process event handlers for graceful shutdown
   */
  setupProcessHandlers() {
    // Graceful shutdown signals
    process.on('SIGINT', this.gracefulShutdown);
    process.on('SIGTERM', this.gracefulShutdown);

    // Error handling
    process.on('uncaughtException', this.handleUncaughtException);
    process.on('unhandledRejection', this.handleUnhandledRejection);
  }

  /**
   * Add shutdown handler
   */
  addShutdownHandler(handler) {
    this.shutdownHandlers.push(handler);
  }

  /**
   * Graceful shutdown
   */
  async gracefulShutdown(signal) {
    console.log(`[ServiceManager] Received ${signal}, shutting down gracefully...`);

    try {
      // Execute custom shutdown handlers
      for (const handler of this.shutdownHandlers) {
        try {
          await handler();
        } catch (error) {
          console.error('[ServiceManager] Shutdown handler error:', error);
        }
      }

      // Cleanup services
      await this.cleanup();

      console.log('[ServiceManager] Graceful shutdown complete');
      process.exit(0);

    } catch (error) {
      console.error('[ServiceManager] Error during shutdown:', error);
      process.exit(1);
    }
  }

  /**
   * Handle uncaught exceptions
   */
  handleUncaughtException(error) {
    console.error('[ServiceManager] Uncaught Exception:', error);
    this.gracefulShutdown('UNCAUGHT_EXCEPTION');
  }

  /**
   * Handle unhandled promise rejections
   */
  handleUnhandledRejection(reason, promise) {
    console.error('[ServiceManager] Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit on unhandled rejections in production, just log them
    if (process.env.NODE_ENV !== 'production') {
      this.gracefulShutdown('UNHANDLED_REJECTION');
    }
  }

  /**
   * Cleanup services
   */
  async cleanup() {
    console.log('[ServiceManager] Cleaning up services...');

    // Stop background services first
    await this.stopBackgroundServices();

    const cleanupPromises = Object.entries(this.services).map(async ([name, service]) => {
      try {
        if (service.cleanup && typeof service.cleanup === 'function') {
          await service.cleanup();
          console.log(`[ServiceManager] ${name} cleaned up`);
        }
      } catch (error) {
        console.error(`[ServiceManager] Error cleaning up ${name}:`, error.message);
      }
    });

    await Promise.allSettled(cleanupPromises);

    this.services = {};
    this.initialized = false;
  }

  /**
   * Start background services (Phase 5)
   */
  async startBackgroundServices() {
    console.log('[ServiceManager] Starting background services...');

    // Background services (event consumer, outbox relay) now handled
    // by separate spell-check-consumer-service
    console.log('[ServiceManager] Background services are external - skipping');
  }

  /**
   * Stop background services (Phase 5)
   */
  async stopBackgroundServices() {
    console.log('[ServiceManager] Stopping background services...');

    // Background services (event consumer, outbox relay) now handled
    // by separate spell-check-consumer-service - nothing to stop here
    console.log('[ServiceManager] Background services are external - skipping shutdown');
  }

  /**
   * Log current service status
   */
  logServiceStatus() {
    const status = Object.entries(this.services).map(([name, service]) => {
      let statusInfo = `${name}: loaded`;

      try {
        if (service.getStatistics) {
          const stats = service.getStatistics();
          if (stats.memoryUsage) {
            statusInfo += ` (${Math.round(stats.memoryUsage / 1024 / 1024)}MB)`;
          }
        }
      } catch (error) {
        // Ignore stats errors
      }

      return statusInfo;
    });

    console.log('[ServiceManager] Service Status:');
    status.forEach(s => console.log(`  - ${s}`));
  }

  /**
   * Restart a specific service
   */
  async restartService(serviceName) {
    if (!this.services[serviceName]) {
      throw new Error(`Service '${serviceName}' not found`);
    }

    console.log(`[ServiceManager] Restarting ${serviceName}...`);

    try {
      // Cleanup old service
      const service = this.services[serviceName];
      if (service.cleanup) {
        await service.cleanup();
      }

      // Reinitialize
      await this.initializeService(serviceName, service);

      console.log(`[ServiceManager] ${serviceName} restarted successfully`);

    } catch (error) {
      console.error(`[ServiceManager] Failed to restart ${serviceName}:`, error);
      throw error;
    }
  }
}

module.exports = ServiceManager;