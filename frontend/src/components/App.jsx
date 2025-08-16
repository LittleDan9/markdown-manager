import React, { useState, useEffect, useRef, useCallback } from "react";
import Header from "./Header";
import Toolbar from "./toolbar/Toolbar";
import Editor from "./Editor";
import Renderer from "./Renderer";
import LogLevelController from "./LogLevelController";
import IconBrowser from "./IconBrowser";
import LoadingOverlay from "./LoadingOverlay";
import { Modal, Container, Alert, Card, Button } from "react-bootstrap";
import { ThemeProvider } from "../context/ThemeProvider";
import { useDocument } from "../context/DocumentProvider";
import { PreviewHTMLProvider } from "../context/PreviewHTMLContext";
import { useNotification } from "../components/NotificationProvider.jsx";
import DocumentService from "../services/DocumentService";
import DocumentStorageService from "../services/DocumentStorageService";

import { useAuth } from "../context/AuthContext";
import useAutoSave from "@/hooks/useAutoSave";

function App() {
  const { isAuthenticated, autosaveEnabled, setAutosaveEnabled, syncPreviewScrollEnabled, setSyncPreviewScrollEnabled, isInitializing } = useAuth();
  const { currentDocument, saveDocument, migrationStatus } = useDocument();
  const { content, setContent } = useDocument();
  const [renderedHTML, setRenderedHTML] = useState("");
  const [cursorLine, setCursorLine] = useState(1);
  const [fullscreenPreview, setFullscreenPreview] = useState(false);
  const [showIconBrowser, setShowIconBrowser] = useState(false);
  const { showError, showSuccess } = useNotification();

  // Shared document state
  const [isSharedView, setIsSharedView] = useState(false);
  const [sharedDocument, setSharedDocument] = useState(null);
  const [sharedLoading, setSharedLoading] = useState(false);
  const [sharedError, setSharedError] = useState(null);

  // Check if we're in shared document view
  useEffect(() => {
    const checkForSharedDocument = async () => {
      const path = window.location.pathname;
      const sharedMatch = path.match(/^\/shared\/([^/]+)$/);

      if (sharedMatch) {
        const shareToken = sharedMatch[1];
        // Clear any existing document data when viewing shared document
        DocumentStorageService.clearAllData();

        setIsSharedView(true);
        setFullscreenPreview(true); // Enable fullscreen preview for shared documents
        setSharedLoading(true);

        try {
          const document = await DocumentService.getSharedDocument(shareToken);
          setSharedDocument(document);
          setContent(document.content); // Load the shared content into the editor context
        } catch (error) {
          setSharedError('Failed to load shared document');
          console.error('Failed to load shared document:', error);
        } finally {
          setSharedLoading(false);
        }
      } else {
        // Reset shared state if not on a shared URL
        setIsSharedView(false);
        setSharedDocument(null);
        setSharedError(null);
      }
    };

    checkForSharedDocument();

    // Listen for URL changes (if using pushState/popState)
    window.addEventListener('popstate', checkForSharedDocument);

    // Clean up localStorage when leaving shared view (browser close, navigation, etc.)
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
  }, [isSharedView]); // Add isSharedView to dependencies

  const exitSharedView = () => {
    // Clear any document content that may have been loaded from shared view
    DocumentStorageService.clearAllData();
    setContent('');

    setIsSharedView(false);
    setSharedDocument(null);
    setSharedError(null);
    setFullscreenPreview(false);
    window.history.pushState({}, '', '/');
  };

  const runAutoSave = useCallback(async () => {
    // Don't autosave in shared view
    if (isSharedView) return;

    try {
      // Create document with current content for auto-save
      const docWithCurrentContent = { ...currentDocument, content };
      const savedDoc = await saveDocument(docWithCurrentContent, false); // Don't show notifications for auto-save

      // If the save was successful, the DocumentProvider will update the currentDocument
      // The useChangeTracker will then see that the saved content matches current content
      console.log('Auto-save completed successfully for:', savedDoc?.name);
    } catch (error) {
      console.warn("Auto-save failed:", error);
    }
  }, [saveDocument, currentDocument, content, isSharedView]);

  useAutoSave(currentDocument, content, runAutoSave, autosaveEnabled, 5000); // 5 seconds for testing

  useEffect(() => {
    // Don't sync content until auth is initialized
    if (isInitializing) return;

    // Sync content with currentDocument after document load/change
    // Only update if document actually changed to prevent render loops
    // BUT: Only sync if we're authenticated OR it's a safe local document
    if (currentDocument && currentDocument.content !== content) {
      // Check if this is a private document that shouldn't be shown without auth
      const isPrivateDocument = currentDocument.id &&
        !String(currentDocument.id).startsWith('doc_') &&
        currentDocument.content &&
        currentDocument.content.trim() !== '';

      // Only set content if authenticated OR it's not a private document
      if (isAuthenticated || !isPrivateDocument) {
        setContent(currentDocument.content ?? "");
      } else {
        // Clear content for private documents when not authenticated
        setContent("");
      }
    }
  }, [currentDocument.id, currentDocument.content, isAuthenticated, isInitializing]);
  // Capture Ctrl+S to save current content
  // Register Ctrl+S handler only once, always using latest state via refs
  const contentRef = useRef(content);
  const currentDocumentRef = useRef(currentDocument);
  const saveDocumentRef = useRef(saveDocument);
  const isAuthenticatedRef = useRef(isAuthenticated);
  const showSuccessRef = useRef(showSuccess);
  const showErrorRef = useRef(showError);

  useEffect(() => { contentRef.current = content; }, [content]);
  useEffect(() => { currentDocumentRef.current = currentDocument; }, [currentDocument]);
  useEffect(() => { saveDocumentRef.current = saveDocument; }, [saveDocument]);
  useEffect(() => { isAuthenticatedRef.current = isAuthenticated; }, [isAuthenticated]);
  useEffect(() => { showSuccessRef.current = showSuccess; }, [showSuccess]);
  useEffect(() => { showErrorRef.current = showError; }, [showError]);

  useEffect(() => {
    const handleKeyDown = async (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        console.log('Ctrl+S detected!'); // Debug log

        const content = contentRef.current;
        const currentDocument = currentDocumentRef.current;
        const saveDocument = saveDocumentRef.current;
        const isAuthenticated = isAuthenticatedRef.current;
        const showSuccess = showSuccessRef.current;
        const showError = showErrorRef.current;

        console.log('Save refs state:', {
          hasContent: !!content,
          hasDocument: !!currentDocument,
          hasSaveFunction: !!saveDocument,
          isAuthenticated,
          documentId: currentDocument?.id,
          contentLength: content?.length || 0
        });

        if (!currentDocument) {
          showError('No document to save.');
          return;
        }

        if (!saveDocument) {
          showError('Save function not available.');
          return;
        }

        // Always save if we have a document, even if content appears unchanged
        // because the user explicitly requested a save
        try {
          console.log('Starting save operation...');

          const saved = await saveDocument({ ...currentDocument, content }, true); // Show notifications

          console.log('Save operation completed:', { saved: !!saved });

          if (!saved) {
            showError('Save failed - no document returned.');
          }
          // Note: Success notifications are handled by DocumentService
        } catch (error) {
          console.error('Ctrl+S save error:', error);
          showError(`Save failed: ${error.message || 'Unknown error'}`);
        }
      }
    };

    console.log('Registering Ctrl+S handler'); // Debug log
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      console.log('Unregistering Ctrl+S handler'); // Debug log
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <ThemeProvider>
      <PreviewHTMLProvider>
        <div id="appRoot" className="app-root">
          <div id="container">
            <Header />

            <Toolbar
              setContent={setContent}
              editorValue={content}
              fullscreenPreview={fullscreenPreview}
              setFullscreenPreview={setFullscreenPreview}
              setShowIconBrowser={setShowIconBrowser}
              isSharedView={isSharedView}
              sharedDocument={sharedDocument}
              sharedLoading={sharedLoading}
              sharedError={sharedError}
            />
            <div id="main" className={fullscreenPreview ? "preview-full" : "split-view"}>
              {/* editor is always in the DOM, but width: 0 when closed or in shared view */}
              {!isSharedView && (
                <div className="editor-wrapper">
                  {!isInitializing ? (
                    <Editor
                      value={content}
                      onChange={setContent}
                      onCursorLineChange={setCursorLine}
                      categoryId={currentDocument?.category_id}
                      fullscreenPreview={fullscreenPreview}
                    />
                  ) : (
                    <div className="d-flex justify-content-center align-items-center h-100">
                      <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Initializing authentication...</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="renderer-wrapper">
                {/* Use the same renderer for both normal and shared views */}
                {(!isInitializing && !sharedLoading) ? (
                  isSharedView && !sharedDocument ? (
                    // Show error state for shared documents that failed to load
                    <Container className="py-4">
                      <Alert variant="danger">
                        <Alert.Heading>Unable to Load Document</Alert.Heading>
                        <p>The shared document could not be found or sharing has been disabled.</p>
                        <hr />
                        <div className="d-flex justify-content-end">
                          <Button
                            variant="outline-danger"
                            onClick={() => window.location.href = '/'}
                          >
                            Go to Main App
                          </Button>
                        </div>
                      </Alert>
                    </Container>
                  ) : (
                    // Standard renderer for both normal and shared views
                    <Renderer
                      content={content}
                      onRenderHTML={html => setRenderedHTML(html)}
                      scrollToLine={isSharedView ? null : (syncPreviewScrollEnabled ? cursorLine : null)}
                      fullscreenPreview={isSharedView ? true : fullscreenPreview}
                    />
                  )
                ) : (
                  // Loading state
                  <div className="d-flex justify-content-center align-items-center h-100">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">
                        {sharedLoading ? 'Loading shared document...' : 'Initializing authentication...'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Icon Browser Modal */}
        <Modal
          show={showIconBrowser}
          onHide={() => setShowIconBrowser(false)}
          size="xl"
          scrollable
          data-bs-theme={document.documentElement.getAttribute('data-bs-theme')}
        >
          <Modal.Header closeButton className="border-bottom">
            <Modal.Title>Icon Browser</Modal.Title>
          </Modal.Header>
          <Modal.Body style={{ minHeight: '70vh' }} className="p-0">
            <IconBrowser />
          </Modal.Body>
        </Modal>
      </PreviewHTMLProvider>
      <LogLevelController />

      {/* Migration Loading Overlay */}
      <LoadingOverlay
        show={migrationStatus === 'checking' || migrationStatus === 'migrating'}
        text={migrationStatus === 'checking' ? 'Checking for documents to migrate...' : 'Migrating your documents...'}
      />
    </ThemeProvider>
  );
}

export default App;
