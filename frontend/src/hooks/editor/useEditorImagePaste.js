import { useEffect, useCallback } from 'react';
import { useImageManagement } from '@/hooks/image/useImageManagement';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

/**
 * Hook for handling image paste functionality in Monaco editor
 * @param {Object} editor - Monaco editor instance
 * @param {boolean} enabled - Whether image paste is enabled
 * @returns {Object} Image paste handlers
 */
export default function useEditorImagePaste(editor, enabled = true) {
  const { handlePasteImage, generateMarkdown } = useImageManagement();

  const handlePaste = useCallback(async (event) => {
    if (!editor || !enabled) return;

    try {
      const result = await handlePasteImage(event, {
        optimizeForPdf: true,
        createThumbnail: true
      });

      if (result && result.image) {
        // Insert the image markdown at the current cursor position
        const selection = editor.getSelection();
        const markdown = generateMarkdown(result.image, 'Pasted Image', '');

        if (selection) {
          editor.executeEdits('paste-image', [{
            range: selection,
            text: markdown
          }]);
        }

        // Focus back to editor
        editor.focus();
      }
    } catch (error) {
      console.error('Failed to handle pasted image:', error);
    }
  }, [editor, enabled, handlePasteImage, generateMarkdown]);

  // Attach paste event listener to editor
  useEffect(() => {
    if (!editor || !enabled) return;

    const editorDomNode = editor.getDomNode();
    if (!editorDomNode) return;

    // Add paste event listener
    const pasteHandler = (event) => {
      // Check if clipboard contains image data
      const items = event.clipboardData?.items;

      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith('image/')) {
            event.preventDefault(); // Prevent default paste behavior
            event.stopPropagation(); // Stop event from bubbling
            event.stopImmediatePropagation(); // Stop other handlers from running
            handlePaste(event);
            break;
          }
        }
      }
    };

    // Try multiple approaches to ensure we capture the event
    // 1. On the document for broader coverage
    document.addEventListener('paste', pasteHandler, true);

    // 2. On the editor DOM node as well
    editorDomNode.addEventListener('paste', pasteHandler, true);

    // 3. Also try on the container's parent to catch events higher up
    const container = editorDomNode.closest('.monaco-container');
    if (container) {
      container.addEventListener('paste', pasteHandler, true);
    }

    // 4. Try adding a keyboard listener as another approach
    let keyboardListener = null;
    try {
      keyboardListener = editor.onKeyDown((e) => {
        // Check for Ctrl+V (or Cmd+V on Mac)
        if ((e.ctrlKey || e.metaKey) && e.keyCode === monaco.KeyCode.KeyV) {
          // Don't prevent default here, let the paste event handlers deal with it
        }
      });
    } catch (error) {
      // Silently handle keyboard listener errors
    }

    return () => {
      document.removeEventListener('paste', pasteHandler, true);
      editorDomNode.removeEventListener('paste', pasteHandler, true);
      if (container) {
        container.removeEventListener('paste', pasteHandler, true);
      }
      if (keyboardListener && keyboardListener.dispose) {
        keyboardListener.dispose();
      }
    };
  }, [editor, enabled, handlePaste]);

  return {
    handlePaste
  };
}