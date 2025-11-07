import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createGitHubSettingsApi } from '../api/githubSettingsApi';
import { useAuth } from '../providers/AuthProvider';

const GitHubSettingsContext = createContext(null);

// Default settings - matches backend defaults
const DEFAULT_SETTINGS = {
  auto_convert_diagrams: false,
  diagram_format: 'svg',
  fallback_to_standard: true,
  auto_sync_enabled: true,
  default_commit_message: null,
  auto_push_enabled: false,
};

export function GitHubSettingsProvider({ children }) {
  const { isAuthenticated, isInitializing } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [githubSettingsApi] = useState(() => createGitHubSettingsApi());

  // Load settings from backend
  const loadSettings = useCallback(async (githubAccountId = null) => {
    try {
      setLoading(true);
      setError(null);

      const response = await githubSettingsApi.getSettings(githubAccountId);
      setSettings(response || DEFAULT_SETTINGS);
    } catch (err) {
      console.error('Failed to load GitHub settings:', err);
      // If settings don't exist, use defaults
      if (err?.response?.status === 404) {
        setSettings(DEFAULT_SETTINGS);
      } else {
        setError(err.message || 'Failed to load settings');
      }
    } finally {
      setLoading(false);
    }
  }, [githubSettingsApi]);

  // Update settings
  const updateSettings = useCallback(async (newSettings, githubAccountId = null) => {
    try {
      setError(null);

      const response = await githubSettingsApi.updateSettings(newSettings, githubAccountId);
      setSettings(response);
      return response;
    } catch (err) {
      console.error('Failed to update GitHub settings:', err);
      setError(err.message || 'Failed to update settings');
      throw err;
    }
  }, [githubSettingsApi]);

  // Get or create settings with defaults
  const getOrCreateSettings = useCallback(async (githubAccountId = null) => {
    try {
      setLoading(true);
      setError(null);

      const response = await githubSettingsApi.getOrCreateSettings(githubAccountId);
      setSettings(response);
      return response;
    } catch (err) {
      console.error('Failed to get or create GitHub settings:', err);
      setError(err.message || 'Failed to initialize settings');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [githubSettingsApi]);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  // Load settings on mount - only if authenticated
  useEffect(() => {
    // Don't load settings if still initializing or not authenticated
    if (isInitializing || !isAuthenticated) {
      setLoading(false); // Not loading if not authenticated
      return;
    }

    loadSettings();
  }, [loadSettings, isAuthenticated, isInitializing]);

  const value = {
    settings,
    loading,
    error,
    loadSettings,
    updateSettings,
    getOrCreateSettings,
    resetToDefaults,
    DEFAULT_SETTINGS,
    isAuthenticated,
    isInitializing,
  };

  return (
    <GitHubSettingsContext.Provider value={value}>
      {children}
    </GitHubSettingsContext.Provider>
  );
}

export function useGitHubSettings() {
  const context = useContext(GitHubSettingsContext);
  if (!context) {
    throw new Error('useGitHubSettings must be used within a GitHubSettingsProvider');
  }
  return context;
}