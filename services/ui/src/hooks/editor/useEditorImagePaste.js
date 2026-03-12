import { useEffect, useCallback, useRef } from 'react';
import { useImageManagement } from '@/hooks/image/useImageManagement';

const UPLOAD_TIMEOUT_MS = 30000;

/**
 * Generate a unique marker ID for tracking placeholders across async gaps.
 * Uses HTML comment syntax so it's invisible in rendered markdown.
 */
function generateMarkerId() {
  const rand = Math.random().toString(36).substring(2, 8);
  const ts = Date.now().toString(36);
  return `img-upload-${ts}-${rand}`;
}

/**
 * Generate a unique filename for clipboard images to avoid backend dedup collisions.
 */
function generateClipboardFilename() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const rand = Math.random().toString(36).substring(2, 6);
  return `clipboard_${ts}_${rand}.png`;
}

/**
 * Build the loading placeholder text that includes a searchable marker.
 */
function buildPlaceholder(markerId) {
  return `<!-- ${markerId} -->![Uploading image...]()`;
}

/**
 * Find a marker's range in the editor model using findMatches.
 * Returns the full placeholder range (marker comment + image syntax), or null.
 */
function findPlaceholderRange(editor, markerId) {
  const model = editor.getModel();
  if (!model) return null;

  const searchText = `<!-- ${markerId} -->![Uploading image...]()`;
  const matches = model.findMatches(searchText, false, false, true, null, false);
  if (matches.length > 0) {
    return matches[0].range;
  }
  return null;
}

/**
 * Replace a tracked placeholder with new text, found by marker ID.
 * Returns true if replacement succeeded.
 */
function replacePlaceholder(editor, markerId, newText) {
  const range = findPlaceholderRange(editor, markerId);
  if (!range) {
    console.warn(`⚠️ Could not find placeholder for marker ${markerId} — it may have been manually deleted`);
    return false;
  }
  editor.executeEdits('paste-image-complete', [{ range, text: newText }]);
  return true;
}

/**
 * Hook for handling image paste and drop functionality in Monaco editor.
 * Uses unique HTML comment markers to track placeholders across async gaps,
 * eliminating stale-coordinate bugs when multiple pastes or edits occur
 * during upload.
 *
 * @param {Object} editor - Monaco editor instance
 * @param {boolean} enabled - Whether image paste is enabled
 * @returns {Object} Image paste/drop state and handlers
 */
export default function useEditorImagePaste(editor, enabled = true) {
  const { uploadImageFile, generateMarkdown } = useImageManagement();
  const activeUploadsRef = useRef(new Map()); // markerId -> AbortController

  /**
   * Core upload pipeline shared by paste and drop.
   * Inserts a tracked placeholder, uploads, then replaces placeholder with result.
   * @param {File} imageFile - The image File/Blob to upload
   * @param {Object} [insertionSelection] - Optional Monaco selection for insertion point
   */
  const processImageUpload = useCallback(async (imageFile, insertionSelection) => {
    if (!editor || !enabled) return;

    const selection = insertionSelection || editor.getSelection();
    if (!selection) return;

    const markerId = generateMarkerId();
    const placeholder = buildPlaceholder(markerId);
    const filename = generateClipboardFilename();

    // Insert placeholder at cursor/drop position
    editor.executeEdits('paste-image-loading', [{ range: selection, text: placeholder }]);

    // Set up abort controller for cancellation
    const abortController = new AbortController();
    activeUploadsRef.current.set(markerId, abortController);

    // Set up timeout
    const timeoutId = setTimeout(() => {
      abortController.abort();
      console.warn(`⏱️ Image upload timed out after ${UPLOAD_TIMEOUT_MS / 1000}s (marker: ${markerId})`);
    }, UPLOAD_TIMEOUT_MS);

    try {
      const result = await uploadImageFile(imageFile, filename, {
        optimizeForPdf: true,
        createThumbnail: true,
        signal: abortController.signal
      });

      clearTimeout(timeoutId);

      if (result && result.image) {
        const markdown = generateMarkdown(result.image, 'Pasted Image', '');
        const replaced = replacePlaceholder(editor, markerId, markdown);
        if (replaced) {
          console.log('✅ Image pasted successfully:', result.image.filename);
        }
      } else {
        replacePlaceholder(editor, markerId, '<!-- image upload returned no data -->');
      }
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError' || abortController.signal.aborted) {
        console.log('🚫 Image upload cancelled (marker:', markerId, ')');
        replacePlaceholder(editor, markerId, '');
      } else {
        console.error('Failed to handle image upload:', error);
        replacePlaceholder(editor, markerId, '<!-- image upload failed -->');
      }
    } finally {
      activeUploadsRef.current.delete(markerId);
      editor.focus();
    }
  }, [editor, enabled, uploadImageFile, generateMarkdown]);

  /**
   * Cancel all in-flight image uploads (e.g., on Escape key).
   */
  const cancelAllUploads = useCallback(() => {
    for (const [markerId, controller] of activeUploadsRef.current) {
      controller.abort();
      console.log('🚫 Cancelled upload:', markerId);
    }
  }, []);

  // Attach paste and drop event listeners to editor DOM
  useEffect(() => {
    if (!editor || !enabled) return;

    const editorDomNode = editor.getDomNode();
    if (!editorDomNode) return;

    // --- Paste handler ---
    // Must be on document capture phase to fire BEFORE Monaco's internal
    // CopyPasteController. If Monaco sees an image paste event, it corrupts
    // its internal state machine and throws "Canceled" errors on subsequent pastes.
    const pasteHandler = (event) => {
      // Only intercept when editor has focus
      if (!editor.hasTextFocus()) return;

      const items = event.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          // Extract file synchronously before async gap
          const file = items[i].getAsFile();
          if (!file) continue;

          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          processImageUpload(file);
          return; // Handle first image only
        }
      }
    };

    // --- Drop handler ---
    const dropHandler = (event) => {
      const files = event.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
      if (imageFiles.length === 0) return;

      event.preventDefault();
      event.stopPropagation();

      // Determine drop position in editor
      const target = editor.getTargetAtClientPoint(event.clientX, event.clientY);
      let dropSelection = editor.getSelection();
      if (target?.position) {
        const pos = target.position;
        dropSelection = {
          startLineNumber: pos.lineNumber,
          startColumn: pos.column,
          endLineNumber: pos.lineNumber,
          endColumn: pos.column
        };
      }

      // Upload each dropped image file
      imageFiles.forEach((file, index) => {
        // Offset insertion for multiple files to avoid same position
        const sel = index === 0 ? dropSelection : editor.getSelection();
        processImageUpload(file, sel);
      });
    };

    const dragOverHandler = (event) => {
      // Check if dragged items include images
      if (event.dataTransfer?.types?.includes('Files')) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }
    };

    // --- Escape key to cancel uploads ---
    const keydownHandler = editor.onKeyDown((e) => {
      if (e.keyCode === 9 /* Escape */ && activeUploadsRef.current.size > 0) {
        cancelAllUploads();
      }
    });

    // Paste on document capture (must be before Monaco's internal handler)
    document.addEventListener('paste', pasteHandler, true);
    // Drop/dragover on editor DOM node (Monaco doesn't have conflicting drop handlers)
    editorDomNode.addEventListener('drop', dropHandler, true);
    editorDomNode.addEventListener('dragover', dragOverHandler, true);

    return () => {
      document.removeEventListener('paste', pasteHandler, true);
      editorDomNode.removeEventListener('drop', dropHandler, true);
      editorDomNode.removeEventListener('dragover', dragOverHandler, true);
      if (keydownHandler?.dispose) keydownHandler.dispose();
    };
  }, [editor, enabled, processImageUpload, cancelAllUploads]);

  // Clean up in-flight uploads on unmount
  useEffect(() => {
    return () => {
      for (const [, controller] of activeUploadsRef.current) {
        controller.abort();
      }
      activeUploadsRef.current.clear();
    };
  }, []);

  return {
    processImageUpload,
    cancelAllUploads,
    activeUploads: activeUploadsRef
  };
}