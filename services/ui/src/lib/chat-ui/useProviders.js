/**
 * useProviders — Provider and model management hook.
 *
 * Manages API key listing, Ollama model discovery, and user preferences.
 */

import { useCallback, useEffect, useState } from 'react';

/**
 * @typedef {Object} ProviderKey
 * @property {string} id
 * @property {string} provider_type
 * @property {string} label
 * @property {string|null} preferred_model
 * @property {boolean} is_default
 * @property {boolean} is_system
 */

/**
 * @typedef {Object} ProvidersOptions
 * @property {string} apiBaseUrl
 * @property {string} appId
 * @property {() => string} getAuthToken
 */

/**
 * Hook for managing AI providers, models, and preferences.
 *
 * @param {ProvidersOptions} options
 */
export function useProviders({ apiBaseUrl = '', appId, getAuthToken }) {
  const [keys, setKeys] = useState([]);
  const [ollamaModels, setOllamaModels] = useState([]);
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(false);

  const _fetch = useCallback(async (path, options = {}) => {
    const token = getAuthToken();
    const resp = await fetch(`${apiBaseUrl}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      ...options,
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    if (resp.status === 204) return null;
    return resp.json();
  }, [apiBaseUrl, getAuthToken]);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      const data = await _fetch('/ai/keys');
      setKeys(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Failed to load keys:', err);
    } finally {
      setLoading(false);
    }
  }, [_fetch]);

  const loadOllamaModels = useCallback(async () => {
    try {
      const data = await _fetch('/ai/keys/ollama/models');
      setOllamaModels(data?.models || []);
    } catch { /* non-critical */ }
  }, [_fetch]);

  const loadPreferences = useCallback(async () => {
    try {
      const data = await _fetch('/ai/preferences');
      const prefs = data?.preferences?.find((p) => p.app_id === appId);
      setPreferences(prefs || null);
    } catch { /* non-critical */ }
  }, [_fetch, appId]);

  const savePreferences = useCallback(async (provider, model, keyId) => {
    try {
      const data = await _fetch('/ai/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          app_id: appId,
          preferred_provider: provider,
          preferred_model: model,
          preferred_key_id: keyId,
        }),
      });
      setPreferences(data);
    } catch (err) {
      console.warn('Failed to save preferences:', err);
    }
  }, [_fetch, appId]);

  // Load on mount
  useEffect(() => {
    loadKeys();
    loadOllamaModels();
    loadPreferences();
  }, [loadKeys, loadOllamaModels, loadPreferences]);

  // Derive selected provider/model from preferences or defaults
  const selectedProvider = preferences?.preferred_provider || 'ollama';
  const selectedModel = preferences?.preferred_model || null;
  const selectedKeyId = preferences?.preferred_key_id || null;

  return {
    keys,
    ollamaModels,
    preferences,
    selectedProvider,
    selectedModel,
    selectedKeyId,
    loading,
    loadKeys,
    loadOllamaModels,
    savePreferences,
  };
}
