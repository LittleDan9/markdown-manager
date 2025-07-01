import * as monaco from 'monaco-editor';
import { initMermaid, render } from './renderer';

import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-python';

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

export async function toggleTheme(theme) {
    localStorage.setItem("theme", theme);
    document.documentElement.setAttribute('data-bs-theme', theme);
    initMermaid(theme);
    await loadPrismStylesheet(theme);
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


