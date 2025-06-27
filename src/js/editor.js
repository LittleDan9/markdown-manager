import * as monaco from 'monaco-editor';
import { EDITOR_KEY } from './constants';

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


const saved = localStorage.getItem(EDITOR_KEY) || defaultGraph;

export async function initEditor(theme) {
    const editor = monaco.editor.create(document.getElementById('editor'), {
        value: saved,
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
    return editor;
}