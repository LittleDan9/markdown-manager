import React from "react";
import Header from "@/components/Header";
import Toolbar from "@/components/toolbar/Toolbar";
import LogLevelController from "@/components/LogLevelController";
import { useDocumentContext } from "@/providers/DocumentContextProvider.jsx";
import { useAuth } from "@/providers/AuthProvider";
import { useGlobalKeyboardShortcuts } from "@/hooks/editor";
import { useDocumentAutoSave } from "@/hooks/document";
import { useAppUIState, useSharedViewEffects } from "@/hooks/ui";
import AppLayout from "@/components/layout/AppLayout";
import EditorSection from "@/components/sections/EditorSection";
import RendererSection from "@/components/sections/RendererSection";
import AppModals from "@/components/modals/AppModals";

function App() {
  const { isAuthenticated, autosaveEnabled, syncPreviewScrollEnabled, isInitializing } = useAuth();
  const { currentDocument, saveDocument, migrationStatus, content, setContent, isSharedView, sharedDocument, sharedLoading, sharedError } = useDocumentContext();

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
