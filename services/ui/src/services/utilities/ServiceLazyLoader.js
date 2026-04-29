/**
 * Service Lazy Loader
 * Implements lazy loading for heavy services and libraries
 */

class ServiceLazyLoader {
  constructor() {
    this.loadedServices = new Map();
    this.loadingPromises = new Map();
  }

  /**
   * Lazy load IconPackManager
   */
  async getIconPackManager() {
    if (this.loadedServices.has('iconPack')) {
      return this.loadedServices.get('iconPack');
    }

    if (this.loadingPromises.has('iconPack')) {
      return this.loadingPromises.get('iconPack');
    }

    const loadPromise = import('../utilities').then(module => {
      const service = module.IconPackManager;
      this.loadedServices.set('iconPack', service);
      this.loadingPromises.delete('iconPack');
      return service;
    });

    this.loadingPromises.set('iconPack', loadPromise);
    return loadPromise;
  }

  /**
   * Lazy load SpellCheckWorkerPool
   */
  async getSpellCheckWorkerPool() {
    if (this.loadedServices.has('spellCheck')) {
      return this.loadedServices.get('spellCheck');
    }

    if (this.loadingPromises.has('spellCheck')) {
      return this.loadingPromises.get('spellCheck');
    }

    const loadPromise = import('../editor/spellCheck/SpellCheckWorkerPool.js').then(module => {
      const SpellCheckWorkerPool = module.default;
      const service = new SpellCheckWorkerPool(2); // 2 workers max
      this.loadedServices.set('spellCheck', service);
      this.loadingPromises.delete('spellCheck');
      return service;
    });

    this.loadingPromises.set('spellCheck', loadPromise);
    return loadPromise;
  }

  /**
   * Preload critical services
   */
  async preloadCriticalServices() {
    // Preload services that are likely to be needed soon
    const preloadPromises = [
      // Preload icon pack manager as it's commonly used
      this.getIconPackManager(),

      // Preload spell check for editor
      this.getSpellCheckWorkerPool()
    ];

    await Promise.allSettled(preloadPromises);
  }

  /**
   * Clear cache and reset
   */
  reset() {
    this.loadedServices.clear();
    this.loadingPromises.clear();
  }

  /**
   * Get loading status
   */
  getLoadingStatus() {
    return {
      loaded: Array.from(this.loadedServices.keys()),
      loading: Array.from(this.loadingPromises.keys())
    };
  }
}

// Export singleton instance
export default new ServiceLazyLoader();
