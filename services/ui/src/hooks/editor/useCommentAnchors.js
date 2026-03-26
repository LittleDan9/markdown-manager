import { useCallback, useRef } from 'react';

/**
 * useCommentAnchors — Utilities for creating and resolving Yjs-based comment anchors.
 *
 * In collab mode: creates Y.RelativePosition anchors that survive concurrent edits.
 * In solo mode: falls back to plain line numbers.
 *
 * @param {import('yjs').Doc|null} ydoc
 * @param {import('yjs').Text|null} ytext
 * @param {boolean} collabActive
 */
export default function useCommentAnchors(ydoc, ytext, collabActive) {
  const yjsRef = useRef(null);

  // Lazily load Yjs module
  const getYjs = useCallback(async () => {
    if (!yjsRef.current) {
      yjsRef.current = await import('yjs');
    }
    return yjsRef.current;
  }, []);

  /**
   * Create an anchor at a character index in the Y.Text.
   * Returns { anchorYpos: string (base64), anchorText: string } or null.
   */
  const createAnchor = useCallback(async (charIndex) => {
    if (!collabActive || !ydoc || !ytext) return null;

    try {
      const Y = await getYjs();
      const relPos = Y.createRelativePositionFromTypeIndex(ytext, charIndex);
      const encoded = Y.encodeRelativePosition(relPos);
      const anchorYpos = btoa(String.fromCharCode(...encoded));

      // Capture surrounding text snippet (up to 40 chars around the anchor)
      const fullText = ytext.toString();
      const start = Math.max(0, charIndex - 20);
      const end = Math.min(fullText.length, charIndex + 20);
      const anchorText = fullText.slice(start, end);

      return { anchorYpos, anchorText };
    } catch {
      return null;
    }
  }, [collabActive, ydoc, ytext, getYjs]);

  /**
   * Resolve a base64 anchor_ypos to a current character index.
   * Returns the integer index or null if the anchor can't be resolved.
   */
  const resolveAnchor = useCallback(async (anchorYposBase64) => {
    if (!collabActive || !ydoc || !ytext || !anchorYposBase64) return null;

    try {
      const Y = await getYjs();
      const bytes = Uint8Array.from(atob(anchorYposBase64), c => c.charCodeAt(0));
      const relPos = Y.decodeRelativePosition(bytes);
      const absPos = Y.createAbsolutePositionFromRelativePosition(relPos, ydoc);
      return absPos ? absPos.index : null;
    } catch {
      return null;
    }
  }, [collabActive, ydoc, ytext, getYjs]);

  /**
   * Convert a character index to a 1-based line number.
   */
  const indexToLine = useCallback((charIndex, content) => {
    if (charIndex == null || !content) return null;
    const before = content.slice(0, charIndex);
    return before.split('\n').length;
  }, []);

  /**
   * Convert a 1-based line number to a character index (start of line).
   */
  const lineToIndex = useCallback((lineNumber, content) => {
    if (!lineNumber || !content) return null;
    const lines = content.split('\n');
    let idx = 0;
    for (let i = 0; i < Math.min(lineNumber - 1, lines.length); i++) {
      idx += lines[i].length + 1; // +1 for \n
    }
    return idx;
  }, []);

  /**
   * Create an anchor from a 1-based line number.
   */
  const createAnchorFromLine = useCallback(async (lineNumber, content) => {
    if (!collabActive) return null;
    const charIndex = lineToIndex(lineNumber, content);
    if (charIndex == null) return null;
    return createAnchor(charIndex);
  }, [collabActive, lineToIndex, createAnchor]);

  return {
    createAnchor,
    createAnchorFromLine,
    resolveAnchor,
    indexToLine,
    lineToIndex,
  };
}
