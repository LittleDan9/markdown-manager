import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from './AuthProvider';
import UserAPI from '@/api/userApi';

/**
 * UserSettingsProvider - Manages user-specific UI settings
 * Handles editor layout preferences and other user customizations
 */

const UserSettingsContext = createContext(null);

export function UserSettingsProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [settings, setSettings] = useState({
    editorWidthPercentage: 40, // Default 40% editor width
    isLoading: true,
    error: null
  });

  // Local storage key for editor width
  const EDITOR_WIDTH_KEY = 'markdown-manager-editor-width';

  // Load settings from localStorage
  const loadFromLocalStorage = useCallback(() => {
    try {
      const stored = localStorage.getItem('editor-width');
      if (stored !== null) {
        const parsed = parseFloat(stored);
        if (!isNaN(parsed) && parsed >= 20 && parsed <= 80) {
          return parsed;
        }
      }
    } catch (error) {
      console.warn('Failed to load editor width from localStorage:', error);
    }
    return 50; // Default value
  }, []);

  // Save settings to localStorage
  const saveToLocalStorage = useCallback((value) => {
    try {
      localStorage.setItem('editor-width', value.toString());
    } catch (error) {
      console.warn('Failed to save editor width to localStorage:', error);
    }
  }, []);

  // Load user settings when authentication state changes
  useEffect(() => {
    const loadSettings = () => {
      setSettings(prev => ({ ...prev, isLoading: true, error: null }));

      let editorWidth = 40; // Default

      if (isAuthenticated && user?.editor_width_percentage !== undefined) {
        // For authenticated users, prefer backend setting
        editorWidth = user.editor_width_percentage;
        // Also save to localStorage to maintain consistency
        saveToLocalStorage(editorWidth);
      } else {
        // For non-authenticated users or when backend setting is unavailable,
        // load from localStorage
        editorWidth = loadFromLocalStorage();
      }

      setSettings({
        editorWidthPercentage: editorWidth,
        isLoading: false,
        error: null
      });
    };

    loadSettings();
  }, [isAuthenticated, user, loadFromLocalStorage, saveToLocalStorage]);

  // Load settings from user profile
  const loadUserSettings = useCallback(async () => {
    try {
      setSettings(prev => ({ ...prev, isLoading: true, error: null }));

      let editorWidth = 40; // Default

      if (isAuthenticated && user?.editor_width_percentage !== undefined) {
        editorWidth = user.editor_width_percentage;
        // Sync with localStorage
        saveToLocalStorage(editorWidth);
      } else {
        // Load from localStorage
        editorWidth = loadFromLocalStorage();
      }

      setSettings({
        editorWidthPercentage: editorWidth,
        isLoading: false,
        error: null
      });
    } catch (error) {
      console.error('Failed to load user settings:', error);
      setSettings(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to load settings'
      }));
    }
  }, [user, isAuthenticated, loadFromLocalStorage, saveToLocalStorage]);

  // Update editor width percentage
  const updateEditorWidth = useCallback(async (widthPercentage) => {
    try {
      // Validate input
      const clampedWidth = Math.max(10, Math.min(90, Math.round(widthPercentage)));

      // Always update local state immediately
      setSettings(prev => ({
        ...prev,
        editorWidthPercentage: clampedWidth
      }));

      // Always save to localStorage for persistence
      saveToLocalStorage(clampedWidth);

      // Dispatch custom event for components that need to react to width changes
      window.dispatchEvent(new CustomEvent('editor-width-changed', {
        detail: { width: clampedWidth }
      }));

      // If authenticated, also save to backend
      if (isAuthenticated && user) {
        try {
          await UserAPI.updateProfileInfo({
            editor_width_percentage: clampedWidth
          });
          console.log('Editor width updated to backend:', clampedWidth);
        } catch (backendError) {
          console.warn('Failed to save editor width to backend, but localStorage saved:', backendError);
          // Don't revert since localStorage save succeeded
        }
      }

      console.log('Editor width updated to:', clampedWidth);

    } catch (error) {
      console.error('Failed to update editor width:', error);

      // Try to revert to last known good value
      const fallbackWidth = isAuthenticated && user?.editor_width_percentage
        ? user.editor_width_percentage
        : loadFromLocalStorage();

      setSettings(prev => ({
        ...prev,
        editorWidthPercentage: fallbackWidth,
        error: 'Failed to save settings'
      }));
    }
  }, [isAuthenticated, user, saveToLocalStorage, loadFromLocalStorage]);

  // Reset settings to defaults
  const resetSettings = useCallback(async () => {
    try {
      // Reset to default (40%)
      await updateEditorWidth(40);

      // Clear any error state
      setSettings(prev => ({
        ...prev,
        error: null
      }));
    } catch (error) {
      console.error('Failed to reset settings:', error);
    }
  }, [updateEditorWidth]);

  // Clear localStorage settings (useful for logout or reset)
  const clearLocalStorage = useCallback(() => {
    try {
      localStorage.removeItem(EDITOR_WIDTH_KEY);
      console.log('Editor width cleared from localStorage');
    } catch (error) {
      console.warn('Failed to clear editor width from localStorage:', error);
    }
  }, []);

  const value = {
    // Current settings
    editorWidthPercentage: settings.editorWidthPercentage,
    previewWidthPercentage: 100 - settings.editorWidthPercentage,
    isLoading: settings.isLoading,
    error: settings.error,

    // Actions
    updateEditorWidth,
    resetSettings,
    loadUserSettings,
    clearLocalStorage,

    // Computed helpers
    isCustomized: settings.editorWidthPercentage !== 40,
    isStoredLocally: !isAuthenticated, // Indicates if settings are stored in localStorage only
    storageSource: isAuthenticated && user ? 'backend' : 'localStorage', // Where settings are primarily stored
  };

  return (
    <UserSettingsContext.Provider value={value}>
      {children}
    </UserSettingsContext.Provider>
  );
}

UserSettingsProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

/**
 * Hook to access user settings context
 */
export function useUserSettings() {
  const context = useContext(UserSettingsContext);

  if (!context) {
    throw new Error('useUserSettings must be used within a UserSettingsProvider');
  }

  return context;
}

export default UserSettingsProvider;