import MarkdownIt from 'markdown-it';
import mermaid from 'mermaid';
import syntaxHighlightingService from './syntaxHighlighting.js';

// Suppress Mermaid console errors by overriding console methods temporarily
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Override console methods to filter out Mermaid errors
console.error = (...args) => {
    const message = args.join(' ').toLowerCase();
    if (!message.includes('mermaid') && !message.includes('parse error')) {
        originalConsoleError.apply(console, args);
    }
};

console.warn = (...args) => {
    const message = args.join(' ').toLowerCase();
    if (!message.includes('mermaid')) {
        originalConsoleWarn.apply(console, args);
    }
};

// Debounce timer for syntax highlighting
let syntaxHighlightingTimer = null;
const SYNTAX_HIGHLIGHT_DELAY = 500; // ms

// Track recently highlighted blocks to preserve them during typing
const recentlyHighlighted = new Map();
const HIGHLIGHT_PRESERVE_TIME = 2000; // ms

const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    highlight: async (str, lang) => {
        if (lang) {
            try {
                // Use backend syntax highlighting service
                const highlightedCode = await syntaxHighlightingService.highlightCode(str, lang);
                return `<pre class="language-${lang}"><code>${highlightedCode}</code></pre>`;
            } catch (__) {
                // Fallback to escaped HTML
            }
        }
        // fallback for unknown languages
        return `<pre class="hljs"><code>${MarkdownIt().utils.escapeHtml(str)}</code></pre>`;
    }
});

md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const info = token.info.trim()
    const lang = info || '';
    if (info === 'mermaid') {
        // Store the original source in a data attribute for comparison
        return `<div class="mermaid" data-mermaid-source="${encodeURIComponent(token.content.trim())}">${token.content}</div>`
    }

    // For syntax highlighting, we'll use a placeholder that gets replaced later
    const placeholderId = `syntax-highlight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return `
            <div class="code-block">
            <div class="code-block-header">
                <span class="code-block-lang">${lang.toUpperCase()}</span>
                <button class="code-block-copy-btn" data-prismjs-copy>
                <i class="bi bi-clipboard" aria-label="Copy"></i>
                </button>
            </div>
            <pre class="language-${lang}" data-syntax-placeholder="${placeholderId}" data-code="${encodeURIComponent(token.content)}" data-lang="${lang}"><code>${MarkdownIt().utils.escapeHtml(token.content)}</code></pre>
            </div>
        `
}

export async function initMermaid(theme) {
    try {
        await mermaid.initialize({
            startOnLoad: false,
            theme: theme,
            flowchart: {
                htmlLabels: true,
                curve: 'linear'
            },
            suppressErrorRendering: true,
            logLevel: 'fatal', // Only show fatal errors, suppress all other logging
            // Additional error suppression
            htmlLabels: true,
            secure: ['secure', 'securityLevel', 'startOnLoad', 'maxTextSize'],
            securityLevel: 'loose'
        });
        console.log(`Mermaid initialized with theme: ${theme}`);
    } catch (error) {
        console.error('Failed to initialize Mermaid:', error);
    }
}

export async function render(editor, options = {}) {
    // const previewEl = document.getElementById("preview");
    const previewEl = document.querySelector("#preview .preview-scroll");
    const src = editor.getValue();
    
    // Check if this is an initial render (no existing content)
    const isInitialRender = options.isInitialRender || previewEl.innerHTML.trim() === '';

    // Store existing highlighted code blocks before replacing content
    const existingHighlights = new Map();
    const existingCodeBlocks = previewEl.querySelectorAll('[data-syntax-placeholder]');
    existingCodeBlocks.forEach(block => {
        const code = decodeURIComponent(block.dataset.code);
        const lang = block.dataset.lang;
        const codeElement = block.querySelector('code');
        if (codeElement && code && lang) {
            const key = `${lang}:${code}`;
            existingHighlights.set(key, codeElement.innerHTML);
        }
    });

    // Store existing Mermaid diagrams before replacing content
    const existingMermaidDiagrams = new Map();
    const existingMermaidElements = previewEl.querySelectorAll('.mermaid[data-mermaid-source]');
    existingMermaidElements.forEach(element => {
        // Get the original diagram source from the data attribute
        const diagramSource = decodeURIComponent(element.dataset.mermaidSource || '');
        if (diagramSource && element.querySelector('svg')) {
            // Only store if it has been rendered (has SVG)
            existingMermaidDiagrams.set(diagramSource, element.innerHTML);
        }
    });

    // Render new content
    previewEl.innerHTML = md.render(src);

    try {
        // Restore existing highlights immediately to prevent flickering
        const newCodeBlocks = previewEl.querySelectorAll('[data-syntax-placeholder]');
        newCodeBlocks.forEach(block => {
            const code = decodeURIComponent(block.dataset.code);
            const lang = block.dataset.lang;
            const codeElement = block.querySelector('code');
            if (codeElement && code && lang) {
                const key = `${lang}:${code}`;

                // First try exact match from current session
                if (existingHighlights.has(key)) {
                    codeElement.innerHTML = existingHighlights.get(key);
                }
                // Then try recently highlighted cache
                else if (recentlyHighlighted.has(key)) {
                    codeElement.innerHTML = recentlyHighlighted.get(key).html;
                }
                // For new blocks being typed, try to find a similar recent highlight
                else {
                    const similarHighlight = findSimilarHighlight(code, lang);
                    if (similarHighlight) {
                        codeElement.innerHTML = similarHighlight;
                    }
                }
            }
        });

        // Clear any existing syntax highlighting timer
        if (syntaxHighlightingTimer) {
            clearTimeout(syntaxHighlightingTimer);
        }

        // For initial renders (document restoration), skip debounce to show highlighting immediately
        if (isInitialRender) {
            await performSyntaxHighlighting(previewEl);
        } else {
            // Debounce syntax highlighting to avoid jumping while typing
            syntaxHighlightingTimer = setTimeout(async () => {
                await performSyntaxHighlighting(previewEl);
            }, SYNTAX_HIGHLIGHT_DELAY);
        }

        // Handle Mermaid diagrams - only render if they've changed, or force render on initial load
        await renderMermaidDiagrams(previewEl, existingMermaidDiagrams, isInitialRender);

    } catch (error) {
        console.error("Rendering failed:", error);
    }
}

/**
 * Find a similar highlight for blocks being actively edited
 */
function findSimilarHighlight(code, lang) {
    // Look for recently highlighted blocks with the same language
    // that might be similar (for blocks being actively typed)
    for (const [key, data] of recentlyHighlighted.entries()) {
        const [cachedLang, cachedCode] = key.split(':', 2);
        if (cachedLang === lang) {
            // If the new code starts with the cached code (user is adding to it)
            // or cached code starts with new code (user is deleting from it)
            if (code.startsWith(cachedCode) || cachedCode.startsWith(code)) {
                // Only use if the codes are reasonably similar in length
                const lengthDiff = Math.abs(code.length - cachedCode.length);
                const maxLength = Math.max(code.length, cachedCode.length);
                if (lengthDiff / maxLength < 0.3) { // Less than 30% difference
                    return data.html;
                }
            }
        }
    }
    return null;
}

/**
 * Perform syntax highlighting only for code blocks that need it
 */
async function performSyntaxHighlighting(previewEl) {
    const syntaxPlaceholders = previewEl.querySelectorAll('[data-syntax-placeholder]');
    const blocksToHighlight = [];

    // Only highlight blocks that don't already have highlighting or have changed
    syntaxPlaceholders.forEach(element => {
        const code = decodeURIComponent(element.dataset.code);
        const language = element.dataset.lang;
        const codeElement = element.querySelector('code');

        if (language && code && codeElement) {
            const key = `${language}:${code}`;

            // Check if this block needs highlighting
            const needsHighlighting =
                // Block has no highlighting (still shows escaped HTML)
                codeElement.innerHTML === MarkdownIt().utils.escapeHtml(code) ||
                // Block is not in our cache (new or changed)
                (!recentlyHighlighted.has(key) && !codeElement.innerHTML.includes('token '));

            if (needsHighlighting) {
                blocksToHighlight.push({ element, code, language, key });
            }
        }
    });

    // Only make API calls for blocks that actually need highlighting
    if (blocksToHighlight.length > 0) {
        console.log(`Highlighting ${blocksToHighlight.length} code blocks`);

        const highlightPromises = blocksToHighlight.map(async ({ element, code, language, key }) => {
            try {
                const highlightedCode = await syntaxHighlightingService.highlightCode(code, language);
                const codeElement = element.querySelector('code');
                if (codeElement) {
                    codeElement.innerHTML = highlightedCode;

                    // Track this block as recently highlighted
                    recentlyHighlighted.set(key, {
                        html: highlightedCode,
                        timestamp: Date.now()
                    });
                }
            } catch (error) {
                console.warn(`Failed to highlight code for language '${language}':`, error);
                // Keep the escaped HTML fallback
            }
        });

        // Wait for all highlighting to complete
        await Promise.allSettled(highlightPromises);
    }

    // Clean up old entries from recentlyHighlighted
    cleanupRecentlyHighlighted();
}

/**
 * Clean up old entries from recently highlighted cache
 */
function cleanupRecentlyHighlighted() {
    const now = Date.now();
    for (const [key, data] of recentlyHighlighted.entries()) {
        if (now - data.timestamp > HIGHLIGHT_PRESERVE_TIME) {
            recentlyHighlighted.delete(key);
        }
    }
}

/**
 * Render Mermaid diagrams - only render if they've changed
 */
async function renderMermaidDiagrams(previewEl, existingMermaidDiagrams = new Map(), isInitialRender = false) {
    const mermaidElements = previewEl.querySelectorAll('.mermaid[data-mermaid-source]');

    if (mermaidElements.length === 0) {
        return; // No diagrams to render
    }

    // Restore existing diagrams if they haven't changed
    const diagramsToRender = [];
    mermaidElements.forEach(element => {
        const diagramSource = decodeURIComponent(element.dataset.mermaidSource || '');
        if (diagramSource) {
            // If we have an existing rendered diagram with the same source, restore it
            if (existingMermaidDiagrams.has(diagramSource)) {
                element.innerHTML = existingMermaidDiagrams.get(diagramSource);
                // Mark as processed so Mermaid doesn't try to re-render it
                element.setAttribute('data-processed', 'true');
            } else {
                // This is a new or changed diagram that needs rendering
                diagramsToRender.push(element);
            }
        }
    });

    // On initial render, force render all diagrams even if no existing diagrams
    // On subsequent renders, only render diagrams that have actually changed
    if (diagramsToRender.length === 0 && !isInitialRender) {
        return; // No new diagrams to render and not initial load
    }

    // Clear processing state only for diagrams that need rendering
    diagramsToRender.forEach(el => {
        el.removeAttribute('data-processed');
        el.style.visibility = 'visible';
        // Remove any existing error indicators
        const existingError = el.parentElement?.querySelector('.mermaid-error-indicator');
        if (existingError) {
            existingError.remove();
        }
    });

    try {
        // Use the correct Mermaid v11 API - render only new diagrams
        await mermaid.run({
            querySelector: '.mermaid:not([data-processed])',
            suppressErrors: true // Suppress internal Mermaid error logging
        });

        // Ensure Mermaid diagrams are responsive
        diagramsToRender.forEach(el => {
            const svg = el.querySelector('svg');
            if (svg) {
                // Make SVG responsive - remove explicit height attribute for auto-sizing
                svg.setAttribute('width', '100%');
                svg.removeAttribute('height');
                svg.style.maxWidth = '100%';
                svg.style.height = 'auto';
            }
        });
    } catch (mermaidError) {
        // Suppress console logging and handle errors gracefully
        diagramsToRender.forEach(el => {
            if (!el.querySelector('svg')) {
                showMermaidError(el, mermaidError.message || 'Failed to render diagram');
            }
        });
    }
}

/**
 * Show a subtle error indicator for Mermaid diagrams
 */
function showMermaidError(mermaidElement, errorMessage) {
    // Create a subtle error indicator that floats above the diagram
    const errorIndicator = document.createElement('div');
    errorIndicator.className = 'mermaid-error-indicator';
    errorIndicator.innerHTML = `
        <div class="alert alert-warning alert-dismissible fade show" role="alert" style="
            position: relative;
            margin-bottom: 0.5rem;
            font-size: 0.875rem;
            padding: 0.5rem 0.75rem;
            border-left: 4px solid #f0ad4e;
        ">
            <i class="bi bi-exclamation-triangle me-2"></i>
            <strong>Diagram Error:</strong> ${errorMessage}
            <button type="button" class="btn-close btn-close-sm" data-bs-dismiss="alert" aria-label="Close" style="font-size: 0.75rem;"></button>
        </div>
    `;

    // Insert the error indicator before the mermaid element
    mermaidElement.parentElement?.insertBefore(errorIndicator, mermaidElement);

    // Get the original source from the data attribute to preserve it properly
    const originalSource = decodeURIComponent(mermaidElement.dataset.mermaidSource || mermaidElement.textContent);

    // Show the original diagram source in a properly styled code block
    mermaidElement.innerHTML = `
        <div class="code-block">
            <div class="code-block-header">
                <span class="code-block-lang">MERMAID</span>
                <button class="code-block-copy-btn" data-prismjs-copy>
                    <i class="bi bi-clipboard" aria-label="Copy"></i>
                </button>
            </div>
            <pre class="language-mermaid" style="margin: 0;"><code>${MarkdownIt().utils.escapeHtml(originalSource)}</code></pre>
        </div>
    `;

    // Auto-dismiss the error after 10 seconds to keep the UI clean
    setTimeout(() => {
        if (errorIndicator.parentElement) {
            errorIndicator.remove();
        }
    }, 10000);
}