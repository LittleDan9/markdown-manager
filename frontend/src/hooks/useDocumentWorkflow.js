/**
 * Composite Hook for Document Workflow
 * Combines related document operations into a unified interface
 */
import { useCallback, useMemo } from 'react';
import { useDocument } from '@/providers/DocumentProvider';
import useEditor from './useEditor';
import useFileOperations from './useFileOperations';
import useDocumentAutoSave from './useDocumentAutoSave';
import { useNotification } from '@/components/NotificationProvider';

/**
 * Unified document workflow hook
 * Provides a clean interface for all document-related operations
 */
export default function useDocumentWorkflow() {
  const document = useDocument();
  const editor = useEditor();
  const fileOps = useFileOperations();
  const autoSave = useDocumentAutoSave();
  const notification = useNotification();

  // Document state
  const documentState = useMemo(() => ({
    current: document.currentDocument,
    content: document.content,
    documents: document.documents,
    categories: document.categories,
    hasUnsavedChanges: document.hasUnsavedChanges,
    loading: document.loading,
    error: document.error
  }), [
    document.currentDocument,
    document.content,
    document.documents,
    document.categories,
    document.hasUnsavedChanges,
    document.loading,
    document.error
  ]);

  // Editor state
  const editorState = useMemo(() => ({
    instance: editor.instance,
    isReady: editor.isReady,
    theme: editor.theme,
    spellCheckEnabled: editor.spellCheckEnabled,
    errors: editor.errors
  }), [
    editor.instance,
    editor.isReady,
    editor.theme,
    editor.spellCheckEnabled,
    editor.errors
  ]);

  // Combined actions
  const actions = useMemo(() => ({
    // Document operations
    createDocument: document.createDocument,
    loadDocument: document.loadDocument,
    saveDocument: document.saveDocument,
    deleteDocument: document.deleteDocument,
    renameDocument: document.renameDocument,
    
    // Content operations
    setContent: document.setContent,
    
    // Category operations
    addCategory: document.addCategory,
    deleteCategory: document.deleteCategory,
    renameCategory: document.renameCategory,
    
    // Editor operations
    setupEditor: editor.setupEditor,
    setTheme: editor.setTheme,
    toggleSpellCheck: editor.toggleSpellCheck,
    insertText: editor.insertText,
    goToLine: editor.goToLine,
    find: editor.find,
    
    // File operations
    exportMarkdown: fileOps.exportMarkdown,
    exportPDF: fileOps.exportPDF,
    importFile: fileOps.importFile,
    
    // Auto-save operations
    saveNow: autoSave.saveNow,
    enableAutoSave: autoSave.enableAutoSave,
    disableAutoSave: autoSave.disableAutoSave,
    
    // Sync operations
    syncWithBackend: document.syncWithBackend
  }), [
    document.createDocument,
    document.loadDocument,
    document.saveDocument,
    document.deleteDocument,
    document.renameDocument,
    document.setContent,
    document.addCategory,
    document.deleteCategory,
    document.renameCategory,
    document.syncWithBackend,
    editor.setupEditor,
    editor.setTheme,
    editor.toggleSpellCheck,
    editor.insertText,
    editor.goToLine,
    editor.find,
    fileOps.exportMarkdown,
    fileOps.exportPDF,
    fileOps.importFile,
    autoSave.saveNow,
    autoSave.enableAutoSave,
    autoSave.disableAutoSave
  ]);

  // Convenience methods
  const saveAndNotify = useCallback(async (showNotification = true) => {
    try {
      await actions.saveNow();
      if (showNotification) {
        notification.showSuccess('Document saved successfully');
      }
    } catch (error) {
      notification.showError(`Save failed: ${error.message}`);
    }
  }, [actions.saveNow, notification]);

  const createAndSetup = useCallback(async () => {
    const newDoc = actions.createDocument();
    if (editor.instance) {
      await actions.setupEditor(editor.instance, newDoc.content);
    }
    return newDoc;
  }, [actions.createDocument, actions.setupEditor, editor.instance]);

  const loadAndSetup = useCallback(async (documentId) => {
    try {
      await actions.loadDocument(documentId);
      if (editor.instance && documentState.current) {
        await actions.setupEditor(editor.instance, documentState.current.content);
      }
    } catch (error) {
      notification.showError(`Failed to load document: ${error.message}`);
    }
  }, [actions.loadDocument, actions.setupEditor, editor.instance, documentState.current, notification]);

  const exportWithFeedback = useCallback(async (format = 'markdown', filename = null) => {
    try {
      if (format === 'markdown') {
        await actions.exportMarkdown(documentState.content, filename);
        notification.showSuccess('Markdown exported successfully');
      } else if (format === 'pdf') {
        await actions.exportPDF(documentState.content, filename);
        notification.showSuccess('PDF exported successfully');
      }
    } catch (error) {
      notification.showError(`Export failed: ${error.message}`);
    }
  }, [actions.exportMarkdown, actions.exportPDF, documentState.content, notification]);

  return {
    // State
    document: documentState,
    editor: editorState,
    
    // Actions
    actions,
    
    // Convenience methods
    saveAndNotify,
    createAndSetup,
    loadAndSetup,
    exportWithFeedback
  };
}
