import { useState, useEffect, useRef } from 'react';
import { useDocumentContext } from '../../providers/DocumentContextProvider';
import { extractHeadings, buildHeadingTree } from '../../services/rendering/HeadingExtractor';

/**
 * useDocumentOutline - Manages document heading outline state.
 * Extracts headings from content, builds tree, tracks active heading.
 * Subscribes to cursorLine from DocumentContext for active heading tracking.
 */
export default function useDocumentOutline() {
  const { content, cursorLine } = useDocumentContext();
  const [headings, setHeadings] = useState([]);
  const [headingTree, setHeadingTree] = useState([]);
  const [activeHeadingLine, setActiveHeadingLine] = useState(null);
  const debounceRef = useRef(null);

  // Extract headings when content changes (debounced)
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      const extracted = extractHeadings(content);
      setHeadings(extracted);
      setHeadingTree(buildHeadingTree(extracted));
    }, 200);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [content]);

  // Update active heading based on cursor position from context
  useEffect(() => {
    if (!headings.length) {
      setActiveHeadingLine(null);
      return;
    }

    let active = null;
    for (const heading of headings) {
      if (heading.line <= cursorLine) {
        active = heading.line;
      } else {
        break;
      }
    }
    setActiveHeadingLine(active);
  }, [cursorLine, headings]);

  return {
    headings,
    headingTree,
    activeHeadingLine,
    hasHeadings: headings.length > 0,
  };
}
