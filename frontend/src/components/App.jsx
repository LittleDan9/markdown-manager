import React from "react";
import Header from "./Header";
import Toolbar from "./toolbar/Toolbar";
import LogLevelController from "./LogLevelController";
import { ThemeProvider } from "../context/ThemeProvider";
import { useDocument } from "../context/DocumentProvider";
import { PreviewHTMLProvider } from "../context/PreviewHTMLContext";
import { useSharedView } from "../context/SharedViewProvider";
import { useAuth } from "../context/AuthContext";
import useGlobalKeyboardShortcuts from "@/hooks/useGlobalKeyboardShortcuts";
import useAutoSaveManager from "@/hooks/useAutoSaveManager";
import useAppUIState from "@/hooks/useAppUIState";
import useSharedViewEffects from "@/hooks/useSharedViewEffects";

// Import our new components
import AppLayout from "./layout/AppLayout";
import EditorSection from "./sections/EditorSection";
import RendererSection from "./sections/RendererSection";
import AppModals from "./modals/AppModals";

function AppContent() {
  const { isAuthenticated, autosaveEnabled, syncPreviewScrollEnabled, isInitializing } = useAuth();
  const { currentDocument, saveDocument, migrationStatus } = useDocument();
  const { content, setContent } = useDocument();
  const { isSharedView, sharedDocument, sharedLoading, sharedError } = useSharedView();
  
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

  // Setup auto-save management
  useAutoSaveManager(currentDocument, content, saveDocument, autosaveEnabled, isSharedView, 5000);

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
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <PreviewHTMLProvider>
        <AppContent />
        <LogLevelController />
      </PreviewHTMLProvider>
    </ThemeProvider>
  );
}

export default App;
