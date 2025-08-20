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
import { useSharedView } from "../context/SharedViewProvider";
import { useNotification } from "../components/NotificationProvider.jsx";
import DocumentStorageService from "../services/DocumentStorageService";

import { useAuth } from "../context/AuthContext";
import useAutoSave from "@/hooks/useAutoSave";

function AppContent() {
  const { isAuthenticated, autosaveEnabled, setAutosaveEnabled, syncPreviewScrollEnabled, setSyncPreviewScrollEnabled, isInitializing } = useAuth();
  const { currentDocument, saveDocument, migrationStatus } = useDocument();
  const { content, setContent } = useDocument();
  const { isSharedView, sharedDocument, sharedLoading, sharedError } = useSharedView();
  const [renderedHTML, setRenderedHTML] = useState("");
  const [cursorLine, setCursorLine] = useState(1);
  const [fullscreenPreview, setFullscreenPreview] = useState(false);
  const [showIconBrowser, setShowIconBrowser] = useState(false);
  const { showError, showSuccess } = useNotification();

  // Set fullscreen preview when in shared view
  useEffect(() => {
    if (isSharedView) {
      setFullscreenPreview(true);
    }
  }, [isSharedView]);

  // Load shared document content into editor context
  useEffect(() => {
    if (isSharedView && sharedDocument && sharedDocument.content !== content) {
      setContent(sharedDocument.content);
    }
  }, [isSharedView, sharedDocument, content, setContent]);

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

  // Expose test functions globally for debugging
  useEffect(() => {
    window.testAutoSave = (delaySeconds = 30) => {
      console.log(`Auto-save will trigger in ${delaySeconds} seconds. Get into the editor!`);
      console.log('Countdown started...');
      
      // Show countdown
      let remaining = delaySeconds;
      const countdownInterval = setInterval(() => {
        remaining--;
        if (remaining > 0) {
          console.log(`Auto-save in ${remaining} seconds...`);
        } else {
          console.log('Triggering auto-save NOW!');
          clearInterval(countdownInterval);
        }
      }, 1000);
      
      // Trigger auto-save after delay
      setTimeout(async () => {
        clearInterval(countdownInterval);
        console.log('=== AUTO-SAVE TRIGGERED ===');
        const editor = window.monaco?.editor?.getEditors?.()?.[0];
        if (editor) {
          const positionBefore = editor.getPosition();
          console.log('Cursor position BEFORE auto-save:', positionBefore);
          
          try {
            await runAutoSave();
            
            // Check position after a brief delay to ensure all updates complete
            setTimeout(() => {
              const positionAfter = editor.getPosition();
              console.log('Cursor position AFTER auto-save:', positionAfter);
              console.log('Position preserved:', 
                positionBefore?.lineNumber === positionAfter?.lineNumber && 
                positionBefore?.column === positionAfter?.column ? '✅ YES' : '❌ NO'
              );
            }, 100);
          } catch (error) {
            console.error('Auto-save failed:', error);
          }
        } else {
          await runAutoSave();
        }
      }, delaySeconds * 1000);
    };
    
    window.testManualSave = async () => {
      try {
        const docWithCurrentContent = { ...currentDocument, content };
        const savedDoc = await saveDocument(docWithCurrentContent, true); // Show notifications
        console.log('Manual test save completed for:', savedDoc?.name);
        return savedDoc;
      } catch (error) {
        console.error('Manual test save failed:', error);
        throw error;
      }
    };
    
    return () => {
      delete window.testAutoSave;
      delete window.testManualSave;
    };
  }, [runAutoSave, saveDocument, currentDocument, content]);

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
    <>
      <div id="appRoot" className="app-root">
        <div id="container">
          <Header />

          <Toolbar
            setContent={setContent}
            editorValue={content}
            fullscreenPreview={fullscreenPreview}
            setFullscreenPreview={setFullscreenPreview}
            setShowIconBrowser={setShowIconBrowser}
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

      {/* Migration Loading Overlay */}
      <LoadingOverlay
        show={migrationStatus === 'checking' || migrationStatus === 'migrating'}
        text={migrationStatus === 'checking' ? 'Checking for documents to migrate...' : 'Migrating your documents...'}
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
