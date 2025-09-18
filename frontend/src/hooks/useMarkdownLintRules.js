import { useState, useCallback } from 'react';
import lintingApi from '../api/lintingApi';
import { useAuth } from '@/providers/AuthProvider';

/**
 * Hook for managing markdown lint rules
 * Clean, simple implementation using the new lintingApi
 */
export function useMarkdownLintRules() {
  const { user } = useAuth();
  const userId = user?.id;

  const [rules, setRules] = useState({});
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Load user configuration (with fallback to recommended defaults)
   */
  const loadRules = useCallback(async () => {
    if (!userId) {
      setRules({});
      setEnabled(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const userConfig = await lintingApi.getUserConfig();

      if (userConfig === null) {
        // User has no configuration, load recommended defaults
        console.log('useMarkdownLintRules: No user config, loading recommended defaults');
        const recommendedRules = await lintingApi.getRecommendedDefaults();
        setRules(recommendedRules || {});
        setEnabled(true);
      } else {
        // User has configuration
        console.log('useMarkdownLintRules: Loaded user config:', userConfig);
        setRules(userConfig.rules || {});
        setEnabled(userConfig.enabled !== false);
      }
    } catch (err) {
      console.error('Failed to load lint rules:', err);
      setError(err.message || 'Failed to load rules');
      setRules({});
      setEnabled(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  /**
   * Save user configuration
   */
  const saveRules = useCallback(async (newRules, newEnabled = true, description = null) => {
    if (!userId) {
      throw new Error('User must be authenticated to save rules');
    }

    setLoading(true);
    setError(null);

    try {
      const savedConfig = await lintingApi.saveUserConfig(newRules, description, newEnabled);
      console.log('useMarkdownLintRules: Saved config:', savedConfig);

      setRules(savedConfig?.rules || {});
      setEnabled(savedConfig?.enabled !== false);
    } catch (err) {
      console.error('Failed to save lint rules:', err);
      setError(err.message || 'Failed to save rules');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  /**
   * Reset to recommended defaults
   */
  const resetToDefaults = useCallback(async () => {
    if (!userId) {
      throw new Error('User must be authenticated to reset rules');
    }

    setLoading(true);
    setError(null);

    try {
      // Delete user configuration first
      await lintingApi.deleteUserConfig();

      // Load recommended defaults
      const recommendedRules = await lintingApi.getRecommendedDefaults();
      console.log('useMarkdownLintRules: Reset to defaults:', recommendedRules);

      setRules(recommendedRules || {});
      setEnabled(true);
    } catch (err) {
      console.error('Failed to reset to defaults:', err);
      setError(err.message || 'Failed to reset to defaults');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  /**
   * Get rule definitions
   */
  const getRuleDefinitions = useCallback(async () => {
    try {
      return await lintingApi.getRuleDefinitions();
    } catch (err) {
      console.warn('Failed to load rule definitions:', err);
      return {};
    }
  }, []);

  /**
   * Validate rule configuration
   */
  const validateRules = useCallback((rulesToValidate) => {
    if (!rulesToValidate || typeof rulesToValidate !== 'object') {
      return { valid: false, errors: ['Rules must be an object'] };
    }

    const errors = [];
    const validRulePattern = /^MD\d{3}$/;

    Object.entries(rulesToValidate).forEach(([ruleId, value]) => {
      if (!validRulePattern.test(ruleId)) {
        errors.push(`Invalid rule ID: ${ruleId}`);
      }
      if (value !== true && value !== false && typeof value !== 'object') {
        errors.push(`Invalid value for rule ${ruleId}: ${value}`);
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }, []);

  return {
    // State
    rules,
    enabled,
    loading,
    error,

    // Actions
    loadRules,
    saveRules,
    resetToDefaults,

    // Utilities
    getRuleDefinitions,
    validateRules
  };
}

export default useMarkdownLintRules;