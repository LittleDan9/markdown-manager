import { useEffect, useRef, useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import { useUserSettings } from '@/providers/UserSettingsProvider';

/**
 * InvisibleResizer - Adds invisible resize functionality to the existing layout
 * Creates a draggable area between editor and preview without visual changes
 */
function InvisibleResizer({ fullscreenPreview = false }) {
  const { editorWidthPercentage, updateEditorWidth: updateEditorWidthSetting } = useUserSettings();
  const [localEditorWidth, setLocalEditorWidth] = useState(editorWidthPercentage);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startEditorWidth = useRef(0);

  // Debug logging for fullscreen changes
  useEffect(() => {
    console.log('InvisibleResizer: fullscreenPreview changed to:', fullscreenPreview);
    console.log('InvisibleResizer: Current editorWidthPercentage:', editorWidthPercentage);
    console.log('InvisibleResizer: Current localEditorWidth:', localEditorWidth);
  }, [fullscreenPreview, editorWidthPercentage, localEditorWidth]);

  // Sync local state with user settings
  useEffect(() => {
    setLocalEditorWidth(editorWidthPercentage);
  }, [editorWidthPercentage]);

  // Apply current user settings to the layout
  useEffect(() => {
    const editorContainer = document.getElementById('editorContainer');
    const previewContainer = document.getElementById('previewContainer');
    const mainContainer = document.getElementById('main');

    if (editorContainer && previewContainer) {
      // Apply or remove custom widths based on fullscreen state and screen size
      const applyCustomWidths = () => {
        console.log('InvisibleResizer: applyCustomWidths called');
        console.log('InvisibleResizer: Applying styles, fullscreenPreview:', fullscreenPreview, 'windowWidth:', window.innerWidth);
        console.log('InvisibleResizer: editorContainer exists:', !!editorContainer);
        console.log('InvisibleResizer: previewContainer exists:', !!previewContainer);

        if (fullscreenPreview) {
          // In fullscreen mode, remove all custom styles to let CSS take over
          console.log('InvisibleResizer: Removing custom styles for fullscreen - CSS will handle it');
          editorContainer.style.removeProperty('flex');
          previewContainer.style.removeProperty('flex');
          editorContainer.style.removeProperty('width');
          previewContainer.style.removeProperty('width');
          editorContainer.style.removeProperty('padding');
          editorContainer.style.removeProperty('border');
          editorContainer.style.removeProperty('overflow');
          previewContainer.style.removeProperty('padding');
          previewContainer.style.removeProperty('border-radius');
          previewContainer.style.removeProperty('box-shadow');
        } else if (window.innerWidth > 768) {
          // Apply custom widths for normal split view on desktop
          console.log('InvisibleResizer: Applying custom widths:', localEditorWidth + '%');
          editorContainer.style.setProperty('flex', `0 1 ${localEditorWidth}%`, 'important');
          previewContainer.style.setProperty('flex', `0 1 ${100 - localEditorWidth}%`, 'important');
          editorContainer.style.setProperty('width', `${localEditorWidth}%`, 'important');
          previewContainer.style.setProperty('width', `${100 - localEditorWidth}%`, 'important');

          // Ensure other properties are reset in case they were set previously
          editorContainer.style.removeProperty('padding');
          editorContainer.style.removeProperty('border');
          editorContainer.style.removeProperty('overflow');
          previewContainer.style.removeProperty('border-radius');
          previewContainer.style.removeProperty('box-shadow');
        } else {
          // Remove custom styles to let responsive CSS take over (mobile)
          console.log('InvisibleResizer: Removing custom styles for mobile');
          editorContainer.style.removeProperty('flex');
          previewContainer.style.removeProperty('flex');
          editorContainer.style.removeProperty('width');
          previewContainer.style.removeProperty('width');
          editorContainer.style.removeProperty('padding');
          editorContainer.style.removeProperty('border');
          editorContainer.style.removeProperty('overflow');
          previewContainer.style.removeProperty('border-radius');
          previewContainer.style.removeProperty('box-shadow');

          // Log current computed styles after removal
          console.log('InvisibleResizer: After removal - editor computed style:', window.getComputedStyle(editorContainer).width);
          console.log('InvisibleResizer: After removal - preview computed style:', window.getComputedStyle(previewContainer).width);

          // Log main container class
          if (mainContainer) {
            console.log('InvisibleResizer: Main container classes:', mainContainer.className);
          }
        }
      };

      applyCustomWidths();

      // Listen for window resize to adapt to responsive breakpoints
      window.addEventListener('resize', applyCustomWidths);

      // Apply styles again after a short delay to ensure they're not overridden
      const delayedApply = setTimeout(applyCustomWidths, 100);

      return () => {
        window.removeEventListener('resize', applyCustomWidths);
        clearTimeout(delayedApply);
      };
    }
  }, [localEditorWidth, fullscreenPreview]); // Added fullscreenPreview as dependency

  // Update editor width percentage
  const updateEditorWidth = useCallback(async (widthPercentage) => {
    // Validate input
    const clampedWidth = Math.max(15, Math.min(85, Math.round(widthPercentage)));

    // Try to save to backend if authenticated, but don't block if not
    if (typeof updateEditorWidthSetting === 'function') {
      try {
        await updateEditorWidthSetting(clampedWidth);
        console.log('Editor width updated to:', clampedWidth);
      } catch (error) {
        console.warn('Failed to save editor width preference:', error);
        // Continue anyway - local state is updated
      }
    }

    // Dispatch custom event for components that need to react to width changes
    window.dispatchEvent(new CustomEvent('editor-width-changed', {
      detail: { width: clampedWidth }
    }));
  }, [updateEditorWidthSetting]);

  // Handle mouse down on the gap area
  const handleMouseDown = useCallback((e) => {
    // Don't start dragging in fullscreen mode
    if (fullscreenPreview) return;

    isDragging.current = true;
    startX.current = e.clientX;
    startEditorWidth.current = localEditorWidth;

    console.log('Drag started:', {
      startX: e.clientX,
      startEditorWidth: localEditorWidth
    });

    // Add dragging class for styling
    const mainContainer = document.getElementById('main');
    if (mainContainer) {
      mainContainer.classList.add('resizing');
    }

    // Prevent text selection during drag
    e.preventDefault();
  }, [localEditorWidth, fullscreenPreview]);

  // Handle mouse move during drag
  const handleMouseMove = useCallback((e) => {
    if (!isDragging.current || fullscreenPreview) return;

    const mainContainer = document.getElementById('main');
    if (!mainContainer) return;

    const containerRect = mainContainer.getBoundingClientRect();
    const containerWidth = containerRect.width;

    // Calculate the change in position as a percentage
    const deltaX = e.clientX - startX.current;
    const deltaPercentage = (deltaX / containerWidth) * 100;

    // Calculate new editor width percentage
    let newEditorWidth = startEditorWidth.current + deltaPercentage;

    // Clamp between 15% and 85%
    newEditorWidth = Math.max(15, Math.min(85, newEditorWidth));

    // Debug logging
    console.log('Drag move:', {
      deltaX,
      deltaPercentage,
      startWidth: startEditorWidth.current,
      newWidth: newEditorWidth,
      mouseX: e.clientX,
      startX: startX.current
    });

    // Apply immediately for smooth dragging (only on desktop and not fullscreen)
    if (window.innerWidth > 768) {
      const editorContainer = document.getElementById('editorContainer');
      const previewContainer = document.getElementById('previewContainer');

      if (editorContainer && previewContainer) {
        // Apply to both container and any parent wrapper elements
        editorContainer.style.setProperty('flex', `0 1 ${newEditorWidth}%`, 'important');
        previewContainer.style.setProperty('flex', `0 1 ${100 - newEditorWidth}%`, 'important');

        // Also apply width styles to override any CSS width constraints
        editorContainer.style.setProperty('width', `${newEditorWidth}%`, 'important');
        previewContainer.style.setProperty('width', `${100 - newEditorWidth}%`, 'important');

        // Check for wrapper elements and apply styles to them too
        const editorParent = editorContainer.parentElement;
        const previewParent = previewContainer.parentElement;

        if (editorParent && editorParent.classList.contains('editor-wrapper')) {
          editorParent.style.setProperty('width', `${newEditorWidth}%`, 'important');
          editorParent.style.setProperty('flex', `0 1 ${newEditorWidth}%`, 'important');
        }

        if (previewParent && previewParent.classList.contains('renderer-wrapper')) {
          previewParent.style.setProperty('width', `${100 - newEditorWidth}%`, 'important');
          previewParent.style.setProperty('flex', `0 1 ${100 - newEditorWidth}%`, 'important');
        }

        console.log('Applied flex styles:', {
          editor: `0 1 ${newEditorWidth}%`,
          preview: `0 1 ${100 - newEditorWidth}%`,
          editorWidth: `${newEditorWidth}%`,
          previewWidth: `${100 - newEditorWidth}%`
        });
      }

      // Update local state for immediate feedback
      setLocalEditorWidth(newEditorWidth);
    }
  }, [fullscreenPreview]);

  // Handle mouse up - end drag and save settings
  const handleMouseUp = useCallback(() => {
    if (!isDragging.current) return;

    isDragging.current = false;

    // Remove dragging class
    const mainContainer = document.getElementById('main');
    if (mainContainer) {
      mainContainer.classList.remove('resizing');
    }

    // Save final width to backend if possible (only on desktop)
    if (window.innerWidth > 768) {
      updateEditorWidth(localEditorWidth);
    }
  }, [localEditorWidth, updateEditorWidth]);

  // Set up global mouse event listeners
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Add resize cursor to the gap between editor and preview
  useEffect(() => {
    const addResizeCursor = () => {
      const editorContainer = document.getElementById('editorContainer');
      const previewContainer = document.getElementById('previewContainer');

      if (editorContainer && previewContainer) {
        // Create a simple resize area in the gap between containers
        const style = document.createElement('style');
        style.textContent = `
          @media (min-width: 769px) {
            #editorContainer {
              position: relative;
            }

            #previewContainer {
              position: relative;
            }

            /* Create a precise resize handle that only appears in the gap */
            .resize-handle {
              position: absolute;
              top: 0;
              right: -3px;
              width: 6px;
              height: 100%;
              cursor: col-resize;
              z-index: 1000;
              background-color: transparent;
              transition: background-color 0.2s ease;
              pointer-events: auto;
              display: ${fullscreenPreview ? 'none' : 'block'};
            }

            /* Only show highlight on hover of the specific handle */
            .resize-handle:hover {
              background-color: rgba(0, 123, 255, 0.3);
            }

            /* Show different highlight during dragging */
            .resize-handle.dragging {
              background-color: rgba(0, 123, 255, 0.2) !important;
            }
          }

          #main.resizing {
            user-select: none;
            cursor: col-resize;
          }

          #main.resizing * {
            cursor: col-resize !important;
          }
        `;

        document.head.appendChild(style);

        // Create the actual resize handle element only if not in fullscreen mode
        if (!fullscreenPreview) {
          const resizeHandle = document.createElement('div');
          resizeHandle.className = 'resize-handle';
          resizeHandle.id = 'resize-handle';
          editorContainer.appendChild(resizeHandle);

          // Mouse event handlers specifically for the resize handle
          const handleResizeMouseDown = (e) => {
            console.log('Resize handle clicked at:', e.clientX);
            resizeHandle.classList.add('dragging');
            handleMouseDown(e);
          };

          const handleResizeMouseUp = () => {
            resizeHandle.classList.remove('dragging');
          };

          // Add event listeners to the resize handle only
          resizeHandle.addEventListener('mousedown', handleResizeMouseDown);
          document.addEventListener('mouseup', handleResizeMouseUp);

          return () => {
            document.head.removeChild(style);
            document.removeEventListener('mouseup', handleResizeMouseUp);
            if (resizeHandle && resizeHandle.parentNode) {
              resizeHandle.parentNode.removeChild(resizeHandle);
            }
          };
        } else {
          // In fullscreen mode, just cleanup styles when component unmounts
          return () => {
            document.head.removeChild(style);
          };
        }
      }
    };

    // Wait for containers to be available
    const timer = setTimeout(addResizeCursor, 100);
    return () => clearTimeout(timer);
  }, [handleMouseDown, fullscreenPreview]); // Added fullscreenPreview as dependency

  // This component renders nothing - it just adds behavior
  return null;
}

InvisibleResizer.propTypes = {
  fullscreenPreview: PropTypes.bool,
};

export default InvisibleResizer;