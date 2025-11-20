/**
 * ImageCacheService - Caches images using the browser's Cache API
 *
 * This service prevents image reloading on every render by caching images
 * and providing lazy loading functionality.
 */
class ImageCacheService {
  constructor() {
    this.cache = new Map();
    this.cacheName = 'markdown-images-v1';
    this.cacheInstance = null;
  }

  /**
   * Open the cache instance
   */
  async openCache() {
    if (!this.cacheInstance) {
      try {
        this.cacheInstance = await caches.open(this.cacheName);
      } catch (error) {
        console.warn('Cache API not available:', error);
        // Fallback to memory-only cache
      }
    }
    return this.cacheInstance;
  }

  /**
   * Cache an image and return a cached URL (async)
   */
  async cacheImage(url) {
    if (!url || typeof url !== 'string') return url;

    // Check memory cache first
    if (this.cache.has(url)) {
      return this.cache.get(url);
    }

    try {
      const cache = await this.openCache();

      if (cache) {
        // Check Cache API
        const response = await cache.match(url);
        if (response) {
          const blob = await response.blob();
          const objectUrl = URL.createObjectURL(blob);
          this.cache.set(url, objectUrl);
          return objectUrl;
        }

        // Fetch and cache the image
        const fetchResponse = await fetch(url, {
          mode: 'cors',
          credentials: 'same-origin'
        });

        if (fetchResponse.ok) {
          await cache.put(url, fetchResponse.clone());
          const blob = await fetchResponse.blob();
          const objectUrl = URL.createObjectURL(blob);
          this.cache.set(url, objectUrl);
          return objectUrl;
        }
      }
    } catch (error) {
      console.warn('Image caching failed for:', url, error);
    }

    // Fallback to original URL
    return url;
  }  /**
   * Get a cached image URL (memory cache only)
   */
  getCachedImage(url) {
    return this.cache.get(url) || url;
  }

  /**
   * Preload images for a document
   */
  async preloadImages(content) {
    if (!content) return;

    const imageUrls = this.extractImageUrls(content);
    if (imageUrls.length === 0) return;

    console.log(`🖼️ Preloading ${imageUrls.length} images`);

    const promises = imageUrls.map(url => this.cacheImage(url));
    const results = await Promise.allSettled(promises);

    const successful = results.filter(r => r.status === 'fulfilled').length;
    console.log(`✅ Preloaded ${successful}/${imageUrls.length} images`);
  }

  /**
   * Extract image URLs from markdown content
   */
  extractImageUrls(content) {
    const urls = [];
    // Match markdown image syntax: ![alt](url)
    const regex = /!\[.*?\]\((.*?)\)/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const url = match[1].trim();
      if (url && !urls.includes(url)) {
        urls.push(url);
      }
    }
    return urls;
  }

  /**
   * Clear all cached images
   */
  async clearCache() {
    // Clear memory cache
    this.cache.forEach(url => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
    this.cache.clear();

    // Clear Cache API
    try {
      await caches.delete(this.cacheName);
      this.cacheInstance = null;
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      memoryCache: this.cache.size,
      cacheName: this.cacheName
    };
  }
}

// Export singleton instance
const imageCacheService = new ImageCacheService();
export default imageCacheService;