
import React, { useRef, useState, useEffect } from 'react';
import MarkdownToolbar from './editor/MarkdownToolbar';
import ProgressIndicator from './ProgressIndicator';
import { GitStatusBar } from './editor';
import ReadabilityMetricsDisplay from './editor/spell-check/ReadabilityMetricsDisplay';
import { useDocumentContext } from '@/providers/DocumentContextProvider.jsx';
import { useAuth } from '@/providers/AuthProvider.jsx';
import { useEditor, useDebouncedCursorChange } from '@/hooks/editor';

export default function Editor({ value, fullscreenPreview = false }) {
  const containerRef = useRef(null);
  const { currentDocument, setCurrentDocument, setContent, triggerContentUpdate, setCursorLine } = useDocumentContext();
  const { isAuthenticated } = useAuth();

  // Debug: Log value prop changes
  useEffect(() => {
    console.log('Editor: value prop changed', {
      valueLength: value?.length || 0,
      documentId: currentDocument?.id,
      documentName: currentDocument?.name
    });
  }, [value, currentDocument?.id]);

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
      triggerContentUpdate(updatedDocument.content || '', { reason: 'document-update' });
    }
  };

  // Debounced cursor line change handler
  const debouncedLineChange = useDebouncedCursorChange(setCursorLine, 300);


    // Use consolidated editor hook with Phase 5 settings
  const { editor, spellCheck, markdownLint, runSpellCheck, runMarkdownLint } = useEditor({
    containerRef,
    value,
    onChange: triggerContentUpdate,
    onCursorLineChange: debouncedLineChange,
    enableSpellCheck: true,
    enableMarkdownLint: true,
    enableKeyboardShortcuts: true,
    enableListBehavior: true,
    enableImagePaste: true, // Explicitly enable image paste
    categoryId: () => categoryIdRef.current,
    getFolderPath: () => folderPathRef.current,
    spellCheckSettings // Phase 6: Pass current spell check settings
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