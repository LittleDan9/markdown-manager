import { useState, useEffect, useCallback } from 'react';
import MarkdownLintRulesService from '../services/linting/MarkdownLintRulesService';
import markdownLintApi from '../api/markdownLintApi';
import { useAuth } from '@/providers/AuthProvider';

/**
 * Hook for managing markdown lint rules
 * Provides methods to get, set, and validate rules for different contexts
 */
export function useMarkdownLintRules(categoryId = null, folderPath = null) {
  const { user } = useAuth();
  const userId = user?.id;
  const [apiClient] = useState(() => {
    MarkdownLintRulesService.setApiClient(markdownLintApi);
    return markdownLintApi;
  });
  const [rules, setRules] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Load applicable rules for current context
   */
  const loadRules = useCallback(async () => {
    if (!userId) {
      setRules(MarkdownLintRulesService.getDefaultRules());
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get effective rules following hierarchy: user -> category -> folder
      const effectiveRules = await MarkdownLintRulesService.getEffectiveRules(
        userId,
        categoryId,
        folderPath
      );
      setRules(effectiveRules);
    } catch (err) {
      console.error('Failed to load markdown lint rules:', err);
      setError(err.message || 'Failed to load rules');

      // Fallback to default rules
      setRules(MarkdownLintRulesService.getDefaultRules());
    } finally {
      setLoading(false);
    }
  }, [userId, categoryId, folderPath]);

  /**
   * Update category rules
   */
  const updateCategoryRules = useCallback(async (newRules) => {
    if (!categoryId) {
      throw new Error('Category ID is required to update category rules');
    }

    if (!userId) {
      throw new Error('User must be authenticated to update rules');
    }

    setLoading(true);
    setError(null);

    try {
      await apiClient.createOrUpdateRules({
        scope: 'category',
        userId,
        categoryId,
        rules: newRules
      });

      // Clear cache and reload
      MarkdownLintRulesService.clearCachedRules(userId, categoryId, folderPath);
      await loadRules();
    } catch (err) {
      console.error('Failed to update category rules:', err);
      setError(err.message || 'Failed to update category rules');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userId, categoryId, folderPath, apiClient, loadRules]);

  /**
   * Update folder rules
   */
  const updateFolderRules = useCallback(async (newRules) => {
    if (!folderPath) {
      throw new Error('Folder path is required to update folder rules');
    }

    if (!userId) {
      throw new Error('User must be authenticated to update rules');
    }

    setLoading(true);
    setError(null);

    try {
      await apiClient.createOrUpdateRules({
        scope: 'folder',
        userId,
        categoryId,
        folderPath,
        rules: newRules
      });

      // Clear cache and reload
      MarkdownLintRulesService.clearCachedRules(userId, categoryId, folderPath);
      await loadRules();
    } catch (err) {
      console.error('Failed to update folder rules:', err);
      setError(err.message || 'Failed to update folder rules');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userId, categoryId, folderPath, apiClient, loadRules]);

  /**
   * Update user default rules
   */
  const updateUserDefaults = useCallback(async (newRules) => {
    if (!userId) {
      throw new Error('User must be authenticated to update rules');
    }

    setLoading(true);
    setError(null);

    try {
      await apiClient.createOrUpdateRules({
        scope: 'user',
        userId,
        rules: newRules
      });

      // Clear cache and reload
      MarkdownLintRulesService.clearAllCachedRules(userId);
      await loadRules();
    } catch (err) {
      console.error('Failed to update user default rules:', err);
      setError(err.message || 'Failed to update user default rules');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userId, apiClient, loadRules]);

  /**
   * Delete category rules
   */
  const deleteCategoryRules = useCallback(async () => {
    if (!categoryId) {
      throw new Error('Category ID is required to delete category rules');
    }

    if (!userId) {
      throw new Error('User must be authenticated to delete rules');
    }

    setLoading(true);
    setError(null);

    try {
      await apiClient.deleteRules({
        scope: 'category',
        userId,
        categoryId
      });

      // Clear cache and reload
      MarkdownLintRulesService.clearCachedRules(userId, categoryId, folderPath);
      await loadRules();
    } catch (err) {
      console.error('Failed to delete category rules:', err);
      setError(err.message || 'Failed to delete category rules');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userId, categoryId, folderPath, apiClient, loadRules]);

  /**
   * Delete folder rules
   */
  const deleteFolderRules = useCallback(async () => {
    if (!folderPath) {
      throw new Error('Folder path is required to delete folder rules');
    }

    if (!userId) {
      throw new Error('User must be authenticated to delete rules');
    }

    setLoading(true);
    setError(null);

    try {
      await apiClient.deleteRules({
        scope: 'folder',
        userId,
        categoryId,
        folderPath
      });

      // Clear cache and reload
      MarkdownLintRulesService.clearCachedRules(userId, categoryId, folderPath);
      await loadRules();
    } catch (err) {
      console.error('Failed to delete folder rules:', err);
      setError(err.message || 'Failed to delete folder rules');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userId, categoryId, folderPath, apiClient, loadRules]);

  /**
   * Delete user default rules
   */
  const deleteUserDefaults = useCallback(async () => {
    if (!userId) {
      throw new Error('User must be authenticated to delete rules');
    }

    setLoading(true);
    setError(null);

    try {
      await apiClient.deleteRules({
        scope: 'user',
        userId
      });

      // Clear cache and reload
      MarkdownLintRulesService.clearAllCachedRules(userId);
      await loadRules();
    } catch (err) {
      console.error('Failed to delete user default rules:', err);
      setError(err.message || 'Failed to delete user default rules');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userId, apiClient, loadRules]);

  /**
   * Validate rule configuration
   */
  const validateRules = useCallback((rulesToValidate) => {
    return MarkdownLintRulesService.validateRules(rulesToValidate);
  }, []);

  /**
   * Get default rule configuration
   */
  const getDefaultRules = useCallback(() => {
    return MarkdownLintRulesService.getDefaultRules();
  }, []);

  /**
   * Get specific rule type from API
   */
  const getUserDefaultRules = useCallback(async () => {
    if (!userId) return null;
    try {
      return await apiClient.getRules({ scope: 'user', userId });
    } catch (error) {
      if (error.response?.status === 404) return null;
      throw error;
    }
  }, [userId, apiClient]);

  const getCategoryRules = useCallback(async () => {
    if (!categoryId || !userId) return null;
    try {
      return await apiClient.getRules({ scope: 'category', userId, categoryId });
    } catch (error) {
      if (error.response?.status === 404) return null;
      throw error;
    }
  }, [userId, categoryId, apiClient]);

  const getFolderRules = useCallback(async () => {
    if (!folderPath || !userId) return null;
    try {
      return await apiClient.getRules({ scope: 'folder', userId, categoryId, folderPath });
    } catch (error) {
      if (error.response?.status === 404) return null;
      throw error;
    }
  }, [userId, categoryId, folderPath, apiClient]);

  /**
   * Clear all cached rules
   */
  const clearCache = useCallback(() => {
    if (userId) {
      MarkdownLintRulesService.clearAllCachedRules(userId);
      loadRules(); // Reload after clearing cache
    }
  }, [userId, loadRules]);

  // Load rules on mount and when context changes
  useEffect(() => {
    loadRules();
  }, [loadRules]);

  return {
    // State
    rules,
    loading,
    error,

    // Actions
    loadRules,
    updateCategoryRules,
    updateFolderRules,
    updateUserDefaults,
    deleteCategoryRules,
    deleteFolderRules,
    deleteUserDefaults,

    // Utilities
    validateRules,
    getDefaultRules,
    getUserDefaultRules,
    getCategoryRules,
    getFolderRules,
    clearCache
  };
}

export default useMarkdownLintRules;