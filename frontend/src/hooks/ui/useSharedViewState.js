import { useState, useCallback, useEffect } from 'react';
import { DocumentService } from '@/services/core';
import { DocumentStorageService } from '@/services/core';

export default function useSharedViewState() {
  const [isSharedView, setIsSharedView] = useState(false);
  const [sharedDocument, setSharedDocument] = useState(null);
  const [sharedLoading, setSharedLoading] = useState(false);
  const [sharedError, setSharedError] = useState(null);
  const [shareToken, setShareToken] = useState(null);

  const checkForSharedDocument = useCallback(async () => {
    const path = window.location.pathname;
    const sharedMatch = path.match(/^\/shared\/([^/]+)$/);
    if (sharedMatch) {
      const token = sharedMatch[1];
      if (!isSharedView || shareToken !== token) {
        DocumentStorageService.clearAllData();
        setIsSharedView(true);
        setShareToken(token);
        setSharedLoading(true);
        setSharedError(null);
        try {
          const document = await DocumentService.getSharedDocument(token);
          setSharedDocument(document);
        } catch (error) {
          setSharedError('Failed to load shared document');
          setSharedDocument(null);
        } finally {
          setSharedLoading(false);
        }
      }
    } else {
      if (isSharedView) {
        setIsSharedView(false);
        setSharedDocument(null);
        setSharedError(null);
        setShareToken(null);
      }
    }
  }, [isSharedView, shareToken]);

  const exitSharedView = useCallback(() => {
    DocumentStorageService.clearAllData();
    setIsSharedView(false);
    setSharedDocument(null);
    setSharedError(null);
    setShareToken(null);
    window.history.pushState({}, '', '/');
  }, []);

  useEffect(() => {
    checkForSharedDocument();
    window.addEventListener('popstate', checkForSharedDocument);
    const handleBeforeUnload = () => {
      if (isSharedView) {
        DocumentStorageService.clearAllData();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('popstate', checkForSharedDocument);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [checkForSharedDocument, isSharedView]);

  return {
    isSharedView,
    sharedDocument,
    sharedLoading,
    sharedError,
    shareToken,
    exitSharedView,
    checkForSharedDocument,
    setIsSharedView,
    setSharedDocument,
    setSharedLoading,
    setSharedError,
    setShareToken
  };
}
