import { useEffect, useCallback, useRef } from 'react';
import DocumentManager from '../storage/DocumentManager';

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
  const syncAndMergeRef = useRef();

  const syncAndMerge = useCallback(async () => {
    // Don't sync if not authenticated
    if (!isAuthenticated) {
      return;
    }

    setLoading(true);
    try {
      if (window.setAutosaveEnabled) {
        autosaveRef.current = window.getAutosaveEnabled?.() ?? true;
        window.setAutosaveEnabled(false);
      }
      let result;
      try {
        result = await DocumentManager.triggerFullSync();
        if (!result) {
          throw new Error('Sync failed');
        }
      } catch (e) {
        // Handle authentication errors gracefully
        if (e?.response?.status === 403 || e?.message?.includes('authentication')) {
          console.error('Authentication error during sync, user may have been logged out');
          return; // Exit early, don't show error
        }

        if (e?.message?.toLowerCase().includes('user')) {
          notification?.showWarning(
            'Unable to fetch user profile. Offline mode active.',
            8000
          );
        }
        result = { conflicts: [], docs: DocumentManager.getAllDocuments() };
      }
      const docs = DocumentManager.getAllDocuments();
      const cats = DocumentManager.getCategories();
      if (typeof window !== 'undefined') {
        window._lastDocs = window._lastDocs || [];
        window._lastDocs = docs;
      }
      setDocuments(docs);

      if (typeof window !== 'undefined') {
        window._lastCats = window._lastCats || [];
        window._lastCats = cats;
      }
      setCategories(cats);
      if (result.conflicts?.length) {
        window.dispatchEvent(new CustomEvent('showRecoveryModal', { detail: result.conflicts }));
      }
    } catch (error) {
      // Only show error if we're still authenticated
      if (isAuthenticated) {
        setError('Sync/merge failed');
      }
    } finally {
      setLoading(false);
      if (window.setAutosaveEnabled && autosaveRef.current) {
        window.setAutosaveEnabled(true);
      }
    }
  }, [isAuthenticated, token, notification, setDocuments, setCategories, setLoading, setError]);

  // Keep the ref updated with the latest syncAndMerge function
  syncAndMergeRef.current = syncAndMerge;

  useEffect(() => {
    if (!isAuthenticated) return;

    // Call syncAndMerge immediately
    syncAndMerge();

    // Set up interval using ref to avoid dependency issues
    const id = setInterval(() => {
      syncAndMergeRef.current?.();
    }, 180000);

    return () => clearInterval(id);
  }, [isAuthenticated]); // Remove syncAndMerge from dependencies to prevent infinite loop

  return syncAndMerge;
}
