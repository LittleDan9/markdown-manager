import { EDITOR_KEY } from './constants';
import { initEditor } from './editor';
import { applyEditorTheme, initTheme, toggleTheme } from './theme';
import { render } from './renderer';
import { documentManager } from './documentManager';
import { initDocumentUI } from './documentUI';
import AuthManager from './auth';

import '../styles/main.scss';

function debounce(fn, wait) {
  let t;
  return () => {
    clearTimeout(t);
    t = setTimeout(fn, wait);
  };
}

window.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 DOM Content Loaded');
    
    let theme = await initTheme();

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
        theme = event.matches ? "dark" : "light";
    });

    const editor = await initEditor(theme);
    await applyEditorTheme(theme, editor);

    // Initialize authentication system
    const authManager = new AuthManager();
    // Make it globally available for debugging
    window.authManager = authManager;

    // Initialize document management
    const documentUI = initDocumentUI(editor);

    // Load current document or restore from legacy storage
    const currentDoc = documentManager.currentDocument;
    if (currentDoc.id) {
        try {
            const doc = documentManager.documents[currentDoc.id];
            if (doc) {
                editor.setValue(doc.content);
            }
        } catch (error) {
            console.error('Error loading current document:', error);
        }
    } else {
        // Check for legacy editor content
        const legacyContent = localStorage.getItem(EDITOR_KEY);
        if (legacyContent) {
            editor.setValue(legacyContent);
            // Remove legacy storage
            localStorage.removeItem(EDITOR_KEY);
        }
    }

    // Update document title
    documentUI.updateDocumentTitle();

    // Setup auto-save
    documentUI.setupAutoSave();

    const elThemeToggle = document.getElementById('themeToggle');
    elThemeToggle.addEventListener('change', async e => {
        theme = e.target.checked ? 'dark' : 'light';
        await toggleTheme(theme);
        await applyEditorTheme(theme, editor);

        // Update fullscreen window theme if open
        if (fullscreenWindow && !fullscreenWindow.closed) {
            fullscreenWindow.document.documentElement.setAttribute('data-bs-theme', theme);
        }
    });

    // Fullscreen window management
    let fullscreenWindow = null;
    let fullscreenUpdateInterval = null;

    const openFullscreenDiagram = () => {
        if (fullscreenWindow && !fullscreenWindow.closed) {
            fullscreenWindow.focus();
            return;
        }

        // Create fullscreen window
        fullscreenWindow = window.open('', 'FullscreenDiagram', 'width=1200,height=800,scrollbars=yes,resizable=yes');

        if (fullscreenWindow) {
            // Get current theme
            const currentTheme = document.documentElement.getAttribute('data-bs-theme') || 'light';

            // Build the fullscreen HTML
            const fullscreenHTML = `
                <!DOCTYPE html>
                <html lang="en" data-bs-theme="${currentTheme}">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Fullscreen Diagram - Mermaid Editor</title>
                    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.6/dist/css/bootstrap.min.css"
                          rel="stylesheet"
                          integrity="sha384-4Q6Gf2aSP4eDXB8Miphtr37CMZZQ5oXLH2yaXMJ2w8e2ZtHTl7GptT4jmndRuHDT"
                          crossorigin="anonymous">
                    <style>
                        body {
                            margin: 0;
                            padding: 1rem;
                            height: 100vh;
                            box-sizing: border-box;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        }

                        #fullscreen-preview {
                            width: 100%;
                            height: 100%;
                            border: 1px solid #ced4da;
                            border-radius: 0.5rem;
                            padding: 1rem;
                            overflow: auto;
                            box-sizing: border-box;
                        }

                        [data-bs-theme="dark"] #fullscreen-preview {
                            border-color: #495057;
                            background-color: var(--bs-dark);
                            color: var(--bs-light);
                        }

                        /* Copy theme styles for consistency */
                        [data-bs-theme="dark"] {
                            --bs-body-bg: #212529;
                            --bs-body-color: #dee2e6;
                        }

                        [data-bs-theme="dark"] body {
                            background-color: var(--bs-body-bg);
                            color: var(--bs-body-color);
                        }

                        /* Markdown content styling */
                        .preview-content {
                            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                            line-height: 1.6;
                        }

                        .preview-content h1, .preview-content h2, .preview-content h3,
                        .preview-content h4, .preview-content h5, .preview-content h6 {
                            margin-top: 1.5rem;
                            margin-bottom: 0.5rem;
                            font-weight: 600;
                        }

                        .preview-content p {
                            margin-bottom: 1rem;
                        }

                        .preview-content pre {
                            background-color: #f8f9fa;
                            border: 1px solid #e9ecef;
                            border-radius: 0.375rem;
                            padding: 1rem;
                            overflow-x: auto;
                        }

                        [data-bs-theme="dark"] .preview-content pre {
                            background-color: #2d3748;
                            border-color: #4a5568;
                            color: #e2e8f0;
                        }

                        .preview-content blockquote {
                            border-left: 4px solid #007bff;
                            padding-left: 1rem;
                            margin: 1rem 0;
                            color: #6c757d;
                        }

                        [data-bs-theme="dark"] .preview-content blockquote {
                            border-left-color: #66b3ff;
                            color: #adb5bd;
                        }

                        .preview-content table {
                            width: 100%;
                            border-collapse: collapse;
                            margin: 1rem 0;
                        }

                        .preview-content th, .preview-content td {
                            border: 1px solid #dee2e6;
                            padding: 0.5rem;
                            text-align: left;
                        }

                        [data-bs-theme="dark"] .preview-content th,
                        [data-bs-theme="dark"] .preview-content td {
                            border-color: #495057;
                        }

                        .preview-content th {
                            background-color: #f8f9fa;
                            font-weight: 600;
                        }

                        [data-bs-theme="dark"] .preview-content th {
                            background-color: #343a40;
                        }
                    </style>
                </head>
                <body>
                    <div id="fullscreen-preview">
                        <div class="preview-content" id="preview-content">
                            Loading...
                        </div>
                    </div>
                </body>
                </html>
            `;

            fullscreenWindow.document.write(fullscreenHTML);
            fullscreenWindow.document.close();

            // Update content immediately
            updateFullscreenContent();

            // Set up periodic updates
            fullscreenUpdateInterval = setInterval(updateFullscreenContent, 500);

            // Clean up when window is closed
            fullscreenWindow.addEventListener('beforeunload', () => {
                if (fullscreenUpdateInterval) {
                    clearInterval(fullscreenUpdateInterval);
                    fullscreenUpdateInterval = null;
                }
                fullscreenWindow = null;
            });
        }
    };

    const updateFullscreenContent = () => {
        if (fullscreenWindow && !fullscreenWindow.closed) {
            const previewContent = document.querySelector('#preview .preview-scroll');
            const fullscreenContent = fullscreenWindow.document.getElementById('preview-content');

            if (previewContent && fullscreenContent) {
                fullscreenContent.innerHTML = previewContent.innerHTML;

                // Update theme if it changed
                const currentTheme = document.documentElement.getAttribute('data-bs-theme') || 'light';
                fullscreenWindow.document.documentElement.setAttribute('data-bs-theme', currentTheme);
            }
        }
    };

    // Add fullscreen button event listener
    const fullscreenBtn = document.getElementById('fullScreenBtn');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', openFullscreenDiagram);
    }

    // Handle window resize to re-render preview
    const debouncedResize = debounce(() => {
        console.log('🔄 Window resized, updating layout...');
        
        // Force Monaco editor to recalculate its layout
        editor.layout();
        console.log('📐 Editor layout updated');
        
        // Clear any existing Mermaid diagrams first to avoid conflicts
        const mermaidElements = document.querySelectorAll('.mermaid');
        mermaidElements.forEach(el => {
            // Remove any existing SVG content to force re-render
            const svg = el.querySelector('svg');
            if (svg) {
                svg.remove();
            }
            // Reset the mermaid element state
            el.removeAttribute('data-processed');
        });
        
        // Re-render the entire preview
        render(editor);
        console.log('🎨 Preview re-rendered');
        
        // Also update fullscreen window if open
        if (fullscreenWindow && !fullscreenWindow.closed) {
            setTimeout(updateFullscreenContent, 200);
        }
        
        console.log('✅ Resize handling complete');
    }, 250); // Slightly longer debounce for resize events

    window.addEventListener('resize', debouncedResize);

    editor.onDidChangeModelContent(() => {
        const debouncedRender = debounce(() => {
            render(editor);
            // Update fullscreen window if open
            if (fullscreenWindow && !fullscreenWindow.closed) {
                setTimeout(updateFullscreenContent, 100); // Small delay to ensure render is complete
            }
        }, 300);
        debouncedRender();

        // Save to document manager instead of legacy localStorage
        if (documentManager.currentDocument.id) {
            // This will be handled by auto-save if enabled
        } else {
            // For unsaved documents, we can still store in legacy location as backup
            localStorage.setItem(EDITOR_KEY, editor.getValue());
        }
    });
});