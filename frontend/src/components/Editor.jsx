
import React, { useRef, useState } from 'react';
import MarkdownToolbar from './editor/MarkdownToolbar';
import ProgressIndicator from './ProgressIndicator';
import { GitStatusBar } from './editor';
import ReadabilityMetricsDisplay from './editor/spell-check/ReadabilityMetricsDisplay';
import { useDocumentContext } from '@/providers/DocumentContextProvider.jsx';
import { useAuth } from '@/providers/AuthProvider.jsx';
import { useEditor, useDebouncedCursorChange } from '@/hooks/editor';

export default function Editor({ value, onChange, onCursorLineChange, fullscreenPreview = false }) {
  const containerRef = useRef(null);
  const { currentDocument, setCurrentDocument, setContent } = useDocumentContext();
  const { isAuthenticated } = useAuth();

  // Phase 5: Advanced spell check settings state
  const [spellCheckSettings, setSpellCheckSettings] = useState({
    spelling: true,
    grammar: true,
    style: true,
    readability: true,
    styleGuide: 'none',
    language: 'en-US'
  });

  // Phase 5: Readability display state
  const [showReadability, setShowReadability] = useState(false);

  // Get the category from the current document (string name, not ID)
  const categoryId = currentDocument?.category;

  // Create a ref to track current categoryId for dynamic access
  const categoryIdRef = useRef(categoryId);
  categoryIdRef.current = categoryId;

  // Create a ref to track current folder path for dynamic access
  const folderPathRef = useRef(currentDocument?.folder_path);
  folderPathRef.current = currentDocument?.folder_path;

  // Debug: Log the document structure to understand what we have

  // Handle document updates from GitHub operations
  const handleDocumentUpdate = (updatedDocument) => {
    if (updatedDocument) {
      setCurrentDocument(updatedDocument);
      setContent(updatedDocument.content || '');
      if (onChange) {
        onChange(updatedDocument.content || '');
      }
    }
  };

  // Debounced cursor line change handler
  const debouncedLineChange = useDebouncedCursorChange(onCursorLineChange, 300);


  // Use consolidated editor hook with Phase 5 settings
  const { editor, spellCheck, markdownLint, runSpellCheck, runMarkdownLint } = useEditor({
    containerRef,
    value,
    onChange,
    onCursorLineChange: debouncedLineChange,
    enableSpellCheck: true,
    enableMarkdownLint: true,
    enableKeyboardShortcuts: true,
    enableListBehavior: true,
    categoryId,
    getCategoryId: () => categoryIdRef.current,
    getFolderPath: () => folderPathRef.current,
    spellCheckSettings // Phase 5: Pass settings to hook
  });

  const progress = spellCheck?.progress;
  const lintProgress = markdownLint?.lintProgress;
  const readabilityData = spellCheck?.readabilityData;
  const serviceInfo = spellCheck?.serviceInfo;

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
      position: "relative",
      display: fullscreenPreview ? "none" : "flex",
      flexDirection: "column"
    }}>
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
      />
      <div id="editor" className={editorClassName} style={{ flex: 1, width: "100%", display: "flex", flexDirection: "column" }}>
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