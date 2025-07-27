import React, { useEffect, useRef, useState } from "react";
import EditorSingleton from "../services/EditorService";
import { useTheme } from "../context/ThemeContext";
import { useDocument } from "../context/DocumentProvider";
import { useAuth } from "../context/AuthProvider";
import { useNotification } from "./NotificationProvider";
import HighlightService from "../services/HighlightService";
import SpellCheckService from "../services/SpellCheckService";
import PerformanceOptimizer from "../services/PerformanceOptimizer";
import DocumentLazyLoader from "../services/DocumentLazyLoader";
import customDictionaryApi from "../api/customDictionaryApi";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import useAutoSave from "../hooks/useAutoSave";

function Editor({ value, onChange, autosaveEnabled = true, onCursorLineChange }) {
  const editorRef = useRef(null);
  const monacoInstanceRef = useRef(null);
  const spellDebounceRef = useRef(null);
  const suggestionsMapRef = useRef(new Map());
  const { theme } = useTheme();
  const { user } = useAuth();
  const { showSuccess, showError, showWarning } = useNotification();
  const { highlightedBlocks, setHighlightedBlocks } = useDocument();
  const highlightDebounceRef = useRef();
  const resizeObserverRef = useRef(null);
  const layoutDebounceRef = useRef();
  const { currentDocument, saveDocument } = useDocument();

  // Performance monitoring state
  const [performanceInfo, setPerformanceInfo] = useState(null);
  const [spellCheckProgress, setSpellCheckProgress] = useState(null);
  const [isEditorLoading, setIsEditorLoading] = useState(false);
  const [lazyLoadInfo, setLazyLoadInfo] = useState(null);
  const [isUsingLazyLoad, setIsUsingLazyLoad] = useState(false);

  // Integrate autosave hook: save with latest editor value
  useAutoSave(
    { ...currentDocument, content: value },
    saveDocument,
    autosaveEnabled,
    30000
  );

  // Show performance notification when needed - FIXED: Remove performanceInfo from dependencies to prevent infinite loop
  useEffect(() => {
    const info = PerformanceOptimizer.getPerformanceMessage(value);
    if (info && (!performanceInfo || info.message !== performanceInfo.message)) {
      setPerformanceInfo(info);
      if (info.type === 'warning') {
        showWarning(`${info.title}: ${info.message}`);
      } else if (info.type === 'info') {
        console.log(`${info.title}: ${info.message}`);
      }
    }
  }, [value, showWarning]); // CRITICAL FIX: Removed performanceInfo from dependencies

  // Full document spell check (independent function)
  const runFullSpellCheck = async (editorInstance, textOverride) => {
    if (!editorInstance) return;
    const text = textOverride ?? editorInstance.getValue();
    const strategy = PerformanceOptimizer.getSpellCheckStrategy(text);

    if (!strategy.enabled) {
      monaco.editor.setModelMarkers(editorInstance.getModel(), "spell", []);
      if (strategy.message) showWarning(strategy.message);
      return;
    }
    suggestionsMapRef.current.clear();
    monaco.editor.setModelMarkers(editorInstance.getModel(), "spell", []);
    const documentSize = text.length;
    const hasLotsOfCode = (text.match(/```/g) || []).length > 4;
    const hasLotsOfTechnicalTerms = (text.match(/[A-Z]{2,}/g) || []).length > 20;
    if (hasLotsOfCode || hasLotsOfTechnicalTerms || documentSize > 5000) {
      try {
        const issues = SpellCheckService.check(text);
        const limitedIssues = issues.slice(0, 20);
        applySpellCheckResults(editorInstance, limitedIssues);
      } catch (error) {
        console.error('Spell check error:', error);
        showWarning('Spell check failed - document may contain too many technical terms');
      }
      return;
    }
    if (strategy.progressive) {
      setSpellCheckProgress({ progress: 0, message: strategy.message });
      await SpellCheckService.checkProgressive(
        text,
        (progress) => {
          setSpellCheckProgress({
            progress: progress.progress * 100,
            message: `Spell checking... ${progress.currentChunk}/${progress.totalChunks} chunks`
          });
        },
        (allResults) => {
          setSpellCheckProgress(null);
          applySpellCheckResults(editorInstance, allResults);
        }
      );
    } else {
      const issues = SpellCheckService.check(text);
      applySpellCheckResults(editorInstance, issues);
    }
  };

  // Region-based spell check (n chars back/forward, terminate at whitespace)
  const runRegionSpellCheck = async (editorInstance, changeRange, n = 100) => {
    if (!editorInstance || !changeRange) return;
    const text = editorInstance.getValue();
    // Find region boundaries
    let start = Math.max(0, changeRange.startOffset - n);
    let end = Math.min(text.length, changeRange.endOffset + n);
    // Move start backward to previous whitespace
    while (start > 0 && !/\s/.test(text[start - 1])) start--;
    // Move end forward to next whitespace
    while (end < text.length && !/\s/.test(text[end])) end++;
    const regionText = text.slice(start, end);
    const model = editorInstance.getModel();
    const startPos = model.getPositionAt(start);
    const regionIssues = SpellCheckService.check(regionText);
    // Map region issues to document positions
    const mappedIssues = regionIssues.map(issue => ({
      ...issue,
      lineNumber: startPos.lineNumber + (issue.lineNumber - 1),
      column: (issue.lineNumber === 1 ? startPos.column + issue.column - 1 : issue.column),
      offset: issue.offset
    }));

    // Update suggestionsMap only for region
    // 1. Build set of keys for region
    const regionKeys = new Set(mappedIssues.map(i => `${i.lineNumber}:${i.column}`));
    // 2. Remove any previous region keys that are no longer present
    for (const key of suggestionsMapRef.current.keys()) {
      // If key is in region and not in new issues, remove
      const [line, col] = key.split(":").map(Number);
      if (line >= startPos.lineNumber && line <= startPos.lineNumber + (end - start) && !regionKeys.has(key)) {
        suggestionsMapRef.current.delete(key);
      }
    }
    // 3. Add/update new region issues
    mappedIssues.forEach(({ lineNumber, column, suggestions }) => {
      const key = `${lineNumber}:${column}`;
      suggestionsMapRef.current.set(key, suggestions);
    });

    // Only update markers in region
    const existingMarkers = monaco.editor.getModelMarkers({ resource: model.uri }).filter(m => m.owner === 'spell');
    // Calculate affected line/column range
    const regionStartPos = model.getPositionAt(start);
    const regionEndPos = model.getPositionAt(end);
    // Remove markers that overlap with the region (by line/column)
    const filteredMarkers = existingMarkers.filter(m => {
      // If marker is completely outside region, keep it
      if (m.endLineNumber < regionStartPos.lineNumber || m.startLineNumber > regionEndPos.lineNumber) return true;
      // If marker is on region boundary, check columns
      if (m.endLineNumber === regionStartPos.lineNumber && m.endColumn <= regionStartPos.column) return true;
      if (m.startLineNumber === regionEndPos.lineNumber && m.startColumn >= regionEndPos.column) return true;
      // Otherwise, marker overlaps region, so remove
      return false;
    });
    // Add new region markers
    const regionMarkers = mappedIssues.map(mappedIssue => {
      const { word, suggestions, lineNumber, column } = mappedIssue;
      const suggestionText = suggestions.length > 0 ? suggestions.slice(0, 3).join(", ") : "No suggestions";
      return {
        startLineNumber: lineNumber,
        startColumn: column,
        endLineNumber: lineNumber,
        endColumn: column + word.length,
        message: `"${word}" - ${suggestionText}`,
        severity: monaco.MarkerSeverity.Warning
      };
    });
    // Set all markers (outside region + new region markers)
    monaco.editor.setModelMarkers(model, "spell", filteredMarkers.concat(regionMarkers));
  };

  // Helper for document load
  const handleDocumentLoad = (newContent, runFullSpellCheckBool = true) => {
    if (monacoInstanceRef.current) {
      monacoInstanceRef.current.setValue(newContent);
      if (runFullSpellCheckBool) runFullSpellCheck(monacoInstanceRef.current, newContent);
    }
  };

  // Apply spell check results to Monaco editor
  const applySpellCheckResults = (editorInstance, issues) => {
    const model = editorInstance.getModel();

    // Limit the number of markers to prevent performance issues
    const maxMarkers = 100; // Limit to prevent Chrome freezing
    const limitedIssues = issues.slice(0, maxMarkers);

    const markers = limitedIssues.map(({ word, suggestions, lineNumber, column }) => {
      const key = `${lineNumber}:${column}`;
      suggestionsMapRef.current.set(key, suggestions);

      // Simplified message to prevent duplicate text
      const suggestionText = suggestions.length > 0 ? suggestions.slice(0, 3).join(", ") : "No suggestions";

      return {
        startLineNumber: lineNumber,
        startColumn: column,
        endLineNumber: lineNumber,
        endColumn: column + word.length,
        message: `"${word}" - ${suggestionText}`, // Simplified message format
        severity: monaco.MarkerSeverity.Warning,
      };
    });

    monaco.editor.setModelMarkers(model, "spell", markers);

    if (issues.length > maxMarkers) {
      console.log(`Spell check complete: ${limitedIssues.length}/${issues.length} issues shown (limited for performance)`);
    } else if (issues.length > 0) {
      console.log(`Spell check complete: ${issues.length} issues found`);
    }
  };

  // Initialize SpellCheckService once
  useEffect(() => {
    SpellCheckService.init().catch(console.error);
  }, []);

  // Initialize Monaco on mount and observe container resize
  useEffect(() => {
    if (editorRef.current && !monacoInstanceRef.current) {

      // Check for lazy loading requirement first
      const lazyLoadResult = DocumentLazyLoader.initializeLazyLoading(value);
      let actualValue = value;

      if (lazyLoadResult.useLazyLoading) {
        setIsUsingLazyLoad(true);
        setLazyLoadInfo(lazyLoadResult.metadata);
        actualValue = lazyLoadResult.content;

        // Show performance recommendations
        const recommendations = DocumentLazyLoader.getPerformanceRecommendations(value);
        if (recommendations) {
          showWarning(`${recommendations.message}\n• ${recommendations.recommendations.join('\n• ')}`);
        }
      }

      // Check if we should defer loading for large documents
      const loadStrategy = PerformanceOptimizer.getInitialLoadStrategy(actualValue);

      const setupEditor = () => {
        EditorSingleton.setup(editorRef.current, actualValue, theme).then((instance) => {
          monacoInstanceRef.current = instance;

          // Removed initial spell-check here to avoid double invocation; spell check will run on content change (debounced)

          // register quick-fix code actions for spelling suggestions
          monaco.languages.registerCodeActionProvider('markdown', {
            providedCodeActionKinds: ['quickfix'],
            provideCodeActions: (model, range, context) => {
              const actions = [];
              context.markers.forEach(marker => {
                if (marker.owner !== 'spell') return;
                const key = `${marker.startLineNumber}:${marker.startColumn}`;
                const suggestions = suggestionsMapRef.current.get(key) || [];
                const misspelledWord = model.getValueInRange({
                  startLineNumber: marker.startLineNumber,
                  startColumn: marker.startColumn,
                  endLineNumber: marker.endLineNumber,
                  endColumn: marker.endColumn
                });

                // Add spelling suggestions
                suggestions.forEach(suggestion => {
                  actions.push({
                    title: suggestion,
                    kind: 'quickfix',
                    edit: {
                      edits: [{
                        resource: model.uri,
                        textEdit: {
                          range: new monaco.Range(
                            marker.startLineNumber,
                            marker.startColumn,
                            marker.endLineNumber,
                            marker.endColumn
                          ),
                          text: suggestion
                        }
                      }]
                    },
                    diagnostics: [marker]
                  });
                });

                // Add "Add to Dictionary" action
                actions.push({
                  title: `Add "${misspelledWord}" to dictionary`,
                  kind: 'quickfix',
                  edit: undefined, // No text edit, just run the command
                  command: {
                    id: 'addToDictionary',
                    title: 'Add to Dictionary',
                    arguments: [misspelledWord]
                  },
                  diagnostics: [marker]
                });
              });
              return { actions, dispose: () => {} };
            }
          });

          // Register the "Add to Dictionary" command
          monaco.editor.registerCommand('addToDictionary', async (accessor, word) => {
            try {
              console.log(`Attempting to add "${word}" to dictionary...`);

              // Add to local spell checker
              SpellCheckService.addCustomWord(word);

              // If user is logged in, also add to backend
              if (user) {
                try {
                  await customDictionaryApi.addWord(word);
                  showSuccess(`Added "${word}" to your dictionary`);
                } catch (error) {
                  if (error.message?.includes("already exists")) {
                    showWarning(`"${word}" is already in your dictionary`);
                  } else {
                    showError(`Failed to save "${word}" to server: ${error.message}`);
                    // Still show success for local addition
                    showSuccess(`Added "${word}" to local dictionary`);
                  }
                }
              } else {
                showSuccess(`Added "${word}" to local dictionary`);
              }

              // Re-run spell check to update markers
              runSpellCheck(monacoInstanceRef.current);

            } catch (error) {
              console.error('Error adding word to dictionary:', error);
              showError(`Failed to add "${word}" to dictionary`);
            }
          });

          setTimeout(() => {
            const textarea = editorRef.current.querySelector('textarea.monaco-mouse-cursor-text');
            if (textarea) {
              textarea.id = 'monaco-editor-textarea';
            }
          }, 0);

          instance.onDidChangeModelContent((event) => {
            const newValue = instance.getValue();
            let finalValue = newValue;
            if (isUsingLazyLoad) finalValue = newValue;
            if (finalValue !== value) onChange(finalValue);
            // Region-based spell check
            if (spellDebounceRef.current) clearTimeout(spellDebounceRef.current);
            spellDebounceRef.current = setTimeout(() => {
              // Use event.changes to get the changed range
              if (event && event.changes && event.changes.length > 0) {
                // Use first change for region
                const change = event.changes[0];
                // Monaco provides rangeOffset and rangeLength
                const changeRange = {
                  startOffset: change.rangeOffset,
                  endOffset: change.rangeOffset + change.text.length
                };
                runRegionSpellCheck(instance, changeRange, 100); // n=100
              } else {
                // Fallback: full spell check
                runFullSpellCheck(instance);
              }
            }, 1000);
          });

          // RE-ENABLED: Cursor position tracking for preview scroll (with line change optimization)
          let lastLineNumber = 1;
          instance.onDidChangeCursorPosition((e) => {
            if (onCursorLineChange && e.position.lineNumber !== lastLineNumber) {
              lastLineNumber = e.position.lineNumber;
              onCursorLineChange(e.position.lineNumber);
            }
          });
        });
      };

      // Apply deferred loading strategy for large documents
      if (loadStrategy.shouldDefer) {
        setIsEditorLoading(true);
        if (loadStrategy.showWarning) {
          showWarning(loadStrategy.message);
        }
        setTimeout(() => {
          setupEditor();
          setIsEditorLoading(false);
        }, loadStrategy.deferDelay);
      } else {
        setupEditor();
      }
    }

    // Setup ResizeObserver to call layout on Monaco when container resizes (debounced)
    if (editorRef.current) {
      resizeObserverRef.current = new window.ResizeObserver(() => {
        if (layoutDebounceRef.current) clearTimeout(layoutDebounceRef.current);
        layoutDebounceRef.current = setTimeout(() => {
          if (monacoInstanceRef.current) {
            monacoInstanceRef.current.layout();
          }
        }, 100); // 100ms debounce
      });
      resizeObserverRef.current.observe(editorRef.current);
    }
    // Cleanup on unmount
    return () => {
      if (monacoInstanceRef.current) {
        monacoInstanceRef.current.dispose();
        monacoInstanceRef.current = null;
      }
      if (highlightDebounceRef.current) clearTimeout(highlightDebounceRef.current);
      if (spellDebounceRef.current) clearTimeout(spellDebounceRef.current);
      if (layoutDebounceRef.current) clearTimeout(layoutDebounceRef.current);
      if (resizeObserverRef.current && editorRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
    };
    // eslint-disable-next-line
  }, []);

  // Update Monaco when theme changes
  useEffect(() => {
    if (monacoInstanceRef.current) {
      EditorSingleton.applyTheme(theme);
    }
  }, [theme]);

  // Update Monaco value if parent value changes (external update) - FIXED: Add ref to prevent loops
  const lastExternalValueRef = useRef(value);
  useEffect(() => {
    if (
      monacoInstanceRef.current &&
      value !== lastExternalValueRef.current &&
      monacoInstanceRef.current.getValue() !== value
    ) {
      lastExternalValueRef.current = value;
      monacoInstanceRef.current.setValue(value);
    }
  }, [value]);

  return (
    <div id="editorContainer" style={{ height: "100%", width: "100%", position: "relative" }}>

      {/* Lazy load information for extreme documents */}
      {lazyLoadInfo && (
        <div
          className="alert alert-warning alert-dismissible fade show"
          style={{
            position: "absolute",
            top: "60px",
            right: "10px",
            zIndex: 1000,
            maxWidth: "350px",
            fontSize: "12px",
            padding: "10px 15px"
          }}
        >
          <strong><i className="bi bi-lightning-charge"></i> Performance Mode Active</strong><br />
          <div className="mt-2">
            <div><strong>Original:</strong> {Math.round(lazyLoadInfo.originalSize / 1024)}KB, {lazyLoadInfo.totalChunks} chunks</div>
            <div><strong>Mode:</strong> Optimized viewing (showing preview)</div>
            <div className="text-muted mt-1">
              <small>Full document editing available. All changes will be saved.</small>
            </div>
          </div>
          <button
            type="button"
            className="btn-close"
            onClick={() => setLazyLoadInfo(null)}
            aria-label="Close"
          ></button>
        </div>
      )}

      {/* Performance indicator */}
      {performanceInfo && !lazyLoadInfo && (
        <div
          className={`alert alert-${performanceInfo.type === 'warning' ? 'warning' : 'info'} alert-dismissible fade show`}
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            zIndex: 1000,
            maxWidth: "300px",
            fontSize: "12px",
            padding: "8px 12px"
          }}
        >
          <strong>{performanceInfo.title}</strong><br />
          {performanceInfo.message}
          <button
            type="button"
            className="btn-close"
            onClick={() => setPerformanceInfo(null)}
            aria-label="Close"
          ></button>
        </div>
      )}

      {/* Spell check progress indicator */}
      {spellCheckProgress && (
        <div
          className="alert alert-info"
          style={{
            position: "absolute",
            bottom: "10px",
            right: "10px",
            zIndex: 1000,
            maxWidth: "250px",
            fontSize: "12px",
            padding: "8px 12px"
          }}
        >
          <div className="d-flex align-items-center">
            <div className="spinner-border spinner-border-sm me-2" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <div>
              <div>{spellCheckProgress.message}</div>
              <div className="progress mt-1" style={{ height: "4px" }}>
                <div
                  className="progress-bar"
                  style={{ width: `${spellCheckProgress.progress}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Editor loading indicator for large documents */}
      {isEditorLoading && (
        <div
          className="d-flex align-items-center justify-content-center"
          style={{
            position: "absolute",
            top: "0",
            left: "0",
            right: "0",
            bottom: "0",
            backgroundColor: "rgba(255, 255, 255, 0.9)",
            zIndex: 2000
          }}
        >
          <div className="text-center">
            <div className="spinner-border text-primary mb-3" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <div className="h5">Optimizing editor for large document...</div>
            <div className="text-muted">Please wait while we prepare the performance-optimized view</div>
          </div>
        </div>
      )}

      <div
        id="editor"
        ref={editorRef}
        style={{ height: "100%", width: "100%" }}
      />
    </div>
  );
}

export default Editor;
