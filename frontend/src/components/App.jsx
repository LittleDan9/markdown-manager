import React, { useEffect } from "react";
import Header from "@/components/Header";
import Toolbar from "@/components/toolbar/Toolbar";
import LogLevelController from "@/components/LogLevelController";
import { useDocumentContext } from "@/providers/DocumentContextProvider.jsx";
import { useAuth } from "@/providers/AuthProvider";
import { useGlobalKeyboardShortcuts, useDocumentAutoSave, useSharedViewEffects, useGitHubOAuth } from "@/hooks";
import AppLayout from "@/components/layout/AppLayout";
import SharedViewLayout from "@/components/layout/SharedViewLayout";
import EditorSection from "@/components/sections/EditorSection";
import RendererSection from "@/components/sections/RendererSection";
import AppModals from "@/components/shared/modals/AppModals";

function App() {
  const { autosaveEnabled, syncPreviewScrollEnabled, isInitializing } = useAuth();
  const { currentDocument, saveDocument, migrationStatus, content, isSharedView, sharedDocument, sharedLoading, loading, triggerContentUpdate, cursorLine, fullscreenPreview, setFullscreenPreview, showIconBrowser, setShowIconBrowser } = useDocumentContext();

  // Handle GitHub OAuth results from URL parameters (fallback for popup failures)
  useGitHubOAuth();

  // Setup global keyboard shortcuts (Ctrl+S, etc.)
  useGlobalKeyboardShortcuts();

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
        />
      )}

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
