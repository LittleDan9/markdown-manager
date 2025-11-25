import { useState, useEffect, useCallback } from 'react';
import gitHubApi from '../../api/gitHubApi';

/**
 * Custom hook for managing GitHub accounts
 * Handles loading, connecting, and disconnecting GitHub accounts
 */
export const useGitHubAccounts = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadAccounts = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const accounts = await gitHubApi.getAccounts();
      setAccounts(accounts);
    } catch (err) {
      setError('Failed to load GitHub accounts');
      console.error('Failed to load GitHub accounts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const connectAccount = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const { authorization_url } = await gitHubApi.getAuthUrl();

      // Open GitHub OAuth in a new window
      const popup = window.open(
        authorization_url,
        'github-oauth',
        'width=600,height=600,scrollbars=yes,resizable=yes'
      );

      // Check when popup closes
      const checkClosed = setInterval(async () => {
        if (popup.closed) {
          clearInterval(checkClosed);

          // Give a moment for the backend to process, then refresh accounts
          setTimeout(async () => {
            try {
              await loadAccounts();
              setSuccess('GitHub account connected successfully!');
            } catch (err) {
              setError('Failed to verify GitHub connection. Please try again.');
              console.error('Failed to load accounts after OAuth:', err);
            }
            setLoading(false);
          }, 1000);
        }
      }, 1000);

      // Cleanup if the popup is closed manually
      const _cleanupTimer = setTimeout(() => {
        clearInterval(checkClosed);
        setLoading(false);
      }, 300000); // 5 minutes timeout

    } catch (err) {
      setError('Failed to connect to GitHub');
      console.error('Failed to initiate GitHub OAuth:', err);
      setLoading(false);
    }
  }, [loadAccounts]);

  const disconnectAccount = useCallback(async (accountId) => {
    try {
      setLoading(true);
      setError('');
      await gitHubApi.disconnectAccount(accountId);
      setSuccess('GitHub account disconnected');
      await loadAccounts();
    } catch (err) {
      setError('Failed to disconnect GitHub account');
      console.error('Failed to disconnect GitHub account:', err);
    } finally {
      setLoading(false);
    }
  }, [loadAccounts]);

  const clearMessages = useCallback(() => {
    setError('');
    setSuccess('');
  }, []);

  // Load accounts on mount
  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  return {
    accounts,
    loading,
    error,
    success,
    loadAccounts,
    connectAccount,
    disconnectAccount,
    clearMessages
  };
};
