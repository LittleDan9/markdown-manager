import { useEffect, useRef, useState, useCallback } from 'react';
import { useRendererContext } from '../../components/renderer/RendererContext';
import { useDocumentContext } from '../../providers/DocumentContextProvider';
import { render } from '../../services/rendering/MarkdownRenderer';
import HighlightService from '../../services/editor/HighlightService';

// Render request priorities
const PRIORITY = {
  HIGH: 0,     // User just changed document
  NORMAL: 1,   // Content change
  LOW: 2       // Theme change, etc.
};

// Render states
const RENDER_STATE = {
  IDLE: 'idle',
  QUEUED: 'queued',
  PROCESSING: 'processing',
  HIGHLIGHTING: 'highlighting',
  MERMAID: 'mermaid',
  FINALIZING: 'finalizing',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  ERROR: 'error'
};

export function useRenderingOrchestrator({ theme, onRenderComplete }) {
  const { currentDocument, highlightedBlocks, setHighlightedBlocks, isRendering, setIsRendering, renderState, setRenderState, isRapidTyping, setIsRapidTyping, content } = useDocumentContext();
  const {
    setHtml,
    resetFirstRenderFlag,
    isCropModeActive
  } = useRendererContext();

  // Local state for render queue and active render tracking
  const [renderQueue, setRenderQueue] = useState([]);
  const [activeRender, setActiveRender] = useState(null);

  // Refs for tracking state across renders
  const renderIdRef = useRef(0);
  const lastProcessedContentRef = useRef('');
  const lastProcessedThemeRef = useRef('');
  const cancelTokenRef = useRef(null);
  const lastTypingTimeRef = useRef(0);
  const typingTimerRef = useRef(null);
  const debounceTimeoutRef = useRef(null);
  const lastDocumentIdRef = useRef(null);
  const isFirstRenderRef = useRef(true);
  const renderQueueRef = useRef([]);

  /**
   * Create a new render request with cancellation support
   */
  const createRenderRequest = useCallback((content, theme, priority = PRIORITY.NORMAL, reason = 'content-change') => {
    const renderId = ++renderIdRef.current;
    const cancelToken = { cancelled: false };

    return {
      id: renderId,
      content,
      theme,
      priority,
      reason,
      timestamp: Date.now(),
      cancelToken,
      cancel: () => {
        cancelToken.cancelled = true;
        console.log(`🚫 Render request ${renderId} cancelled (${reason})`);
      }
    };
  }, []);

  /**
   * Add a render request to the queue
   */
  const queueRender = useCallback((content, theme, priority = PRIORITY.NORMAL, reason = 'content-change') => {
    // Don't queue new renders while in crop mode to prevent interruption
    if (isCropModeActive()) {
      console.log(`🚫 Skipping render - crop mode is active`);
      return;
    }

    // Skip if content and theme haven't changed, but only for content-change renders
    // Always allow initial-render and document-change to proceed
    if (reason === 'content-change' &&
        content === lastProcessedContentRef.current &&
        theme === lastProcessedThemeRef.current) {
      console.log(`⏭️ Skipping render - no changes detected (content-change only)`);
      return;
    }

    const request = createRenderRequest(content, theme, priority, reason);

    console.log(`📋 Queuing render request ${request.id}:`, {
      reason,
      priority,
      contentLength: content?.length || 0,
      theme,
      queueLength: renderQueue.length
    });

    setRenderQueue(prev => {
      // Cancel all existing requests when new content arrives
      if (reason === 'content-change' || reason === 'document-change') {
        prev.forEach(req => req.cancel());
        // High priority requests clear the queue
        const newQueue = [request];
        renderQueueRef.current = newQueue;
        return newQueue;
      }

      // Add to queue and sort by priority
      const newQueue = [...prev, request].sort((a, b) => a.priority - b.priority);
      renderQueueRef.current = newQueue;
      return newQueue;
    });
  }, [createRenderRequest, renderQueue.length, isCropModeActive]);

  /**
   * Process the render queue
   * Takes the next valid request and starts processing it
   */
  const processQueue = useCallback(async () => {
    // Don't process if already processing or in crop mode
    // In rapid typing mode, allow processing even when in COMPLETED state
    const canProcess = renderState === RENDER_STATE.IDLE ||
                      (isRapidTyping && renderState === RENDER_STATE.COMPLETED);

    if (!canProcess || isCropModeActive()) {
      console.log(`⏸️ Queue processing paused:`, {
        renderState,
        isCropModeActive: isCropModeActive(),
        isRapidTyping,
        canProcess
      });
      return;
    }

    // Use a ref to get current queue to avoid circular dependency
    setRenderQueue(currentQueue => {
      // Filter out cancelled requests
      const validRequests = currentQueue.filter(req => !req.cancelToken.cancelled);

      if (validRequests.length === 0) {
        console.log(`📭 Queue empty - no requests to process`);
        renderQueueRef.current = [];
        return [];
      }

      const request = validRequests[0];
      const remaining = validRequests.slice(1);

      console.log(`🔄 Processing render request ${request.id}:`, {
        reason: request.reason,
        remaining: remaining.length
      });

      // For rapid typing, process immediately; otherwise use setTimeout to avoid setState during setState
      if (isRapidTyping && request.reason === 'content-change') {
        console.log(`🚀 Rapid typing: Synchronous processing for ${request.id}`);
        // Use microtask to avoid any React state conflicts but still be immediate
        queueMicrotask(() => processRenderRequest(request));
      } else {
        // Start processing this request asynchronously to avoid setState during setState
        setTimeout(() => {
          processRenderRequest(request);
        }, 0);
      }

      renderQueueRef.current = remaining;
      return remaining;
    });
  }, [renderState, isCropModeActive, isRapidTyping]);

  /**
   * Process a single render request through the full pipeline
   */
  const processRenderRequest = useCallback(async (request) => {
    const { id, content, theme, cancelToken, reason } = request;

    try {
      // Set active render and update state
      setActiveRender(request);
      setRenderState(RENDER_STATE.PROCESSING);
      setIsRendering(true);

      // Cancel previous operation if any
      if (cancelTokenRef.current) {
        cancelTokenRef.current.cancelled = true;
      }
      cancelTokenRef.current = cancelToken;

      console.log(`🎬 Starting render ${id} (${reason})`);

      // Check for cancellation
      if (cancelToken.cancelled) {
        throw new Error('cancelled');
      }

      // Step 1: Markdown to HTML conversion
      let htmlString = render(content);
      console.log(`📝 Markdown rendered for ${id}`);

      if (cancelToken.cancelled) throw new Error('cancelled');

      // Step 2: Process syntax highlighting
      setRenderState(RENDER_STATE.HIGHLIGHTING);

      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = htmlString;
      const codeBlocks = Array.from(tempDiv.querySelectorAll("[data-syntax-placeholder]"));
      const blocksToHighlight = [];

      console.log(`🎨 Processing ${codeBlocks.length} code blocks for ${id}`);

      // Get current highlighted blocks
      const currentHighlightedBlocks = highlightedBlocks;

      codeBlocks.forEach(block => {
        const code = decodeURIComponent(block.dataset.code);
        const language = block.dataset.lang;
        const placeholderId = `syntax-highlight-${HighlightService.hashCode(language + code)}`;
        block.setAttribute("data-syntax-placeholder", placeholderId);

        // Use existing highlighted blocks if available
        if (currentHighlightedBlocks[placeholderId]) {
          const codeEl = block.querySelector("code");
          if (codeEl) {
            codeEl.innerHTML = currentHighlightedBlocks[placeholderId];
            block.setAttribute("data-processed", "true");
          }
        } else {
          block.setAttribute("data-processed", "false");
          blocksToHighlight.push({ code, language, placeholderId });
        }
      });

      if (cancelToken.cancelled) throw new Error('cancelled');

      // Highlight new blocks if needed
      if (blocksToHighlight.length > 0) {
        console.log(`✨ Highlighting ${blocksToHighlight.length} new blocks for ${id}`);

        const results = await HighlightService.highlightBlocks(blocksToHighlight);

        if (cancelToken.cancelled) throw new Error('cancelled');

        // Re-process HTML with new highlights
        const updatedTempDiv = document.createElement("div");
        updatedTempDiv.innerHTML = render(content);
        const updatedCodeBlocks = Array.from(updatedTempDiv.querySelectorAll("[data-syntax-placeholder]"));

        updatedCodeBlocks.forEach(block => {
          const code = decodeURIComponent(block.dataset.code);
          const language = block.dataset.lang;
          const placeholderId = `syntax-highlight-${HighlightService.hashCode(language + code)}`;
          block.setAttribute("data-syntax-placeholder", placeholderId);

          // Apply both existing and new highlights
          const highlightedHtml = results[placeholderId] || currentHighlightedBlocks[placeholderId];
          if (highlightedHtml) {
            const codeEl = block.querySelector("code");
            if (codeEl) {
              codeEl.innerHTML = highlightedHtml;
              block.setAttribute("data-processed", "true");
            }
          }
        });

        // Update highlighted blocks state with new highlights only
        const newHighlights = {};
        Object.entries(results).forEach(([id, html]) => {
          if (!currentHighlightedBlocks[id]) {
            newHighlights[id] = html;
          }
        });

        if (Object.keys(newHighlights).length > 0) {
          setHighlightedBlocks(prev => ({ ...prev, ...newHighlights }));
        }

        htmlString = updatedTempDiv.innerHTML;
      } else {
        htmlString = tempDiv.innerHTML;
      }

      if (cancelToken.cancelled) throw new Error('cancelled');

      // Step 3: Finalize render
      setRenderState(RENDER_STATE.FINALIZING);

      console.log(`✅ Render ${id} completed successfully`);

      // Update state and tracking
      setHtml(htmlString);
      lastProcessedContentRef.current = content;
      lastProcessedThemeRef.current = theme;

      setRenderState(RENDER_STATE.COMPLETED);
      setActiveRender(null);

      // Notify completion
      if (onRenderComplete) {
        onRenderComplete(htmlString, { renderId: id, reason });
      }

      // Reset to idle after a brief moment
      setTimeout(() => {
        if (!cancelToken.cancelled) {
          setRenderState(RENDER_STATE.IDLE);
          setIsRendering(false);
        }
      }, 10); // Reduced from 50ms to 10ms for faster state transitions

    } catch (error) {
      if (error.message === 'cancelled') {
        console.log(`🚫 Render ${id} was cancelled`);
        setRenderState(RENDER_STATE.CANCELLED);
      } else {
        console.error(`❌ Render ${id} failed:`, error);
        setRenderState(RENDER_STATE.ERROR);
      }

      setActiveRender(null);
      setIsRendering(false);

      // Reset to idle after error
      setTimeout(() => {
        setRenderState(RENDER_STATE.IDLE);
      }, 100);
    }
  }, [highlightedBlocks, setHighlightedBlocks, setHtml, setIsRendering, onRenderComplete, isRapidTyping]);

  /**
   * Detect rapid typing patterns and enable instant rendering mode
   */
  const detectRapidTyping = useCallback(() => {
    const now = Date.now();
    const timeSinceLastTyping = now - lastTypingTimeRef.current;
    lastTypingTimeRef.current = now;

    // Clear existing timer
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }

    // Enable rapid typing mode if typing within 200ms intervals
    if (timeSinceLastTyping < 200) {
      if (!isRapidTyping) {
        console.log('🚀 Rapid typing mode: ENABLED');
        setIsRapidTyping(true);
      }
    }

    // Disable rapid typing mode after 500ms of no typing
    typingTimerRef.current = setTimeout(() => {
      if (isRapidTyping) {
        console.log('🐌 Rapid typing mode: DISABLED');
        setIsRapidTyping(false);
      }
    }, 500);
  }, [isRapidTyping]);

  /**
   * Debounced render function for rapid content changes
   */
  const debouncedRender = useCallback((content, theme, priority = PRIORITY.NORMAL, reason = 'content-change') => {
    // Detect rapid typing for content changes
    if (reason === 'content-change') {
      detectRapidTyping();
    }

    // Clear existing debounce timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // For high priority requests or rapid typing mode, skip debouncing
    if (priority === PRIORITY.HIGH || (isRapidTyping && reason === 'content-change')) {
      console.log(`⚡ Instant render: ${priority === PRIORITY.HIGH ? 'HIGH_PRIORITY' : 'RAPID_TYPING'}`);
      queueRender(content, theme, priority, reason);
      return;
    }

    // Debounce normal priority requests - reduced for faster typing feedback
    debounceTimeoutRef.current = setTimeout(() => {
      queueRender(content, theme, priority, reason);
    }, reason === 'content-change' ? 50 : 10); // Much faster: 50ms for typing, 10ms for other changes
  }, [queueRender, detectRapidTyping, isRapidTyping, processQueue]);

  /**
   * Public API for triggering renders
   */
  const triggerRender = useCallback((content, theme, options = {}) => {
    const {
      priority = PRIORITY.NORMAL,
      reason = 'content-change',
      immediate = false
    } = options;

    // Performance guard: Skip if content and theme haven't changed
    if (reason === 'content-change' &&
        content === lastProcessedContentRef.current &&
        theme === lastProcessedThemeRef.current) {
      console.log(`⏭️ Skipping render - no changes detected (${reason})`);
      return;
    }

    if (immediate) {
      queueRender(content, theme, priority, reason);
    } else {
      debouncedRender(content, theme, priority, reason);
    }
  }, [queueRender, debouncedRender]);

  // Process queue when it changes and we're idle, with rapid typing optimization
  useEffect(() => {
    if (renderState === RENDER_STATE.IDLE && renderQueue.length > 0) {
      if (isRapidTyping) {
        // For rapid typing, use microtask for immediate processing
        queueMicrotask(() => {
          console.log(`🚀 Rapid typing: Microtask queue processing`);
          processQueue();
        });
      } else {
        // Normal processing
        processQueue();
      }
    }
  }, [renderState, renderQueue.length, processQueue, isRapidTyping]);

  // Handle content changes
  useEffect(() => {
    // Allow rendering even for empty content (content could be undefined, null, or empty string)
    if (content === undefined || content === null) return;

    // Determine the reason for this render
    let reason = 'content-change';
    let priority = PRIORITY.NORMAL;

    const currentDocId = currentDocument?.id;
    const previousDocId = lastDocumentIdRef.current;
    const isFirstRender = isFirstRenderRef.current;

    if (isFirstRender) {
      reason = 'initial-render';
      priority = PRIORITY.HIGH;
      isFirstRenderRef.current = false;
    } else if (currentDocId !== previousDocId) {
      reason = 'document-change';
      priority = PRIORITY.HIGH;
    } else {
      reason = 'content-change';
      priority = PRIORITY.NORMAL;
    }

    // Update the last document ID reference
    lastDocumentIdRef.current = currentDocId;

    console.log("🔄 RenderingOrchestrator: Content change detected", {
      contentLength: content.length,
      documentId: currentDocId,
      previousDocId,
      currentState: renderState,
      isEmpty: content === '',
      reason,
      priority: priority === PRIORITY.HIGH ? 'HIGH' : 'NORMAL',
      isFirstRender
    });

    // Reset first render flag on content change
    resetFirstRenderFlag();

    triggerRender(content, theme, { priority, reason });
  }, [content, currentDocument?.id, resetFirstRenderFlag, triggerRender, theme]); // Removed renderState dependency

  // Handle theme changes
  useEffect(() => {
    if (theme !== lastProcessedThemeRef.current && lastProcessedContentRef.current) {
      console.log("🎨 RenderingOrchestrator: Theme change detected", { theme });
      triggerRender(lastProcessedContentRef.current, theme, {
        priority: PRIORITY.LOW,
        reason: 'theme-change'
      });
    }
  }, [theme, triggerRender]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cancel all pending operations
      if (cancelTokenRef.current) {
        cancelTokenRef.current.cancelled = true;
      }

      // Clear timeouts
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }

      // Cancel all queued requests
      renderQueueRef.current.forEach(request => request.cancel());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Expose orchestrator state for debugging
  const orchestratorState = {
    state: renderState,
    queueLength: renderQueueRef.current.length,
    activeRender: activeRender?.id || null,
    lastProcessedContent: lastProcessedContentRef.current.length,
    isRapidTyping,
    triggerRender
  };

  // Attach to window for debugging
  useEffect(() => {
    window.__renderingOrchestrator = orchestratorState;
    return () => {
      delete window.__renderingOrchestrator;
    };
  }, [orchestratorState]);

  return {
    orchestratorState
  };
}

export { RENDER_STATE, PRIORITY };