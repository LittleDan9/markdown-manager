/**
 * PreviewRenderer - React wrapper for our MarkdownRenderer
 *
 * This component wraps our existing MarkdownRenderer.js in a React-friendly way
 * while maintaining proper scroll synchronization and cursor following.
 */
import React, { useEffect, useRef, useCallback } from 'react';
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
        const isInTopHalf = rect.top >= containerRect.top && rect.top <= (containerRect.top + containerRect.height / 2);

        // Only scroll if the element is not in the top half of the viewport
        if (!isInTopHalf) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          console.log(`📍 Scrolled to line ${lineNumber} (positioned at top)`);
        } else {
          console.log(`📍 Line ${lineNumber} already visible, no scroll needed`);
        }

        lastScrollLineRef.current = lineNumber;
      } else {
        console.log(`Could not find element for line ${lineNumber}`);
      }
    }, 50); // Reduced from 300ms to 50ms for more responsive cursor following
  }, []);

  // Handle HTML content updates with intelligent scroll preservation
  useEffect(() => {
    if (!containerRef.current) return;

    // Check if htmlContent is defined (could be empty string for cleared documents)
    if (htmlContent === undefined || htmlContent === null) return;

    // Skip update if content hasn't changed
    if (htmlContent === lastHtmlRef.current) return;

    const container = containerRef.current;

    // For content changes during typing, use anchor-based scroll preservation
    const shouldPreserveScroll = lastHtmlRef.current !== '' && htmlContent.length > 0;

    let anchorElement = null;
    let anchorOffset = 0;

    if (shouldPreserveScroll) {
      // Find an element that's currently visible to use as an anchor
      const viewportTop = container.scrollTop;
      const viewportBottom = viewportTop + container.clientHeight;

      // Find the first element with data-line that's in the viewport
      const elementsWithLines = container.querySelectorAll('[data-line]');
      for (const element of elementsWithLines) {
        const rect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const elementTop = rect.top - containerRect.top + container.scrollTop;

        if (elementTop >= viewportTop && elementTop <= viewportBottom) {
          anchorElement = element;
          anchorOffset = elementTop - viewportTop; // How far from top of viewport
          break;
        }
      }
    }

    // Update content using innerHTML (this will clear the container if htmlContent is empty)
    container.innerHTML = htmlContent;
    lastHtmlRef.current = htmlContent;

    console.log('PreviewRenderer: Updated HTML content', {
      contentLength: htmlContent.length,
      wasEmpty: htmlContent === '',
      previousLength: lastHtmlRef.current?.length || 0
    });

    // Apply cached images after HTML is inserted
    applyCachedImages(container).catch(error => {
      console.warn('Failed to apply cached images:', error);
    });

    // Restore scroll using anchor element if we found one
    if (shouldPreserveScroll && anchorElement) {
      const dataLine = anchorElement.getAttribute('data-line');
      if (dataLine) {
        // Find the same element in the new DOM
        const newAnchorElement = container.querySelector(`[data-line='${dataLine}']`);
        if (newAnchorElement) {
          const newRect = newAnchorElement.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          const newElementTop = newRect.top - containerRect.top + container.scrollTop;

          // Scroll to maintain the same relative position
          const newScrollTop = newElementTop - anchorOffset;
          container.scrollTop = Math.max(0, newScrollTop);

          console.log(`📍 Anchor-based scroll: line ${dataLine}, offset ${anchorOffset}px`);
        } else {
          console.log(`📄 Content updated, anchor element lost`);
        }
      }
    } else if (!shouldPreserveScroll) {
      console.log(`📄 Content updated, natural scroll behavior`);
    }

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