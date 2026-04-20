import React, { useEffect, useRef, useCallback, useState } from "react";
import Header from "@/components/Header";
import Toolbar from "@/components/toolbar/Toolbar";

import { useDocumentContext } from "@/providers/DocumentContextProvider.jsx";
import { useAuth } from "@/providers/AuthProvider";
import { useGlobalKeyboardShortcuts, useDocumentAutoSave, useSharedViewEffects, useGitHubOAuth, useVersionCheck } from "@/hooks";
import AppLayout from "@/components/layout/AppLayout";
import SharedViewLayout from "@/components/layout/SharedViewLayout";
import EditorSection from "@/components/sections/EditorSection";
import RendererSection from "@/components/sections/RendererSection";
import AppModals from "@/components/shared/modals/AppModals";
import ChatDrawer from "@/components/chat/ChatDrawer";
import HelpModal from "@/components/help/HelpModal";
import GuidedTour from "@/components/help/GuidedTour";
import PromoteDraftModal from "@/components/document/modals/PromoteDraftModal";
import { markDraftAcknowledged } from "@/hooks/document/useSaveDocument";

function App() {
  const { autosaveEnabled, syncPreviewScrollEnabled, isInitializing } = useAuth();
  const { currentDocument, saveDocument, migrationStatus, content, isSharedView, sharedDocument, sharedLoading, loading, triggerContentUpdate, cursorLine, fullscreenPreview, setFullscreenPreview, showIconBrowser, setShowIconBrowser, showChatDrawer, setShowChatDrawer, showHelpModal, setShowHelpModal, showGuidedTour, setShowGuidedTour, createDocument } = useDocumentContext();

  // --- Draft promotion modal state ---
  const [showPromoteDraft, setShowPromoteDraft] = useState(false);
  const promoteDraftRef = useRef({ doc: null, content: '', saveFn: null });

  const handleDraftPromote = useCallback((doc, docContent, saveFn) => {
    promoteDraftRef.current = { doc, content: docContent, saveFn };
    setShowPromoteDraft(true);
  }, []);

  const handlePromoteConfirm = useCallback(async (category, name) => {
    const { doc, content: docContent, saveFn } = promoteDraftRef.current;
    if (!doc || !saveFn) return;

    const updatedDoc = { ...doc, name, category, content: docContent };
    setShowPromoteDraft(false);

    // If user chose to keep in Drafts, mark as acknowledged so we don't re-prompt
    if (category === 'Drafts') {
      markDraftAcknowledged(doc.id);
    }

    await saveFn(updatedDoc, true);
  }, []);

  const handlePromoteHide = useCallback(() => {
    setShowPromoteDraft(false);
  }, []);

  // Track previous document ID so we can trigger a session commit on switch
  const prevDocIdRef = useRef(null);

  // Fire-and-forget session commit for a local document
  const triggerSessionCommit = useCallback(async (documentId) => {
    if (!documentId) return;
    try {
      const { default: documentsApi } = await import('@/api/documentsApi');
      await documentsApi.sessionCommit(documentId);
    } catch (_err) {
      // Non-fatal: session commit is best-effort
    }
  }, []);

  // Session commit on document switch
  useEffect(() => {
    const prevId = prevDocIdRef.current;
    const newId = currentDocument?.id ?? null;

    if (prevId && prevId !== newId) {
      triggerSessionCommit(prevId);
    }

    prevDocIdRef.current = newId;
  }, [currentDocument?.id, triggerSessionCommit]);

  // Session commit on page/tab close
  useEffect(() => {
    const handleBeforeUnload = () => {
      const docId = prevDocIdRef.current;
      if (!docId) return;
      const token = localStorage.getItem('authToken');
      try {
        fetch(`/api/documents/${docId}/git/session-commit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: '{}',
          keepalive: true,
        });
      } catch (_err) {
        // Browser may reject keepalive fetch; ignore silently
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Handle GitHub OAuth results from URL parameters (fallback for popup failures)
  useGitHubOAuth();

  // Check for new deployments and prompt user to refresh
  useVersionCheck();

  // Setup global keyboard shortcuts (Ctrl+S, Ctrl+Alt+N, etc.)
  useGlobalKeyboardShortcuts({ onDraftPromote: handleDraftPromote, onNewDocument: createDocument });

  // Debug fullscreen state changes
  useEffect(() => {
    console.log('App: fullscreenPreview changed to:', fullscreenPreview);
  }, [fullscreenPreview]);

  // Setup auto-save management (30 seconds delay, only when content changes)
  useDocumentAutoSave(currentDocument, content, saveDocument, autosaveEnabled, isSharedView, 30000);

  // Handle shared view effects (no longer sets fullscreen in shared view)
  useSharedViewEffects(isSharedView, sharedDocument, content, triggerContentUpdate);

  // Shared components
  const headerComponent = <Header />;
  const toolbarComponent = (
    <Toolbar
      setContent={triggerContentUpdate}
      editorValue={content}
      fullscreenPreview={fullscreenPreview}
      setFullscreenPreview={setFullscreenPreview}
      setShowIconBrowser={setShowIconBrowser}
    />
  );
  const rendererComponent = (
    <RendererSection
      isSharedView={isSharedView}
      sharedDocument={sharedDocument}
      sharedLoading={sharedLoading}
      isInitializing={isInitializing}
      documentLoading={loading}
      syncPreviewScrollEnabled={syncPreviewScrollEnabled}
      cursorLine={cursorLine}
      fullscreenPreview={fullscreenPreview}
    />
  );

  return (
    <>
      {isSharedView ? (
        // Dedicated shared view layout
        <SharedViewLayout
          header={headerComponent}
          toolbar={toolbarComponent}
          rendererSection={rendererComponent}
        />
      ) : (
        // Normal app layout with editor and preview
        <AppLayout
          header={headerComponent}
          toolbar={toolbarComponent}
          editorSection={
            <EditorSection
              isSharedView={isSharedView}
              isInitializing={isInitializing}
              currentDocument={currentDocument}
              fullscreenPreview={fullscreenPreview}
            />
          }
          rendererSection={rendererComponent}
          fullscreenPreview={fullscreenPreview}
          isSharedView={isSharedView}
        />
      )}

      <AppModals
        showIconBrowser={showIconBrowser}
        onHideIconBrowser={() => setShowIconBrowser(false)}
        migrationStatus={migrationStatus}
      />

      <ChatDrawer
        show={showChatDrawer}
        onHide={() => setShowChatDrawer(false)}
      />

      <PromoteDraftModal
        show={showPromoteDraft}
        onHide={handlePromoteHide}
        defaultName={promoteDraftRef.current.doc?.name || 'Untitled Document'}
        onConfirm={handlePromoteConfirm}
      />

      <HelpModal
        show={showHelpModal}
        onHide={() => setShowHelpModal(false)}
      />

      <GuidedTour
        run={showGuidedTour}
        onFinish={() => setShowGuidedTour(false)}
      />
    </>
  );
}

export default App;
