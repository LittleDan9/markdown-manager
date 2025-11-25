/**
 * Feature Registry System
 *
 * A modular system for loading and initializing features based on data attributes.
 * Features are self-contained modules that handle their own UI and behavior.
 */

class FeatureRegistry {
  constructor() {
    this.features = new Map();
    this.initializedElements = new WeakSet();
  }

  /**
   * Register a feature implementation
   * @param {string} name - Feature name (matches data-features attribute value)
   * @param {Object} implementation - Feature implementation with initialize/cleanup methods
   */
  register(name, implementation) {
    if (!implementation.initialize) {
      throw new Error(`Feature '${name}' must have an 'initialize' method`);
    }

    this.features.set(name, implementation);
    console.log(`📦 Feature registered: ${name}`);
  }

  /**
   * Initialize all features in a container
   * @param {Element} container - Container element to search for feature elements
   * @param {Object} context - Shared context (refs, handlers, etc.)
   */
  initializeFeatures(container, context = {}) {
    console.log('🚀 Initializing features in container:', container);

    // Find all elements with data-features attribute
    const elements = container.querySelectorAll('[data-features]');

    console.log(`Found ${elements.length} elements with features`);

    elements.forEach(element => {
      // Skip if already initialized
      if (this.initializedElements.has(element)) {
        return;
      }

      const featureNames = element.dataset.features.split(',');
      console.log(`Initializing features for element:`, {
        tagName: element.tagName,
        features: featureNames,
        dataset: element.dataset
      });

      featureNames.forEach(name => {
        const featureName = name.trim();
        const feature = this.features.get(featureName);

        if (feature) {
          try {
            console.log(`🔧 Initializing feature: ${featureName}`);
            feature.initialize(element, context);
          } catch (error) {
            console.error(`❌ Error initializing feature '${featureName}':`, error);
          }
        } else {
          console.warn(`⚠️ Feature '${featureName}' not registered`);
        }
      });

      // Mark as initialized
      this.initializedElements.add(element);
    });
  }

  /**
   * Clean up features in a container
   * @param {Element} container - Container element
   */
  cleanupFeatures(container) {
    const elements = container.querySelectorAll('[data-features]');

    elements.forEach(element => {
      if (!this.initializedElements.has(element)) {
        return;
      }

      const featureNames = element.dataset.features.split(',');

      featureNames.forEach(name => {
        const featureName = name.trim();
        const feature = this.features.get(featureName);

        if (feature && feature.cleanup) {
          try {
            console.log(`🧹 Cleaning up feature: ${featureName}`);
            feature.cleanup(element);
          } catch (error) {
            console.error(`❌ Error cleaning up feature '${featureName}':`, error);
          }
        }
      });

      // Remove from initialized set
      this.initializedElements.delete(element);
    });
  }

  /**
   * Get list of registered features
   */
  getRegisteredFeatures() {
    return Array.from(this.features.keys());
  }

  /**
   * Check if a feature is registered
   */
  hasFeature(name) {
    return this.features.has(name);
  }
}

// Global feature registry instance
export const featureRegistry = new FeatureRegistry();

// Convenience exports
export const registerFeature = (name, implementation) => {
  featureRegistry.register(name, implementation);
};

export const initializeFeatures = (container, context) => {
  featureRegistry.initializeFeatures(container, context);
};

export const cleanupFeatures = (container) => {
  featureRegistry.cleanupFeatures(container);
};

export default featureRegistry;