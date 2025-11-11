import { useState, useEffect, useCallback } from 'react';
import { adminIconsApi } from '../../api/admin';
import { useNotification } from '../../components/NotificationProvider';

export function useDocumentUsageInsights() {
  const [insights, setInsights] = useState({});
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { showSuccess, showError } = useNotification();

  const analyzeDocument = async (documentId) => {
    setLoading(true);
    setError(null);
    try {
      const analysis = await adminIconsApi.analyzeDocumentRealtime(documentId);
      setInsights(prev => ({
        ...prev,
        [documentId]: analysis
      }));
      return analysis;
    } catch (err) {
      console.error('Failed to analyze document:', err);
      setError(err);
      showError(`Failed to analyze document: ${err.message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const loadTrends = async (days = 30) => {
    setLoading(true);
    setError(null);
    try {
      const trendsData = await adminIconsApi.getUsageTrendsRealtime(days);
      setTrends(trendsData);
      return trendsData;
    } catch (err) {
      console.error('Failed to load trends:', err);
      setError(err);
      showError(`Failed to load trends: ${err.message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const warmAnalysisCache = async (documentIds = null) => {
    setLoading(true);
    try {
      const result = await adminIconsApi.warmAnalysisCache(documentIds);
      showSuccess(`Warmed cache for ${result.warmed_documents} documents`);
      return result;
    } catch (err) {
      console.error('Failed to warm analysis cache:', err);
      showError(`Failed to warm cache: ${err.message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const clearAnalysisCache = async () => {
    setLoading(true);
    try {
      const result = await adminIconsApi.clearAnalysisCache();
      showSuccess(`Cleared ${result.cleared_entries} cached entries`);
      // Clear local insights cache as well
      setInsights({});
      setTrends(null);
      return result;
    } catch (err) {
      console.error('Failed to clear analysis cache:', err);
      showError(`Failed to clear cache: ${err.message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getDocumentInsight = (documentId) => {
    return insights[documentId] || null;
  };

  const hasDocumentInsight = (documentId) => {
    return documentId in insights;
  };

  const refreshDocumentInsight = async (documentId) => {
    return await analyzeDocument(documentId);
  };

  const refreshTrends = async (days = 30) => {
    return await loadTrends(days);
  };

  const clearInsights = () => {
    setInsights({});
    setTrends(null);
    setError(null);
  };

  return {
    insights,
    trends,
    loading,
    error,
    analyzeDocument,
    loadTrends,
    warmAnalysisCache,
    clearAnalysisCache,
    getDocumentInsight,
    hasDocumentInsight,
    refreshDocumentInsight,
    refreshTrends,
    clearInsights
  };
}

export function useDocumentAnalysis(documentId) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { showError } = useNotification();

  const loadAnalysis = useCallback(async () => {
    if (!documentId) return;

    setLoading(true);
    setError(null);
    try {
      const analysisData = await adminIconsApi.analyzeDocumentRealtime(documentId);
      setAnalysis(analysisData);
      return analysisData;
    } catch (err) {
      console.error('Failed to load document analysis:', err);
      setError(err);
      showError(`Failed to analyze document: ${err.message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [documentId, showError]);

  const refreshAnalysis = async () => {
    return await loadAnalysis();
  };

  useEffect(() => {
    if (documentId) {
      loadAnalysis();
    }
  }, [documentId, loadAnalysis]);

  return {
    analysis,
    loading,
    error,
    loadAnalysis,
    refreshAnalysis
  };
}

export function useUsageTrends(days = 30) {
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { showError } = useNotification();

  const loadTrends = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const trendsData = await adminIconsApi.getUsageTrendsRealtime(days);
      setTrends(trendsData);
      return trendsData;
    } catch (err) {
      console.error('Failed to load trends:', err);
      setError(err);
      showError(`Failed to load trends: ${err.message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [days, showError]);

  const refreshTrends = async () => {
    return await loadTrends();
  };

  useEffect(() => {
    loadTrends();
  }, [loadTrends]);

  return {
    trends,
    loading,
    error,
    loadTrends,
    refreshTrends
  };
}