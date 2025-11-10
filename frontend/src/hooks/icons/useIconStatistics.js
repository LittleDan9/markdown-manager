import { useState, useEffect, useCallback } from 'react';
import { adminIconsApi } from '../../api/admin';

export function useIconStatistics() {
  const [systemStats, setSystemStats] = useState(null);
  const [popularIcons, setPopularIcons] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadSystemStats = useCallback(async () => {
    try {
      setError(null);
      const stats = await adminIconsApi.getIconStatistics();
      setSystemStats(stats);
    } catch (err) {
      console.error('Failed to load system statistics:', err);
      setError(err);
    }
  }, []);

  const loadPopularIcons = useCallback(async () => {
    try {
      setError(null);
      const popular = await adminIconsApi.getPopularIcons(10);
      setPopularIcons(popular);
    } catch (err) {
      console.error('Failed to load popular icons:', err);
      setError(err);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadSystemStats(),
        loadPopularIcons()
      ]);
    } finally {
      setLoading(false);
    }
  }, [loadSystemStats, loadPopularIcons]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  return {
    systemStats,
    popularIcons,
    loading,
    error,
    refreshAll,
    loadSystemStats,
    loadPopularIcons
  };
}