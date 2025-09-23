import React, { useEffect } from "react";
import Header from "@/components/Header";
import Toolbar from "@/components/toolbar/Toolbar";
import LogLevelController from "@/components/LogLevelController";
import { useDocumentContext } from "@/providers/DocumentContextProvider.jsx";
import { useAuth } from "@/providers/AuthProvider";
import { useGlobalKeyboardShortcuts, useDocumentAutoSave, useAppUIState, useSharedViewEffects, useGitHubOAuth } from "@/hooks";
import AppLayout from "@/components/layout/AppLayout";
import EditorSection from "@/components/sections/EditorSection";
import RendererSection from "@/components/sections/RendererSection";
import AppModals from "@/components/shared/modals/AppModals";

function App() {
  const { isAuthenticated, autosaveEnabled, syncPreviewScrollEnabled, isInitializing } = useAuth();
  const { currentDocument, saveDocument, migrationStatus, content, setContent, isSharedView, sharedDocument, sharedLoading, sharedError, loading, saving } = useDocumentContext();

  // Handle GitHub OAuth results from URL parameters (fallback for popup failures)
  useGitHubOAuth();

  // UI state management via custom hook
  const uiState = useAppUIState(isSharedView);
  const {
    renderedHTML,
    cursorLine,
    fullscreenPreview,
    showIconBrowser,
    setRenderedHTML,
    setCursorLine,
    setFullscreenPreview,
    setShowIconBrowser,
  } = uiState;

  // Setup global keyboard shortcuts (Ctrl+S, etc.)
  useGlobalKeyboardShortcuts();

  // Debug fullscreen state changes
  useEffect(() => {
    console.log('App: fullscreenPreview changed to:', fullscreenPreview);
  }, [fullscreenPreview]);

  // Setup auto-save management (30 seconds delay, only when content changes)
  useDocumentAutoSave(currentDocument, content, saveDocument, autosaveEnabled, isSharedView, 30000);

  // Handle shared view effects
  useSharedViewEffects(isSharedView, sharedDocument, content, setContent, setFullscreenPreview);

  return (
    <>
      <AppLayout
        header={<Header />}
        toolbar={
          <Toolbar
            setContent={setContent}
            editorValue={content}
            fullscreenPreview={fullscreenPreview}
            setFullscreenPreview={setFullscreenPreview}
            setShowIconBrowser={setShowIconBrowser}
          />
        }
        editorSection={
          <EditorSection
            isSharedView={isSharedView}
            isInitializing={isInitializing}
            content={content}
            onContentChange={setContent}
            onCursorLineChange={setCursorLine}
            currentDocument={currentDocument}
            fullscreenPreview={fullscreenPreview}
          />
        }
        rendererSection={
          <RendererSection
            content={content}
            onRenderHTML={html => setRenderedHTML(html)}
            isSharedView={isSharedView}
            sharedDocument={sharedDocument}
            sharedLoading={sharedLoading}
            isInitializing={isInitializing}
            documentLoading={loading}
            syncPreviewScrollEnabled={syncPreviewScrollEnabled}
            cursorLine={cursorLine}
            fullscreenPreview={fullscreenPreview}
          />
        }
        fullscreenPreview={fullscreenPreview}
      />

      <AppModals
        showIconBrowser={showIconBrowser}
        onHideIconBrowser={() => setShowIconBrowser(false)}
        migrationStatus={migrationStatus}
      />

      <LogLevelController />
    </>
  );
}

export default App;
