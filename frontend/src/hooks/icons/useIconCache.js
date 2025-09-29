import { useState, useEffect } from 'react';
import { adminIconsApi } from '../../api/admin';
import { useNotification } from '../../components/NotificationProvider';

export function useIconCache() {
  const [cacheStats, setCacheStats] = useState(null);
  const [cacheAnalysis, setCacheAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { showSuccess, showError } = useNotification();

  const loadCacheStats = async () => {
    try {
      setError(null);
      const stats = await adminIconsApi.getCacheStats();
      setCacheStats(stats);
    } catch (err) {
      console.error('Failed to load cache statistics:', err);
      setError(err);
    }
  };

  const loadCacheAnalysis = async () => {
    try {
      setError(null);
      const analysis = await adminIconsApi.getCacheAnalysis();
      setCacheAnalysis(analysis);
    } catch (err) {
      console.error('Failed to load cache analysis:', err);
      setError(err);
    }
  };

  const clearCache = async () => {
    setLoading(true);
    try {
      await adminIconsApi.clearCache();
      showSuccess('Icon cache cleared successfully!');
      await Promise.all([loadCacheStats(), loadCacheAnalysis()]);
    } catch (err) {
      console.error('Failed to clear cache:', err);
      showError(`Failed to clear cache: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const warmCache = async () => {
    setLoading(true);
    try {
      await adminIconsApi.warmCache();
      showSuccess('Cache warmed with popular icons!');
      await Promise.all([loadCacheStats(), loadCacheAnalysis()]);
    } catch (err) {
      console.error('Failed to warm cache:', err);
      showError(`Failed to warm cache: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const cleanupExpired = async () => {
    setLoading(true);
    try {
      await adminIconsApi.cleanupExpiredCache();
      showSuccess('Expired entries cleaned up');
      await Promise.all([loadCacheStats(), loadCacheAnalysis()]);
    } catch (err) {
      console.error('Failed to cleanup cache:', err);
      showError(`Failed to cleanup cache: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const invalidatePackCache = async (packName) => {
    setLoading(true);
    try {
      const result = await adminIconsApi.invalidatePackCache(packName);
      showSuccess(`Invalidated ${result.invalidated_entries} cache entries for pack '${packName}'`);
      await Promise.all([loadCacheStats(), loadCacheAnalysis()]);
    } catch (err) {
      console.error('Failed to invalidate pack cache:', err);
      showError(`Failed to invalidate pack cache: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const refreshAll = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadCacheStats(),
        loadCacheAnalysis()
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  return {
    cacheStats,
    cacheAnalysis,
    loading,
    error,
    clearCache,
    warmCache,
    cleanupExpired,
    invalidatePackCache,
    refreshAll,
    loadCacheStats,
    loadCacheAnalysis
  };
}