import { useState, useEffect, useCallback } from "react";
import platformAiApi from "@/api/platformAiApi";

/**
 * Hook for managing AI provider/model preferences via Platform AI.
 * Replaces any local state model selection with server-persisted preferences.
 */
export default function useAIPreferences() {
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await platformAiApi.getPreferences();
      const prefs = data?.preferences?.[0] || null;
      setPreferences(prefs);
    } catch (err) {
      setError(err.message || "Failed to load preferences");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async ({ preferred_provider, preferred_model, preferred_key_id }) => {
    setError(null);
    try {
      const data = await platformAiApi.savePreferences({
        preferred_provider,
        preferred_model,
        preferred_key_id,
      });
      setPreferences(data);
      return data;
    } catch (err) {
      setError(err.message || "Failed to save preferences");
      throw err;
    }
  }, []);

  return {
    preferences,
    loading,
    error,
    reload: load,
    savePreferences: save,
    preferredProvider: preferences?.preferred_provider || null,
    preferredModel: preferences?.preferred_model || null,
    preferredKeyId: preferences?.preferred_key_id || null,
  };
}
