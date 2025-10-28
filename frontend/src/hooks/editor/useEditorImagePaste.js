import { useEffect, useCallback } from 'react';
import { useImageManagement } from '@/hooks/image/useImageManagement';

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
            handlePaste(event);
            break;
          }
        }
      }
    };

    // Use capture phase to intercept before Monaco processes the event
    editorDomNode.addEventListener('paste', pasteHandler, true);

    return () => {
      editorDomNode.removeEventListener('paste', pasteHandler, true);
    };
  }, [editor, enabled, handlePaste]);

  return {
    handlePaste
  };
}