/**
 * Memory Optimization Hook
 * Provides utilities for memory management and cleanup
 */
import { useEffect, useRef, useCallback } from 'react';

export default function useMemoryOptimization(options = {}) {
  const {
    enableWeakMapCache = true,
    enablePeriodicCleanup = true,
    cleanupInterval = 300000, // 5 minutes
    maxCacheSize = 100
  } = options;

  const cacheRef = useRef(enableWeakMapCache ? new WeakMap() : new Map());
  const cleanupTimeoutRef = useRef();
  const resourcesRef = useRef(new Set());

  // Cache with automatic cleanup
  const cache = useCallback((key, value) => {
    if (enableWeakMapCache && typeof key === 'object') {
      cacheRef.current.set(key, value);
    } else if (!enableWeakMapCache) {
      // Regular Map with size limit
      if (cacheRef.current.size >= maxCacheSize) {
        const firstKey = cacheRef.current.keys().next().value;
        cacheRef.current.delete(firstKey);
      }
      cacheRef.current.set(key, value);
    }
  }, [enableWeakMapCache, maxCacheSize]);

  const getFromCache = useCallback((key) => {
    return cacheRef.current.get(key);
  }, []);

  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  // Resource tracking for cleanup
  const trackResource = useCallback((resource, cleanupFn) => {
    const resourceWrapper = {
      resource,
      cleanup: cleanupFn,
      id: Math.random().toString(36).substring(7)
    };
    
    resourcesRef.current.add(resourceWrapper);
    
    // Return cleanup function that also removes from tracking
    return () => {
      try {
        cleanupFn(resource);
      } catch (error) {
        console.warn('Error during resource cleanup:', error);
      }
      resourcesRef.current.delete(resourceWrapper);
    };
  }, []);

  // Periodic cleanup
  const performCleanup = useCallback(() => {
    // Clean up tracked resources that are no longer needed
    for (const resourceWrapper of resourcesRef.current) {
      try {
        // Check if resource is still valid/needed
        if (resourceWrapper.resource && 
            typeof resourceWrapper.resource.isValid === 'function' && 
            !resourceWrapper.resource.isValid()) {
          resourceWrapper.cleanup(resourceWrapper.resource);
          resourcesRef.current.delete(resourceWrapper);
        }
      } catch (error) {
        console.warn('Error during periodic cleanup:', error);
        resourcesRef.current.delete(resourceWrapper);
      }
    }

    // Schedule next cleanup
    if (enablePeriodicCleanup) {
      cleanupTimeoutRef.current = setTimeout(performCleanup, cleanupInterval);
    }
  }, [enablePeriodicCleanup, cleanupInterval]);

  // Manual memory pressure handling
  const handleMemoryPressure = useCallback(() => {
    // Clear all caches
    clearCache();
    
    // Force garbage collection if available (dev mode)
    if (typeof window !== 'undefined' && window.gc && process.env.NODE_ENV === 'development') {
      try {
        window.gc();
      } catch (error) {
        // GC not available
      }
    }

    // Clean up optional resources
    for (const resourceWrapper of resourcesRef.current) {
      if (resourceWrapper.resource && resourceWrapper.resource.optional) {
        try {
          resourceWrapper.cleanup(resourceWrapper.resource);
          resourcesRef.current.delete(resourceWrapper);
        } catch (error) {
          console.warn('Error during memory pressure cleanup:', error);
        }
      }
    }
  }, [clearCache]);

  // Monitor memory usage if available
  const getMemoryInfo = useCallback(() => {
    if (typeof performance !== 'undefined' && performance.memory) {
      return {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit,
        usage: performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit
      };
    }
    return null;
  }, []);

  // Setup and cleanup
  useEffect(() => {
    if (enablePeriodicCleanup) {
      cleanupTimeoutRef.current = setTimeout(performCleanup, cleanupInterval);
    }

    // Listen for memory pressure events if available
    const handleMemoryPressureEvent = () => handleMemoryPressure();
    
    if (typeof window !== 'undefined' && 'memory' in performance) {
      // Custom memory pressure detection
      const checkMemoryPressure = () => {
        const memInfo = getMemoryInfo();
        if (memInfo && memInfo.usage > 0.9) { // 90% memory usage
          handleMemoryPressure();
        }
      };

      const memoryCheckInterval = setInterval(checkMemoryPressure, 30000); // Check every 30 seconds

      return () => {
        clearInterval(memoryCheckInterval);
        if (cleanupTimeoutRef.current) {
          clearTimeout(cleanupTimeoutRef.current);
        }
        
        // Final cleanup of all tracked resources
        for (const resourceWrapper of resourcesRef.current) {
          try {
            resourceWrapper.cleanup(resourceWrapper.resource);
          } catch (error) {
            console.warn('Error during final cleanup:', error);
          }
        }
        resourcesRef.current.clear();
        clearCache();
      };
    }

    return () => {
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
      }
      
      // Final cleanup
      for (const resourceWrapper of resourcesRef.current) {
        try {
          resourceWrapper.cleanup(resourceWrapper.resource);
        } catch (error) {
          console.warn('Error during final cleanup:', error);
        }
      }
      resourcesRef.current.clear();
      clearCache();
    };
  }, [enablePeriodicCleanup, cleanupInterval, performCleanup, handleMemoryPressure, clearCache, getMemoryInfo]);

  return {
    cache,
    getFromCache,
    clearCache,
    trackResource,
    handleMemoryPressure,
    getMemoryInfo,
    performCleanup
  };
}
