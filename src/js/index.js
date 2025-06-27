import { EDITOR_KEY } from './constants';
import { initEditor } from './editor';
import { applyEditorTheme, initTheme, toggleTheme } from './theme';
import { render } from './renderer';

import '../styles/main.scss';

function debounce(fn, wait) {
  let t;
  return () => {
    clearTimeout(t);
    t = setTimeout(fn, wait);
  };
}

window.addEventListener('DOMContentLoaded', async () => {
    let theme = await initTheme();

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
        theme = event.matches ? "dark" : "light";
    });

    const editor = await initEditor(theme);
    await applyEditorTheme(theme, editor);

    const elThemeToggle = document.getElementById('themeToggle');
    elThemeToggle.addEventListener('change', async e => {
        theme = e.target.checked ? 'dark' : 'light';
        await toggleTheme(theme);
        await applyEditorTheme(theme, editor);
    });

    editor.onDidChangeModelContent(() => {
        const debouncedRender = debounce(() => render(editor), 300);
        debouncedRender();
        localStorage.setItem(EDITOR_KEY, editor.getValue());
    });
});