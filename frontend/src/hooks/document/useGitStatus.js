import { useState, useEffect, useCallback, useRef } from 'react';
import documentsApi from '../../api/documentsApi';

/**
 * Custom hook for managing document git status
 * Prevents duplicate API calls and provides centralized git status management
 *
 * @param {number|string} documentId - The document ID to get git status for
 * @param {Object} document - The document object (optional, used to determine if GitHub or local)
 * @returns {Object} - Git status state and functions
 */
export const useGitStatus = (documentId, document = null) => {
  const [gitStatus, setGitStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Refs to prevent duplicate calls
  const lastFetchedDocumentRef = useRef(null);
  const lastFetchedTimeRef = useRef(0);
  const isFetchingRef = useRef(false);

  const fetchGitStatus = useCallback(async (forceRefresh = false) => {
    // Don't fetch for GitHub documents (GitStatusBar handles those separately)
    if (document?.github_repository_id) {
      setGitStatus(null);
      setLoading(false);
      setError(null);
      return;
    }

    if (!documentId || String(documentId).startsWith('doc_')) {
      setGitStatus(null);
      setLoading(false);
      setError(null);
      return;
    }

    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchedTimeRef.current;
    const isSameDocument = lastFetchedDocumentRef.current === documentId;

    // Prevent duplicate calls within 2 seconds unless forced
    if (!forceRefresh && isSameDocument && timeSinceLastFetch < 2000 && !isFetchingRef.current) {
      console.log('[useGitStatus] Skipping duplicate fetch', {
        documentId,
        timeSinceLastFetch,
        lastFetchedDocument: lastFetchedDocumentRef.current
      });
      return;
    }

    // Prevent concurrent fetches
    if (isFetchingRef.current) {
      console.log('[useGitStatus] Fetch already in progress, skipping');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      isFetchingRef.current = true;

      console.log('[useGitStatus] Fetching git status', { documentId, forceRefresh });

      const status = await documentsApi.getDocumentGitStatus(documentId);

      setGitStatus(status);
      lastFetchedDocumentRef.current = documentId;
      lastFetchedTimeRef.current = now;

    } catch (err) {
      console.error('[useGitStatus] Failed to fetch git status:', err);
      setError(err);
      setGitStatus(null);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [documentId, document]);

  // Auto-fetch when documentId or document changes
  useEffect(() => {
    fetchGitStatus();
  }, [fetchGitStatus]);

  // Manual refresh function
  const refreshGitStatus = useCallback(() => {
    fetchGitStatus(true);
  }, [fetchGitStatus]);

  return {
    gitStatus,
    loading,
    error,
    refreshGitStatus,
    hasChanges: gitStatus ? (
      gitStatus.has_uncommitted_changes ||
      gitStatus.has_staged_changes ||
      gitStatus.has_untracked_files
    ) : false
  };
};

export default useGitStatus;