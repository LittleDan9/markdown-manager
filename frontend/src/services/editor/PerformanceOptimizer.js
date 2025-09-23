// Performance optimization utilities for large documents
class PerformanceOptimizer {
  constructor() {
    // Constants as instance properties for consistency
    this.LARGE_DOCUMENT_THRESHOLD = 100000; // 100KB - back to reasonable threshold
    this.VERY_LARGE_DOCUMENT_THRESHOLD = 500000; // 500KB - for truly large docs
    this.MASSIVE_DOCUMENT_THRESHOLD = 1000000; // 1MB - for massive docs
    this.EXTREME_DOCUMENT_THRESHOLD = 2000000; // 2MB - for extreme cases
    this.MAX_SPELL_CHECK_CHUNK = 10000; // 10KB chunks - larger for better performance
    this.SPELL_CHECK_DELAY = 1000; // 1 second delay - shorter
    this.VERY_LARGE_SPELL_CHECK_DELAY = 3000; // 3 second delay
    this.EXTREME_SPELL_CHECK_DELAY = 5000; // 5 second delay
  }

  /**
   * Check if document is considered large
   */
  isLargeDocument(content) {
    return content && content.length > this.LARGE_DOCUMENT_THRESHOLD;
  }

  /**
   * Check if document is very large and needs aggressive optimization
   */
  isVeryLargeDocument(content) {
    return content && content.length > this.VERY_LARGE_DOCUMENT_THRESHOLD;
  }

  /**
   * Check if document is massive and needs extreme optimization
   */
  isMassiveDocument(content) {
    return content && content.length > this.MASSIVE_DOCUMENT_THRESHOLD;
  }

  /**
   * Check if document is extreme size and needs maximum optimization
   */
  isExtremeDocument(content) {
    return content && content.length > this.EXTREME_DOCUMENT_THRESHOLD;
  }

  /**
   * Determine if initial loading should be deferred for large documents
   */
  shouldDeferInitialLoad(content) {
    return this.isVeryLargeDocument(content);
  }

  /**
   * Get the initial load strategy for documents
   */
  getInitialLoadStrategy(content) {
    if (this.isExtremeDocument(content)) {
      return {
        mode: 'extreme',
        shouldDefer: true,
        deferDelay: 2000,
        showWarning: true,
        message: 'Extremely large document detected (>2MB). Loading optimized view...'
      };
    } else if (this.isMassiveDocument(content)) {
      return {
        mode: 'massive',
        shouldDefer: true,
        deferDelay: 1000,
        showWarning: true,
        message: 'Very large document detected (>1MB). Applying performance optimizations...'
      };
    } else if (this.isVeryLargeDocument(content)) {
      return {
        mode: 'large',
        shouldDefer: false, // Don't defer for 500KB docs
        deferDelay: 0,
        showWarning: true,
        message: 'Large document detected (>500KB). Some optimizations applied...'
      };
    }

    return {
      mode: 'normal',
      shouldDefer: false,
      deferDelay: 0,
      showWarning: false
    };
  }

  /**
   * Split document into chunks for progressive processing
   */
  chunkDocument(text, chunkSize = this.MAX_SPELL_CHECK_CHUNK) {
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push({
        text: text.slice(i, i + chunkSize),
        startOffset: i,
        endOffset: Math.min(i + chunkSize, text.length)
      });
    }
    return chunks;
  }

  /**
   * Get Monaco editor options optimized for document size
   */
  getOptimizedEditorOptions(content) {
    const isLarge = this.isLargeDocument(content);
    const isVeryLarge = this.isVeryLargeDocument(content);
    const isMassive = this.isMassiveDocument(content);
    const isExtreme = this.isExtremeDocument(content);

    // Only apply optimizations for truly large documents (>100KB)
    if (!isLarge) {
      return {}; // No optimizations for normal documents
    }

    return {
      // Disable expensive features only for very large documents
      minimap: { enabled: false },
      wordWrap: isExtreme ? "off" : "on",
      renderLineHighlight: isExtreme ? "none" : isMassive ? "gutter" : "line",
      renderIndentGuides: !isMassive,
      renderWhitespace: isMassive ? "none" : "selection",
      matchBrackets: isExtreme ? "never" : "always",

      // Only disable syntax highlighting for extreme documents (>2MB)
      language: isExtreme ? "plaintext" : "markdown",

      // Reduce rendering frequency only for massive docs
      scrollBeyondLastLine: !isMassive,
      smoothScrolling: !isMassive,

      // Disable features for performance only when needed
      suggest: {
        enabled: !isExtreme,
        showKeywords: false,
        showSnippets: false
      },

      // Disable expensive language features only for extreme docs
      quickSuggestions: !isExtreme,
      parameterHints: { enabled: false },
      codeLens: false,
      hover: { enabled: !isExtreme },

      // Optimize viewport rendering only for extreme docs
      viewportColumn: isExtreme ? 200 : 80,

      // Reduce decoration rendering only for massive docs
      glyphMargin: !isMassive,
      folding: !isMassive,
      foldingHighlight: false,
      unfoldOnClickAfterEndOfLine: false,

      // Disable rulers and guides
      rulers: [],
      renderControlCharacters: false,
      // Disable Unicode character highlighting
      unicodeHighlight: {
        ambiguousCharacters: false,
        invisibleCharacters: false,
        nonBasicASCII: false,
        includeComments: false,
        allowedCharacters: {},
        allowedLocales: true
      },

      // More aggressive performance settings only for extreme documents
      contextmenu: !isExtreme,
      links: !isExtreme,
      colorDecorators: false,
      lightbulb: { enabled: false },

      // Disable find widget features only for extreme docs
      find: {
        addExtraSpaceOnTop: false,
        autoFindInSelection: isExtreme ? "never" : "always"
      },

      // Performance-critical settings
      automaticLayout: true, // Keep this for container resizing
      fontSize: 14,
      fontFamily: "Consolas, Courier New, monospace",
      padding: { top: 20, bottom: 10 },

      // Disable animations for large documents
      cursorBlinking: isLarge ? "solid" : "blink",
      cursorSmoothCaretAnimation: !isLarge,

      // Reduce scroll sensitivity for massive documents
      scrollbar: {
        vertical: isMassive ? "hidden" : "visible",
        horizontal: isMassive ? "hidden" : "visible",
        useShadows: !isLarge,
        verticalHasArrows: false,
        horizontalHasArrows: false
      }
    };
  }

  /**
   * Get optimized spell check strategy for document size
   */
  getSpellCheckStrategy(content) {
    if (this.isExtremeDocument(content)) {
      return {
        enabled: false, // Disable for extreme docs (>2MB)
        message: "Spell check disabled for performance (document > 2MB)"
      };
    } else if (this.isMassiveDocument(content)) {
      return {
        enabled: false, // Disable for massive docs (>1MB)
        message: "Spell check disabled for performance (document > 1MB)"
      };
    } else if (this.isVeryLargeDocument(content)) {
      return {
        enabled: true, // Keep enabled but make progressive
        progressive: true,
        delay: this.VERY_LARGE_SPELL_CHECK_DELAY,
        chunkSize: this.MAX_SPELL_CHECK_CHUNK,
        message: "Spell check running progressively..."
      };
    } else if (this.isLargeDocument(content)) {
      return {
        enabled: true,
        progressive: true,
        delay: this.SPELL_CHECK_DELAY,
        chunkSize: this.MAX_SPELL_CHECK_CHUNK,
        message: "Spell check running progressively..."
      };
    } else {
      return {
        enabled: true,
        progressive: false,
        delay: 500, // Short delay for normal documents
        message: null
      };
    }
  }

  /**
   * Show user-friendly message about performance optimizations
   */
  getPerformanceMessage(content) {
    const size = content?.length || 0;
    const sizeKB = Math.round(size / 1024);

    // Only show messages for truly large documents
    if (this.isExtremeDocument(content)) {
      return {
        type: 'danger',
        title: 'Extreme Document Detected',
        message: `Document size: ${sizeKB}KB. Maximum performance mode active.`,
        suggestions: [
          'Document is extremely large - consider splitting',
          'All non-essential features disabled',
          'Plain text mode for optimal performance',
          'Spell check disabled'
        ]
      };
    } else if (this.isMassiveDocument(content)) {
      return {
        type: 'warning',
        title: 'Very Large Document Detected',
        message: `Document size: ${sizeKB}KB. Performance optimizations active.`,
        suggestions: [
          'Consider splitting into smaller documents',
          'Some editor features reduced for performance'
        ]
      };
    } else if (this.isVeryLargeDocument(content)) {
      return {
        type: 'info',
        title: 'Large Document Detected',
        message: `Document size: ${sizeKB}KB. Minor optimizations applied.`,
        suggestions: [
          'Spell check will run progressively for better performance'
        ]
      };
    }
    return null; // No message for documents under 500KB
  }
}

// Export singleton instance for consistency with other services
export default new PerformanceOptimizer();
