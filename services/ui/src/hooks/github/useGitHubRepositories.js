import { useState, useCallback } from 'react';
import gitHubApi from '../../api/gitHubApi';

/**
 * Custom hook for managing GitHub repositories
 * Handles loading, syncing, and caching repository data
 */
export const useGitHubRepositories = () => {
  const [accountRepositories, setAccountRepositories] = useState({}); // Store repos by account ID
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadRepositories = useCallback(async (accountId) => {
    try {
      setLoading(true);
      setError('');
      const repositories = await gitHubApi.getRepositories(accountId);
      setAccountRepositories(prev => ({
        ...prev,
        [accountId]: repositories
      }));
    } catch (err) {
      setError('Failed to load repositories');
      console.error('Failed to load repositories:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const syncRepositories = useCallback(async (accountId) => {
    try {
      setLoading(true);
      setError('');
      await gitHubApi.syncRepositories(accountId);
      setSuccess('Repositories synced successfully');
      // Refresh repositories after sync
      await loadRepositories(accountId);
    } catch (err) {
      setError('Failed to sync repositories');
      console.error('Failed to sync repositories:', err);
    } finally {
      setLoading(false);
    }
  }, [loadRepositories]);

  const getRepositoriesForAccount = useCallback((accountId) => {
    return accountRepositories[accountId] || [];
  }, [accountRepositories]);

  const hasRepositoriesLoaded = useCallback((accountId) => {
    return Object.prototype.hasOwnProperty.call(accountRepositories, accountId);
  }, [accountRepositories]);

  const clearRepositoriesForAccount = useCallback((accountId) => {
    setAccountRepositories(prev => {
      const updated = { ...prev };
      delete updated[accountId];
      return updated;
    });
  }, []);

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  return {
    accountRepositories,
    loading,
    error,
    success,
    loadRepositories,
    syncRepositories,
    getRepositoriesForAccount,
    hasRepositoriesLoaded,
    clearRepositoriesForAccount,
    clearMessages
  };
};
