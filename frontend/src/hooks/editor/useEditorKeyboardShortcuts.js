import { useEffect } from 'react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { CommentService, SpellCheckActions, MarkdownLintActions } from '@/services/editor';

/**
 * Hook for managing keyboard shortcuts in the editor
 * @param {Object} editor - Monaco editor instance
 * @param {boolean} enabled - Whether keyboard shortcuts are enabled
 * @param {Map} suggestionsMap - Spell check suggestions map (ref)
 * @param {Map} markersMap - Markdown lint markers map (ref)
 * @param {Function} getCategoryId - Function to get current category ID
 * @param {Function} getFolderPath - Function to get current folder path
 * @param {Function} triggerSpellCheck - Spell check trigger function
 * @param {Function} triggerMarkdownLint - Markdown lint trigger function
 * @returns {Object} Hook interface
 */
export default function useEditorKeyboardShortcuts(
  editor,
  enabled = true,
  suggestionsMap,
  markersMap,
  getCategoryId,
  getFolderPath,
  triggerSpellCheck,
  triggerMarkdownLint
) {
  useEffect(() => {
    if (!enabled || !editor) return;

    // Ensure Monaco is fully loaded before registering actions
    if (!window.monaco) {
      console.warn('Monaco not fully loaded, skipping keyboard shortcuts registration');
      return;
    }

    // Store spell check function globally for SpellCheckActions to use
    window.editorSpellCheckTrigger = triggerSpellCheck;

    // Store markdown lint function globally
    window.editorMarkdownLintTrigger = triggerMarkdownLint;

    // Bold shortcut
    const boldCommand = editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB,
      () => {
        const toolbarButton = document.querySelector('[title="Bold (Ctrl+B)"]');
        if (toolbarButton) toolbarButton.click();
      }
    );

    // Italic shortcut
    const italicCommand = editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI,
      () => {
        const toolbarButton = document.querySelector('[title="Italic (Ctrl+I)"]');
        if (toolbarButton) toolbarButton.click();
      }
    );

    // Quick fix shortcut
    const quickFixCommand = editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.US_DOT,
      () => {
        editor.trigger('', 'editor.action.quickFix', {});
      }
    );

    // Comment toggle shortcut
    const commentCommand = editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash,
      () => {
        CommentService.handleCommentToggle(editor);
      }
    );

    // Register quick fix actions - only if editor is ready
    // IMPORTANT: getCategoryId should be memoized in the parent with useCallback
    try {
      SpellCheckActions.registerQuickFixActions(editor, suggestionsMap, getCategoryId, getFolderPath);
      MarkdownLintActions.registerQuickFixActions(editor, markersMap, getCategoryId, getFolderPath);
    } catch (error) {
      console.warn('Failed to register quick fix actions:', error);
    }

    // Expose services globally
    window.CommentService = CommentService;
    window.testCommentToggle = () => {
      CommentService.handleCommentToggle(editor);
    };

    // Cleanup is handled automatically by Monaco when editor is disposed
    return () => {
      // Clean up global references
      delete window.editorSpellCheckTrigger;
      delete window.editorMarkdownLintTrigger;
    };
  }, [enabled, editor]); // Simplified dependencies to prevent re-runs

  return {};
}