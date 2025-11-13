import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
  const { currentDocument, highlightedBlocks, setHighlightedBlocks, isRendering: _isRendering, setIsRendering, renderState, setRenderState, isRapidTyping, setIsRapidTyping, content } = useDocumentContext();
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
   * Process incremental render for content changes
   */
  const processIncrementalRender = useCallback(async (newContent, oldContent, cancelToken) => {
    console.log('🔄 Processing incremental render');

    // For now, fall back to full render for incremental updates
    // TODO: Implement true incremental DOM updates
    console.log('🔄 Falling back to full render for incremental update');
    const htmlString = render(newContent);
    // Don't set html in RendererContext for incremental - only update previewHTML
    onRenderComplete(htmlString, { renderId: Date.now(), reason: 'incremental-fallback', incremental: false });
  }, [onRenderComplete]);

  /**
   * Process full highlighting for document changes
   */
  const processFullHighlighting = useCallback(async (content, htmlString, cancelToken) => {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlString;
    const codeBlocks = Array.from(tempDiv.querySelectorAll("[data-syntax-placeholder]"));
    const blocksToHighlight = [];

    console.log(`🎨 Processing ${codeBlocks.length} code blocks for full render`);

    codeBlocks.forEach(block => {
      const code = decodeURIComponent(block.dataset.code);
      const language = block.dataset.lang;
      const placeholderId = `syntax-highlight-${HighlightService.hashCode(language + code)}`;
      block.setAttribute("data-syntax-placeholder", placeholderId);

      // Use existing highlighted blocks if available
      if (highlightedBlocks[placeholderId]) {
        const codeEl = block.querySelector("code");
        if (codeEl) {
          codeEl.innerHTML = highlightedBlocks[placeholderId];
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
      console.log(`✨ Highlighting ${blocksToHighlight.length} new blocks`);

      const results = await HighlightService.highlightBlocks(blocksToHighlight);

      if (cancelToken.cancelled) throw new Error('cancelled');

      // Update HTML with new highlights
      const updatedTempDiv = document.createElement("div");
      updatedTempDiv.innerHTML = render(content);
      const updatedCodeBlocks = Array.from(updatedTempDiv.querySelectorAll("[data-syntax-placeholder]"));

      updatedCodeBlocks.forEach(block => {
        const code = decodeURIComponent(block.dataset.code);
        const language = block.dataset.lang;
        const placeholderId = `syntax-highlight-${HighlightService.hashCode(language + code)}`;
        block.setAttribute("data-syntax-placeholder", placeholderId);

        // Apply highlights
        const highlightedHtml = results[placeholderId] || highlightedBlocks[placeholderId];
        if (highlightedHtml) {
          const codeEl = block.querySelector("code");
          if (codeEl) {
            codeEl.innerHTML = highlightedHtml;
            block.setAttribute("data-processed", "true");
          }
        }
      });

      // Update highlighted blocks state
      const newHighlights = {};
      Object.entries(results).forEach(([id, html]) => {
        if (!highlightedBlocks[id]) {
          newHighlights[id] = html;
        }
      });

      if (Object.keys(newHighlights).length > 0) {
        setHighlightedBlocks(prev => ({ ...prev, ...newHighlights }));
      }

      return updatedTempDiv.innerHTML;
    }

    return tempDiv.innerHTML;
  }, [highlightedBlocks, setHighlightedBlocks]);
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

      // Determine render strategy based on reason
      const isIncrementalUpdate = reason === 'content-change' && lastProcessedContentRef.current;
      const oldContent = lastProcessedContentRef.current;

      let htmlString = null; // Will be set for full renders

      if (isIncrementalUpdate) {
        console.log(`🔄 Incremental render for ${id} - content change detected`);

        // Process incremental updates
        await processIncrementalRender(content, oldContent, cancelToken);

      } else {
        console.log(`🔄 Full render for ${id} - ${reason}`);

        // Step 1: Markdown to HTML conversion (full render)
        htmlString = render(content);
        console.log(`📝 Markdown rendered for ${id}`);

        if (cancelToken.cancelled) throw new Error('cancelled');

        // Step 2: Process syntax highlighting (full render)
        setRenderState(RENDER_STATE.HIGHLIGHTING);
        htmlString = await processFullHighlighting(content, htmlString, cancelToken);

        if (cancelToken.cancelled) throw new Error('cancelled');

        // Step 3: Finalize render
        setRenderState(RENDER_STATE.FINALIZING);

        console.log(`✅ Full render ${id} completed successfully`);

        // Update state and tracking
        setHtml(htmlString);
      }

      // Update tracking for both incremental and full renders
      lastProcessedContentRef.current = content;
      lastProcessedThemeRef.current = theme;

      setRenderState(RENDER_STATE.COMPLETED);
      setActiveRender(null);

      // Notify completion - skip for incremental updates as they handle their own completion
      if (!isIncrementalUpdate && onRenderComplete) {
        onRenderComplete(htmlString, { renderId: id, reason, incremental: false });
      }

      // Reset to idle after a brief moment
      setTimeout(() => {
        if (!cancelToken.cancelled) {
          setRenderState(RENDER_STATE.IDLE);
          setIsRendering(false);
        }
      }, 10);

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
  }, [highlightedBlocks, setHighlightedBlocks, setHtml, setIsRendering, onRenderComplete, setRenderState, processIncrementalRender, processFullHighlighting]);

  /**
   * Process the render queue - simplified without rapid typing complexity
   */
  const processQueue = useCallback(async () => {
    // Don't process if already processing or in crop mode
    if (renderState !== RENDER_STATE.IDLE || isCropModeActive()) {
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

      // Start processing this request asynchronously
      setTimeout(() => {
        processRenderRequest(request);
      }, 0);

      renderQueueRef.current = remaining;
      return remaining;
    });
  }, [renderState, isCropModeActive, processRenderRequest]);

  /**
   * Simplified debounced render function - incremental updates make complex logic unnecessary
   */
  const debouncedRender = useCallback((content, theme, priority = PRIORITY.NORMAL, reason = 'content-change') => {
    // Clear existing debounce timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // For high priority requests (document changes, initial render), skip debouncing
    if (priority === PRIORITY.HIGH) {
      console.log(`⚡ Immediate render: HIGH_PRIORITY (${reason})`);
      queueRender(content, theme, priority, reason);
      return;
    }

    // Simple debounce for content changes - incremental updates make this much more effective
    debounceTimeoutRef.current = setTimeout(() => {
      queueRender(content, theme, priority, reason);
    }, 25); // Very fast debounce for near real-time feedback
  }, [queueRender]);

  /**
   * Public API for triggering renders
   */
  const triggerRender = useCallback((content, theme, options = {}) => {
    const {
      priority = PRIORITY.NORMAL,
      reason = 'content-change',
      immediate = false
    } = options;

    // Performance guard: Skip if content and theme haven't changed (except for content changes which should always render)
    if (reason !== 'content-change' &&
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

  // Process queue when it changes and we're idle
  useEffect(() => {
    if (renderState === RENDER_STATE.IDLE && renderQueue.length > 0) {
      processQueue();
    }
  }, [renderState, renderQueue.length, processQueue]);

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
  }, [content, currentDocument?.id, resetFirstRenderFlag, triggerRender, theme, renderState]);

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

      // Clear debounce timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      // Cancel all queued requests
      renderQueueRef.current.forEach(request => request.cancel());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Expose orchestrator state for debugging
  const orchestratorState = useMemo(() => ({
    state: renderState,
    queueLength: renderQueueRef.current.length,
    activeRender: activeRender?.id || null,
    lastProcessedContent: lastProcessedContentRef.current.length,
    isRapidTyping,
    triggerRender
  }), [renderState, activeRender?.id, isRapidTyping, triggerRender]);

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