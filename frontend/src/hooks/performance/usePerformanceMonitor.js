/**
 * Performance Monitor Hook
 * Tracks component performance and provides insights
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { useLogger } from '@/providers/LoggerProvider';

export default function usePerformanceMonitor(componentName, options = {}) {
  const logger = useLogger(`Performance:${componentName}`);
  const mountTimeRef = useRef(Date.now());
  const renderCountRef = useRef(0);
  const [performanceData, setPerformanceData] = useState({
    renderCount: 0,
    averageRenderTime: 0,
    lastRenderTime: 0,
    mountTime: 0
  });

  const {
    trackRenderTime = true,
    trackRenderCount = true,
    logThreshold = 100, // Log if render takes longer than 100ms
    enabled = process.env.NODE_ENV === 'development'
  } = options;

  // Track render time
  const renderStartRef = useRef();
  
  if (trackRenderTime && enabled) {
    renderStartRef.current = performance.now();
  }

  // Update render count and timing after render
  useEffect(() => {
    if (!enabled) return;

    renderCountRef.current += 1;
    
    if (trackRenderTime && renderStartRef.current) {
      const renderTime = performance.now() - renderStartRef.current;
      
      if (renderTime > logThreshold) {
        logger.warn(`Slow render detected: ${renderTime.toFixed(2)}ms`);
      }

      setPerformanceData(prev => ({
        renderCount: renderCountRef.current,
        averageRenderTime: (prev.averageRenderTime * (prev.renderCount - 1) + renderTime) / prev.renderCount,
        lastRenderTime: renderTime,
        mountTime: Date.now() - mountTimeRef.current
      }));
    } else if (trackRenderCount) {
      setPerformanceData(prev => ({
        ...prev,
        renderCount: renderCountRef.current,
        mountTime: Date.now() - mountTimeRef.current
      }));
    }
  });

  // Track component mount time
  useEffect(() => {
    if (!enabled) return;

    const mountTime = Date.now() - mountTimeRef.current;
    logger.debug(`Component mounted in ${mountTime}ms`);

    return () => {
      const totalLifetime = Date.now() - mountTimeRef.current;
      logger.debug(`Component unmounted after ${totalLifetime}ms lifetime, ${renderCountRef.current} renders`);
    };
  }, [logger, enabled]);

  // Manual performance measurement
  const measureOperation = useCallback((operationName, operation) => {
    if (!enabled) return operation();

    return new Promise(async (resolve, reject) => {
      const startTime = performance.now();
      
      try {
        const result = await operation();
        const duration = performance.now() - startTime;
        
        logger.debug(`${operationName} completed in ${duration.toFixed(2)}ms`);
        
        if (duration > logThreshold * 2) {
          logger.warn(`Slow operation detected: ${operationName} took ${duration.toFixed(2)}ms`);
        }
        
        resolve(result);
      } catch (error) {
        const duration = performance.now() - startTime;
        logger.error(`${operationName} failed after ${duration.toFixed(2)}ms:`, error);
        reject(error);
      }
    });
  }, [logger, enabled, logThreshold]);

  // Memory usage tracking (if available)
  const getMemoryUsage = useCallback(() => {
    if (!enabled || !performance.memory) return null;

    return {
      used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024), // MB
      total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024), // MB
      limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) // MB
    };
  }, [enabled]);

  // Log performance summary
  const logPerformanceSummary = useCallback(() => {
    if (!enabled) return;

    const memory = getMemoryUsage();
    logger.info('Performance Summary:', {
      component: componentName,
      ...performanceData,
      memory
    });
  }, [logger, enabled, componentName, performanceData, getMemoryUsage]);

  return {
    performanceData,
    measureOperation,
    getMemoryUsage,
    logPerformanceSummary,
    enabled
  };
}
