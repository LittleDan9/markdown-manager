import { useEffect } from 'react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { CommentService } from '@/services/editor';
import { registerQuickFixActions } from '@/utils';

/**
 * Custom hook for managing keyboard shortcuts in Monaco editor
 * @param {Object} editor - Monaco editor instance
 * @param {Object} suggestionsMap - Spell check suggestions map
 * @param {Function} getCategoryId - Function to get current category ID
 */
export default function useKeyboardShortcuts(editor, suggestionsMap, getCategoryId) {
  useEffect(() => {
    if (!editor) return;

    // Add keyboard shortcuts for markdown formatting
    const boldCommand = editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB,
      () => {
        // Trigger bold formatting
        const toolbarButton = document.querySelector('[title="Bold (Ctrl+B)"]');
        if (toolbarButton) toolbarButton.click();
      }
    );

    const italicCommand = editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI,
      () => {
        // Trigger italic formatting
        const toolbarButton = document.querySelector('[title="Italic (Ctrl+I)"]');
        if (toolbarButton) toolbarButton.click();
      }
    );

    const quickFixCommand = editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.US_DOT, // Ctrl + .
      () => {
        editor.trigger('', 'editor.action.quickFix', {});
      }
    );

    // Add comment toggle for code blocks
    const commentCommand = editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, // Ctrl + /
      () => {
        CommentService.handleCommentToggle(editor);
      }
    );

    // Register quick fix actions for spell check
    registerQuickFixActions(editor, suggestionsMap, getCategoryId);

    // Expose for debugging
    window.CommentService = CommentService;
    window.testCommentToggle = () => {
      console.log('Testing comment toggle...');
      CommentService.handleCommentToggle(editor);
    };

    // Cleanup function - dispose commands when editor or dependencies change
    return () => {
      // Note: Monaco commands are automatically disposed when the editor is disposed
      // But we could manually dispose them here if needed
    };
  }, [editor, suggestionsMap, getCategoryId]);
}
