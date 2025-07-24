import { useEffect, useCallback, useRef } from 'react';
import DocumentStorage from '../storage/DocumentStorage';

export default function useSyncDocuments({
  isAuthenticated,
  token,
  notification,
  setDocuments,
  setCategories,
  setLoading,
  setError,
}) {
  const autosaveRef = useRef(true);

  const syncAndMerge = useCallback(async () => {
    setLoading(true);
    try {
      if (window.setAutosaveEnabled) {
        autosaveRef.current = window.getAutosaveEnabled?.() ?? true;
        window.setAutosaveEnabled(false);
      }
      let result;
      try {
        result = await DocumentStorage.syncAndMergeDocuments(isAuthenticated, token);
      } catch (e) {
        if (e?.message?.toLowerCase().includes('user')) {
          notification?.showWarning(
            'Unable to fetch user profile. Offline mode active.',
            8000
          );
        }
        result = { conflicts: [], docs: DocumentStorage.getAllDocuments() };
      }
      setDocuments(DocumentStorage.getAllDocuments());
      setCategories(DocumentStorage.getCategories());
      if (result.conflicts?.length) {
        window.dispatchEvent(new CustomEvent('showRecoveryModal', { detail: result.conflicts }));
      }
    } catch {
      setError('Sync/merge failed');
    } finally {
      setLoading(false);
      if (window.setAutosaveEnabled && autosaveRef.current) {
        window.setAutosaveEnabled(true);
      }
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    if (!isAuthenticated) return;
    syncAndMerge();
    const id = setInterval(syncAndMerge, 180000);
    return () => clearInterval(id);
  }, [isAuthenticated, syncAndMerge]);

  return syncAndMerge;
}
