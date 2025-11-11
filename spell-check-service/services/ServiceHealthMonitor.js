/**
 * Service Health Monitor
 * Handles health checking and status reporting for services
 */

const { SERVICE_INFO } = require('../utils/constants');

/**
 * Service Health Monitor Class
 * Provides health checking functionality for service components
 */
class ServiceHealthMonitor {
  constructor() {
    this.lastHealthCheck = null;
    this.healthCache = new Map();
    this.healthCacheTTL = 5000; // 5 seconds
  }

  /**
   * Get comprehensive health information for all services
   */
  getHealthInfo(services, initialized) {
    if (!initialized) {
      return {
        status: 'initializing',
        services: {},
        initialized: false
      };
    }

    const serviceHealth = {};

    Object.entries(services).forEach(([name, service]) => {
      try {
        serviceHealth[name] = this.getServiceHealth(name, service);
      } catch (error) {
        serviceHealth[name] = {
          loaded: true,
          status: 'error',
          error: error.message
        };
      }
    });

    return {
      status: 'healthy',
      initialized: true,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      services: serviceHealth,
      config: {
        version: SERVICE_INFO.version,
        phase: SERVICE_INFO.phase
      }
    };
  }

  /**
   * Get health information for a single service
   */
  getServiceHealth(name, service) {
    const cacheKey = name;
    const now = Date.now();

    // Check cache first
    if (this.healthCache.has(cacheKey)) {
      const cached = this.healthCache.get(cacheKey);
      if (now - cached.timestamp < this.healthCacheTTL) {
        return cached.health;
      }
    }

    const health = {
      loaded: true,
      status: 'healthy'
    };

    // Get service-specific stats if available
    if (service.getStatistics) {
      health.statistics = service.getStatistics();
    }
    if (service.getSettings) {
      health.settings = service.getSettings();
    }
    if (service.getCacheStats) {
      health.cacheStats = service.getCacheStats();
    }
    if (service.getRuleConfiguration) {
      health.rules = service.getRuleConfiguration();
    }
    if (service.getSupportedLanguages) {
      health.supportedLanguages = service.getSupportedLanguages().length;
    }
    if (service.getAvailableStyleGuides) {
      health.availableGuides = service.getAvailableStyleGuides().length;
    }

    // Cache the result
    this.healthCache.set(cacheKey, {
      health,
      timestamp: now
    });

    return health;
  }

  /**
   * Check if a specific service is healthy
   */
  isServiceHealthy(name, service) {
    try {
      const health = this.getServiceHealth(name, service);
      return health.status === 'healthy';
    } catch (error) {
      return false;
    }
  }

  /**
   * Get service status summary
   */
  getServiceStatusSummary(services) {
    const summary = {
      total: 0,
      healthy: 0,
      unhealthy: 0,
      loading: 0
    };

    Object.entries(services).forEach(([name, service]) => {
      summary.total++;

      if (this.isServiceHealthy(name, service)) {
        summary.healthy++;
      } else {
        summary.unhealthy++;
      }
    });

    return summary;
  }

  /**
   * Clear health cache
   */
  clearCache() {
    this.healthCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.healthCache.size,
      ttl: this.healthCacheTTL
    };
  }
}

module.exports = ServiceHealthMonitor;