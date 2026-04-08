
import React, { useRef, useState, useEffect, useCallback } from 'react';
import MarkdownToolbar from './editor/MarkdownToolbar';
import { GitStatusBar } from './editor';
import ReadabilityMetricsDisplay from './editor/spell-check/ReadabilityMetricsDisplay';
import { useDocumentContext } from '@/providers/DocumentContextProvider.jsx';
import { useAuth } from '@/providers/AuthProvider.jsx';
import { useEditor, useDebouncedCursorChange } from '@/hooks/editor';

export default function Editor({ value, fullscreenPreview = false, onToggleOutline, outlineVisible, hasOutlineHeadings, onToggleComments, commentsVisible, commentCount, collab, onCursorChange }) {
  const containerRef = useRef(null);
  const { currentDocument, setCurrentDocument, triggerContentUpdate, setCursorLine, setEditorSelection } = useDocumentContext();
  const { isAuthenticated } = useAuth();
  const [isInMermaidFence, setIsInMermaidFence] = useState(false);

  // Debug: Log value prop changes
  useEffect(() => {
    console.log('Editor: value prop changed', {
      valueLength: value?.length || 0,
      documentId: currentDocument?.id,
      documentName: currentDocument?.name
    });
  }, [value, currentDocument?.id, currentDocument?.name]);

  // Phase 5: Advanced spell check settings state
  const [spellCheckSettings, setSpellCheckSettings] = useState({
    spelling: true,
    grammar: true,
    style: true,
    readability: true,
    styleGuide: 'none',
    language: 'en-US',
    enableCodeSpellCheck: false, // Phase 6: Default code spell check to disabled
    codeSpellSettings: {
      checkComments: true,
      checkStrings: true,
      checkIdentifiers: false
    }
  });

  // Phase 6: Load spell check settings from localStorage on mount
  useEffect(() => {
    try {
      const storedSettings = localStorage.getItem('spellCheckSettings');
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings);
        setSpellCheckSettings(prev => ({
          ...prev,
          ...parsed.analysisTypes,
          enableCodeSpellCheck: parsed.codeSpellSettings?.enabled || false,
          codeSpellSettings: {
            checkComments: parsed.codeSpellSettings?.checkComments ?? true,
            checkStrings: parsed.codeSpellSettings?.checkStrings ?? true,
            checkIdentifiers: parsed.codeSpellSettings?.checkIdentifiers ?? false
          },
          styleGuide: parsed.styleGuide || 'none',
          language: parsed.language || 'en-US'
        }));
      }
    } catch (error) {
      console.error('Failed to load spell check settings:', error);
    }
  }, []);

  // Phase 5: Readability display follows analysis type toggle
  const showReadability = spellCheckSettings.readability ?? false;

  // Track current category and folder path in state
  const [currentCategoryId, setCurrentCategoryId] = useState(currentDocument?.category);
  const [currentFolderPath, setCurrentFolderPath] = useState(currentDocument?.folder_path);

  // Update state when document changes
  useEffect(() => {
    setCurrentCategoryId(currentDocument?.category);
    setCurrentFolderPath(currentDocument?.folder_path);
  }, [currentDocument?.category, currentDocument?.folder_path]);

  // Memoize the category getter function to prevent unnecessary re-renders
  const getCategoryId = useCallback(() => currentCategoryId, [currentCategoryId]);

  // Memoize the folder path getter function to prevent unnecessary re-renders
  const getFolderPath = useCallback(() => currentFolderPath, [currentFolderPath]);

  // Debug: Log the document structure to understand what we have

  // Handle document updates from GitHub operations
  const handleDocumentUpdate = (updatedDocument) => {
    if (updatedDocument) {
      setCurrentDocument(updatedDocument);
      triggerContentUpdate(updatedDocument.content || '', { reason: 'document-update' });
    }
  };

  // Debounced cursor line change handler
  const debouncedLineChange = useDebouncedCursorChange((line) => {
    setCursorLine(line);
    if (onCursorChange) onCursorChange(line);
  }, 300);

  // Detect if cursor is inside a mermaid code fence
  const checkMermaidFence = useCallback((editorInstance) => {
    if (!editorInstance) return;
    const model = editorInstance.getModel();
    const position = editorInstance.getPosition();
    if (!model || !position) return;

    let inFence = false;
    let fenceLanguage = '';
    for (let i = 1; i <= position.lineNumber; i++) {
      const line = model.getLineContent(i).trim();
      if (line.startsWith('```')) {
        if (inFence) {
          inFence = false;
          fenceLanguage = '';
        } else {
          inFence = true;
          fenceLanguage = line.slice(3).trim().toLowerCase();
        }
      }
    }
    setIsInMermaidFence(inFence && fenceLanguage === 'mermaid');
  }, []);

  // In collab mode, wrap triggerContentUpdate to also apply to Y.Doc
  const handleContentChange = useCallback((newContent, options) => {
    if (collab?.collabActive) {
      // Apply change to the shared Y.Doc — the server will relay to peers
      collab.applyLocalChange(newContent);
    }
    // Always update local state and preview
    triggerContentUpdate(newContent, options);
  }, [collab, triggerContentUpdate]);

  // Register remote change handler so the editor picks up peer edits
  useEffect(() => {
    if (collab?.onRemoteChange) {
      collab.onRemoteChange((remoteContent) => {
        // Update document context (preview, state) but skip rendering a loop
        triggerContentUpdate(remoteContent, { reason: 'remote-collab' });
      });
    }
  }, [collab, triggerContentUpdate]);


      // Use consolidated editor hook with Phase 5 settings
  const { editor, spellCheck, markdownLint, runSpellCheck, runMarkdownLint } = useEditor({
    containerRef,
    value, // RE-ENABLED: Reconnect value prop
    documentId: currentDocument?.id,
    onChange: handleContentChange,
    onCursorLineChange: debouncedLineChange,
    onSelectionChange: setEditorSelection,
    enableSpellCheck: true, // ENABLED: Turn on spell check
    enableMarkdownLint: true, // ENABLED: Turn on markdown lint
    enableKeyboardShortcuts: true, // ENABLED: Turn on keyboard shortcuts
    enableListBehavior: true, // ENABLED: Turn on list behavior
    enableImagePaste: true, // ENABLED: Turn on image paste
    categoryId: getCategoryId,
    getFolderPath: getFolderPath,
    spellCheckSettings, // Phase 6: Pass current spell check settings
    isRapidTyping: true // ENABLED: Turn on rapid typing detection now that rendering is smooth
  });

  const progress = spellCheck?.progress;
  const lintProgress = markdownLint?.lintProgress;
  const readabilityData = spellCheck?.readabilityData;
  const serviceInfo = spellCheck?.serviceInfo;

  // Listen for outline-navigate events to scroll editor to a specific line
  useEffect(() => {
    const handleOutlineNavigate = (e) => {
      if (editor && e.detail?.line) {
        editor.revealLineInCenter(e.detail.line);
        editor.setPosition({ lineNumber: e.detail.line, column: 1 });
        editor.focus();
      }
    };
    window.addEventListener('outline-navigate', handleOutlineNavigate);
    return () => window.removeEventListener('outline-navigate', handleOutlineNavigate);
  }, [editor]);

  // Listen for cursor changes to detect mermaid fence
  useEffect(() => {
    if (!editor) return;
    const disposable = editor.onDidChangeCursorPosition(() => {
      checkMermaidFence(editor);
    });
    // Initial check
    checkMermaidFence(editor);
    return () => disposable.dispose();
  }, [editor, checkMermaidFence]);

  // Phase 5: Handle spell check with custom settings
  const handleSpellCheck = (customSettings = null) => {
    const effectiveSettings = customSettings || spellCheckSettings;
    runSpellCheck(effectiveSettings);
  };

  // Phase 5: Handle settings changes
  const handleSpellCheckSettings = (newSettings) => {
    setSpellCheckSettings(prev => ({
      ...prev,
      ...newSettings
    }));
  };

  // Generate CSS class based on whether status bar will be shown
  const editorClassName = `has-toolbar ${isAuthenticated ? 'has-github-status' : 'no-github-status'}`;

  return (
    <div style={{
      height: "100%",
      width: "100%",
      display: fullscreenPreview ? "none" : "flex",
      flexDirection: "column"
    }}>
      <div style={{ position: 'relative', zIndex: 100 }}>
        <MarkdownToolbar
          editorRef={{ current: editor }}
          onSpellCheck={handleSpellCheck}
          spellCheckProgress={progress}
          onMarkdownLint={runMarkdownLint}
          markdownLintProgress={lintProgress}
          // Phase 5: Pass new props
          onSpellCheckSettings={handleSpellCheckSettings}
          spellCheckSettings={spellCheckSettings}
          readabilityData={readabilityData}
          serviceInfo={serviceInfo}
          // Outline toggle
          onToggleOutline={onToggleOutline}
          outlineVisible={outlineVisible}
          hasOutlineHeadings={hasOutlineHeadings}
          // Comments toggle
          onToggleComments={onToggleComments}
          commentsVisible={commentsVisible}
          commentCount={commentCount}
          // Mermaid fence detection
          isInMermaidFence={isInMermaidFence}
        />
      </div>
      <div id="editor" className={editorClassName} style={{ flex: 1, width: "100%", display: "flex", flexDirection: "column", position: 'relative', zIndex: 1 }}>
        <div ref={containerRef} className="monaco-container" style={{ flex: 1, width: "100%" }} />

        {/* Phase 5: Readability metrics display */}
        {spellCheckSettings.readability && readabilityData && (
          <ReadabilityMetricsDisplay
            readabilityData={readabilityData}
            isVisible={showReadability}
            className="mt-2"
          />
        )}

        <GitStatusBar
          documentId={currentDocument?.id}
          document={currentDocument}
          onStatusChange={(status) => {
            // Optional: handle status changes globally
            console.log('Git status updated:', status);
          }}
          onDocumentUpdate={handleDocumentUpdate}
        />
      </div>
    </div>
  );
}