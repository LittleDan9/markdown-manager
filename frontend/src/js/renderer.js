import MarkdownIt from 'markdown-it';
import mermaid from 'mermaid';
import Prism from 'prismjs';

const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    highlight: (str, lang) => {
        if (lang && Prism.languages[lang]) {
            try {
                // highlight.js ≥10 syntax:
                const highlightedCode = Prism.highlight(str, Prism.languages[lang], lang);
                return `<pre class="language-${lang}"><code>${highlightedCode}</code></pre>`;
            } catch (__) { }
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
        // emit only our <div>—no <pre><code> wrapper
        return `<div class="mermaid">${token.content}</div>`
    }

    const highlightedCode = md.options.highlight(token.content, info, lang);

    return `
            <div class="code-block">
            <div class="code-block-header">
                <span class="code-block-lang">${lang.toUpperCase()}</span>
                <button class="code-block-copy-btn" data-prismjs-copy>
                <i class="bi bi-clipboard" aria-label="Copy"></i>
                </button>
            </div>
            ${highlightedCode}
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
            logLevel: 'error' // Reduced from 'warn' to 'error' to reduce console noise
        });
        console.log(`Mermaid initialized with theme: ${theme}`);
    } catch (error) {
        console.error('Failed to initialize Mermaid:', error);
    }
}

export async function render(editor) {
    // const previewEl = document.getElementById("preview");
    const previewEl = document.querySelector("#preview .preview-scroll");
    const src = editor.getValue();
    previewEl.innerHTML = md.render(src);
    
    try {
        // Clear any existing mermaid state
        const mermaidElements = previewEl.querySelectorAll('.mermaid');
        mermaidElements.forEach(el => {
            el.removeAttribute('data-processed');
            el.style.visibility = 'visible'; // Ensure element is visible
        });
        
        if (mermaidElements.length > 0) {
            try {
                // Use the correct Mermaid v11 API
                await mermaid.run({ querySelector: '.mermaid' });
                console.log(`Rendered ${mermaidElements.length} mermaid diagram(s)`);
                
                // Ensure Mermaid diagrams are responsive
                mermaidElements.forEach(el => {
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
                console.warn("Mermaid rendering failed:", mermaidError);
                // Add error message to failed diagrams
                mermaidElements.forEach(el => {
                    if (!el.querySelector('svg')) {
                        el.innerHTML = `<div class="alert alert-danger">
                            <strong>Mermaid Error:</strong> ${mermaidError.message || 'Failed to render diagram'}
                        </div>`;
                    }
                });
            }
        }
        
        // Highlight code blocks
        Prism.highlightAllUnder(previewEl);
    } catch (error) {
        console.error("Rendering failed:", error);
    }
};