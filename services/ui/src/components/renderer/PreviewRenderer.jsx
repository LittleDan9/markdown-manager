/**
 * PreviewRenderer - React wrapper for our MarkdownRenderer
 *
 * This component wraps our existing MarkdownRenderer.js in a React-friendly way
 * while maintaining proper scroll synchronization and cursor following.
 */
import React, { useEffect, useRef, useCallback } from 'react';
import morphdom from 'morphdom';
import { applyCachedImages } from '../../services/rendering/MarkdownRenderer';

const PreviewRenderer = ({ htmlContent, className, onRef, scrollToLine }) => {
  const containerRef = useRef(null);
  const lastHtmlRef = useRef('');
  const lastScrollLineRef = useRef(null);
  const scrollTimeoutRef = useRef(null);

  // Set up the ref callback
  useEffect(() => {
    if (onRef && containerRef.current) {
      onRef(containerRef.current);
    }
  }, [onRef]);

  // Handle scroll to line functionality
  const scrollToLineElement = useCallback((lineNumber) => {
    if (!containerRef.current || !lineNumber) return;

    // Clear any pending scroll
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Skip if we're already at the right line
    if (lastScrollLineRef.current === lineNumber) {
      return;
    }

    // Find the element for this line
    scrollTimeoutRef.current = setTimeout(() => {
      if (!containerRef.current) return;

      let el = containerRef.current.querySelector(`[data-line='${lineNumber}']`);

      if (!el) {
        // Try to find a header with the matching line number
        const headers = containerRef.current.querySelectorAll('h1, h2, h3, h4, h5, h6');
        for (const header of headers) {
          const lineAttr = header.getAttribute('data-line');
          if (lineAttr && parseInt(lineAttr) === lineNumber) {
            el = header;
            break;
          }
        }

        // Check if cursor is inside a block with a line range (e.g., Mermaid diagram, code block)
        if (!el) {
          const rangeElements = containerRef.current.querySelectorAll('[data-line][data-line-end]');
          for (const element of rangeElements) {
            const start = parseInt(element.getAttribute('data-line'));
            const end = parseInt(element.getAttribute('data-line-end'));
            if (lineNumber >= start && lineNumber <= end) {
              el = element;
              break;
            }
          }
        }

        // If still not found, find closest element
        if (!el) {
          const allElements = containerRef.current.querySelectorAll('[data-line]');
          let closestElement = null;
          let closestDistance = Infinity;

          for (const element of allElements) {
            const lineAttr = element.getAttribute('data-line');
            if (lineAttr) {
              const distance = Math.abs(parseInt(lineAttr) - lineNumber);
              if (distance < closestDistance) {
                closestDistance = distance;
                closestElement = element;
              }
            }
          }
          el = closestElement;
        }
      }

      if (el) {
        // Check if element is already reasonably visible to avoid unnecessary scrolling during typing
        const rect = el.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();

        // For Mermaid diagrams / tall blocks, check if ANY part is visible
        const isMermaidOrBlock = el.classList.contains('mermaid') || el.hasAttribute('data-line-end');
        if (isMermaidOrBlock) {
          const isAnyPartVisible = rect.bottom > containerRect.top && rect.top < containerRect.bottom;
          if (!isAnyPartVisible) {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            console.log(`📍 Scrolled to line ${lineNumber} (block/diagram, nearest)`);
          } else {
            console.log(`📍 Line ${lineNumber} diagram already visible, no scroll needed`);
          }
        } else {
          const isInTopHalf = rect.top >= containerRect.top && rect.top <= (containerRect.top + containerRect.height / 2);
          // Only scroll if the element is not in the top half of the viewport
          if (!isInTopHalf) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            console.log(`📍 Scrolled to line ${lineNumber} (positioned at top)`);
          } else {
            console.log(`📍 Line ${lineNumber} already visible, no scroll needed`);
          }
        }

        lastScrollLineRef.current = lineNumber;
      } else {
        console.log(`Could not find element for line ${lineNumber}`);
      }
    }, 50); // Reduced from 300ms to 50ms for more responsive cursor following
  }, []);

  // Handle HTML content updates using DOM morphing (no full DOM teardown)
  useEffect(() => {
    if (!containerRef.current) return;

    // Check if htmlContent is defined (could be empty string for cleared documents)
    if (htmlContent === undefined || htmlContent === null) return;

    // Skip update if content hasn't changed
    if (htmlContent === lastHtmlRef.current) return;

    const container = containerRef.current;
    const isFirstRender = lastHtmlRef.current === '';

    lastHtmlRef.current = htmlContent;

    if (isFirstRender || htmlContent === '') {
      // First render or clearing: use innerHTML for clean setup
      container.innerHTML = htmlContent;
    } else {
      // Subsequent updates: morph the DOM in place, preserving unchanged nodes
      // Wrap in a temporary container so morphdom can diff children
      const wrapper = document.createElement('div');
      wrapper.innerHTML = htmlContent;

      morphdom(container, wrapper, {
        childrenOnly: true,
        // Preserve loaded images by skipping updates to img elements whose
        // src hasn't changed at the attribute level
        onBeforeElUpdated(fromEl, toEl) {
          if (fromEl.tagName === 'IMG' && toEl.tagName === 'IMG') {
            // If the image is fully loaded and the logical source matches,
            // keep the existing DOM node entirely to avoid re-fetch/re-paint
            const fromKey = fromEl.getAttribute('data-original-src')
              || fromEl.getAttribute('data-auth-url')
              || fromEl.getAttribute('src');
            const toKey = toEl.getAttribute('data-original-src')
              || toEl.getAttribute('data-auth-url')
              || toEl.getAttribute('src');
            if (fromKey === toKey && fromEl.complete && fromEl.naturalWidth > 0) {
              return false; // skip update — keep existing loaded image node
            }
          }
          return true; // proceed with update for all other elements
        },
      });
    }

    // Apply cached images for any newly inserted image elements
    applyCachedImages(container).catch(error => {
      console.warn('Failed to apply cached images:', error);
    });

  }, [htmlContent]);

  // Handle scroll to line when line changes
  useEffect(() => {
    if (scrollToLine && htmlContent) {
      scrollToLineElement(scrollToLine);
    }
  }, [scrollToLine, htmlContent, scrollToLineElement]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        overflowY: 'auto',
        height: '100%'
      }}
    />
  );
};

export default PreviewRenderer;