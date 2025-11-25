/**
 * ScrollHandler - Manages scroll functionality for the preview
 *
 * This component handles scroll-to-line functionality and other
 * scroll-related operations in the preview pane.
 */
import React, { useEffect, useRef } from 'react';
import { useRendererContext } from './RendererContext';
import { useDocumentContext } from '../../providers/DocumentContextProvider';

const ScrollHandler = ({ scrollToLine }) => {
  const { previewScrollRef } = useRendererContext();
  const { previewHTML, isRendering } = useDocumentContext();
  const lastScrollLineRef = useRef(null);
  const scrollTimeoutRef = useRef(null);

  // Handle scroll to line functionality with debouncing
  useEffect(() => {
    if (scrollToLine && previewScrollRef.current && !isRendering && previewHTML) {
      // Clear any pending scroll
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Skip if we're already at the right line (avoid unnecessary scrolling)
      if (lastScrollLineRef.current === scrollToLine) {
        return;
      }

      // Debounce scroll operations to prevent jumping during rapid cursor movements
      scrollTimeoutRef.current = setTimeout(() => {
        // Double-check that we still have valid references after the delay
        if (!previewScrollRef.current) return;

        let el = previewScrollRef.current?.querySelector(`[data-line='${scrollToLine}']`);

        if (!el) {
          // Try to find a header with the matching line number
          const headers = previewScrollRef.current?.querySelectorAll('h1, h2, h3, h4, h5, h6');
          if (headers) {
            for (const header of headers) {
              const lineAttr = header.getAttribute('data-line');
              if (lineAttr && parseInt(lineAttr) === scrollToLine) {
                el = header;
                break;
              }
            }
          }

          // If still not found, try to find any element with a line number close to the target
          if (!el) {
            const allElements = previewScrollRef.current?.querySelectorAll('[data-line]');
            let closestElement = null;
            let closestDistance = Infinity;

            if (allElements) {
              for (const element of allElements) {
                const lineAttr = element.getAttribute('data-line');
                if (lineAttr) {
                  const distance = Math.abs(parseInt(lineAttr) - scrollToLine);
                  if (distance < closestDistance) {
                    closestDistance = distance;
                    closestElement = element;
                  }
                }
              }
            }
            el = closestElement;
          }
        }

        if (el) {
          // Check if the element is already roughly in view to avoid unnecessary scrolling
          const rect = el.getBoundingClientRect();
          const containerRect = previewScrollRef.current.getBoundingClientRect();
          const isInView = rect.top >= containerRect.top && rect.bottom <= containerRect.bottom;

          if (!isInView) {
            // Use 'nearest' instead of 'start' to prevent aggressive jumping
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            console.log(`Scrolled to line ${scrollToLine}`);
          }

          lastScrollLineRef.current = scrollToLine;
        } else {
          console.log(`Could not find element for line ${scrollToLine}`);
        }
      }, 200); // Reduced from 500ms to 200ms since we have scroll preservation
    }

    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [scrollToLine, isRendering, previewHTML, previewScrollRef]);

  // This component doesn't render anything directly
  return null;
};

export default React.memo(ScrollHandler);