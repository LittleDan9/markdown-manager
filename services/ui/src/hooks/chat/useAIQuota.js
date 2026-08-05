import { useState, useEffect, useCallback } from "react";
import platformAiApi from "@/api/platformAiApi";

/**
 * Hook for checking AI usage quota from Platform AI.
 * Returns current usage, limits, and whether the user is over quota.
 */
export default function useAIQuota() {
  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await platformAiApi.getQuota();
      setQuota(data);
    } catch (err) {
      // 503 means platform AI not configured — not a user error
      if (err.status === 503 || err.message?.includes("503")) {
        setQuota(null);
      } else {
        setError(err.message || "Failed to load quota");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return {
    quota,
    loading,
    error,
    reload: load,
    used: quota?.daily_tokens_used ?? 0,
    limit: quota?.daily_token_limit ?? 0,
    resetAt: quota?.reset_at ?? null,
    isOverQuota: quota ? quota.daily_tokens_used >= quota.daily_token_limit : false,
  };
}
