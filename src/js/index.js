import * as monaco from 'monaco-editor';
import MarkdownIt from 'markdown-it';
import mermaid from 'mermaid';
// import hljs from 'highlight.js';npm install prismjs prismjs-copy-to-clipboard
import Prism from 'prismjs';
// import 'highlight.js/styles/github.css';
import '../styles/main.scss';

import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-python';

const defaultGraph = [
    "# This is a sample Mermaid flowchart",
    "``` mermaid",
    "%% Sample flowchart",
    "flowchart LR",
    "  A[Square Rect] --> B((Circle))",
    "  B --> C{Rhombus?}",
    "  C -->|One| D[Result 1]",
    "  C -->|Two| E[Result 2]",
    "```"
].join("\n")

const themeToggle = document.getElementById('themeToggle');
let theme = themeToggle.checked ? 'dark' : 'light';

// Function to dynamically import highlight.js stylesheet
const loadHighlightJsStylesheet = async (theme) => {
    try {
        // Use explicit import paths based on theme
        if (theme === 'dark') {
            await import(/* webpackChunkName: "prism-dark" */ 'prism-themes/themes/prism-one-dark.css');
        } else {
            await import(/* webpackChunkName: "prism-light" */ 'prism-themes/themes/prism-one-light.css');
        }
        console.log(`Loaded Prism.js stylesheet for theme: ${theme}`);
    } catch (error) {
        console.warn(`Failed to load Prism.js stylesheet for theme ${theme}:`, error.message);
    }
};
// Load initial stylesheet
loadHighlightJsStylesheet(theme);

mermaid.initialize({
    startOnLoad: false,
    theme: theme,
    flowchart: {
        htmlLabels: true,
        curve: 'linear'
    },
    suppressErrorRendering: true,
});

window.addEventListener('DOMContentLoaded', () => {
    const editor = monaco.editor.create(document.getElementById('editor'), {
        value: defaultGraph,
        language: 'markdown',
        theme: 'vs-' + theme,
        automaticLayout: true,
        minimap: {
            enabled: false,
        },
        fontFamily: 'Consolas, Courier New, monospace',
        fontSize: 14,
        wordWrap: 'on',
        padding: {
            top: 20,
            bottom: 10,
        },
    });

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

    const defaultFence = md.renderer.rules.fence.bind(md.renderer.rules)

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
                <img src="${require('../assets/copy-icon.svg')}" alt="Copy" width="16" height="16">
                </button>
            </div>
            ${highlightedCode}
            </div>
        `
        // otherwise use the built-in renderer
        return defaultFence(tokens, idx, options, env, self)
    }

    const renderPreview = () => {
        const previewEl = document.getElementById("preview");
        const src = editor.getValue();
        previewEl.innerHTML = md.render(src);
        try {
            mermaid.run({ querySelector: '.mermaid' }).catch((error) => {
                // console.warn("Mermaid rendering failed:", error.message);
                previewEl.innerHTML += `<p style="color: red;">Mermaid Error: ${error.message}</p>`;
            });
            Prism.highlightAllUnder(previewEl);
        } catch (error) {
            console.warn("Mermaid initialization failed:", error.message);
        }
    };

    themeToggle.addEventListener('change', (e) => {
        theme = e.target.checked ? 'dark' : 'light';
        document.getElementsByTagName('html')[0].setAttribute('data-bs-theme', theme);
        monaco.editor.setTheme('vs-' + theme);
        mermaid.initialize({
            startOnLoad: false,
            theme: theme,
            flowchart: {
                htmlLabels: true,
                curve: 'linear'
            },
            suppressErrorRendering: true,
        });
        console.log("Made it here");
        loadHighlightJsStylesheet(theme);
        renderPreview();
    });

    renderPreview();

    editor.onDidChangeModelContent(() => {
        renderPreview();
    });

});