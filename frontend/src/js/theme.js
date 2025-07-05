import * as monaco from 'monaco-editor';
import { initMermaid, render } from './renderer';

// Note: Prism.js syntax highlighting has been moved to the backend
// for comprehensive language support and reduced bundle size
// However, we still use Prism.js CSS themes for styling

export async function toggleTheme(theme) {
    localStorage.setItem("theme", theme);
    document.documentElement.setAttribute('data-bs-theme', theme);
    initMermaid(theme);
    await loadPrismStylesheet(theme);
    updateThemeIcon(theme);
}

function updateThemeIcon(theme) {
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) {
        if (theme === 'dark') {
            themeIcon.className = 'bi bi-moon-fill';
        } else {
            themeIcon.className = 'bi bi-sun-fill';
        }
    }
}

export async function initTheme() {
    let theme = localStorage.getItem('theme');
    if (theme !== 'light' && theme !== 'dark') {
        const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        theme = sysDark ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-bs-theme', theme);
    initMermaid(theme);
    await loadPrismStylesheet(theme);
    const elThemeToggle = document.getElementById('themeToggle');
    elThemeToggle.checked = (theme === 'dark');
    updateThemeIcon(theme);
    return theme
}

export async function applyEditorTheme(theme, editor) {
    if (!editor) {
        console.log("Editor was null");
        return;
    }
    console.log(theme);

    monaco.editor.setTheme('vs-' + theme);
    render(editor);
}

/**
 * Load Prism.js CSS theme based on the current theme
 * @param {string} theme - 'light' or 'dark'
 */
const loadPrismStylesheet = async (theme) => {
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