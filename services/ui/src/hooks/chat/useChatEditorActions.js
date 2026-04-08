import { useCallback } from 'react';

/**
 * Hook providing editor injection actions for the chat drawer.
 * Uses the global `window.editorInstance` (set by useEditorCore)
 * following the existing pattern used by toolbar/menu components.
 */
export default function useChatEditorActions() {
  const getEditor = useCallback(() => window.editorInstance, []);

  /** Insert text at the current cursor position. */
  const insertAtCursor = useCallback((text) => {
    const editor = getEditor();
    if (!editor) return false;
    const position = editor.getPosition();
    if (!position) return false;
    const range = {
      startLineNumber: position.lineNumber,
      startColumn: position.column,
      endLineNumber: position.lineNumber,
      endColumn: position.column,
    };
    editor.executeEdits('chat-insert', [{ range, text }]);
    editor.focus();
    return true;
  }, [getEditor]);

  /** Replace the current selection with text. Returns false if no selection. */
  const replaceSelection = useCallback((text) => {
    const editor = getEditor();
    if (!editor) return false;
    const selection = editor.getSelection();
    if (!selection || selection.isEmpty()) return false;
    editor.executeEdits('chat-replace', [{ range: selection, text }]);
    editor.focus();
    return true;
  }, [getEditor]);

  /** Replace the entire document content. */
  const replaceDocument = useCallback((text) => {
    const editor = getEditor();
    if (!editor) return false;
    const model = editor.getModel();
    if (!model) return false;
    const fullRange = model.getFullModelRange();
    editor.executeEdits('chat-replace-doc', [{ range: fullRange, text }]);
    editor.focus();
    return true;
  }, [getEditor]);

  /** Append text to the end of the document. */
  const appendToDocument = useCallback((text) => {
    const editor = getEditor();
    if (!editor) return false;
    const model = editor.getModel();
    if (!model) return false;
    const lastLine = model.getLineCount();
    const lastCol = model.getLineMaxColumn(lastLine);
    const range = {
      startLineNumber: lastLine,
      startColumn: lastCol,
      endLineNumber: lastLine,
      endColumn: lastCol,
    };
    editor.executeEdits('chat-append', [{ range, text: '\n' + text }]);
    editor.focus();
    return true;
  }, [getEditor]);

  /** Copy text to clipboard. */
  const copyToClipboard = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }, []);

  return {
    insertAtCursor,
    replaceSelection,
    replaceDocument,
    appendToDocument,
    copyToClipboard,
    hasEditor: () => !!window.editorInstance,
  };
}
