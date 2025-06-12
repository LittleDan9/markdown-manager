export function setupEditor() {
  return new Promise(resolve => {
    require.config({
      paths: {
        vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.38.0/min/vs'
      }
    });
    require(['vs/editor/editor.main'], () => {
      const editor = monaco.editor.create(
        document.getElementById('editor'),
        {
          value: `%% Sample flowchart
flowchart LR
  A[Square Rect] --> B((Circle))
  B --> C{Rhombus?}
  C -->|One| D[Result 1]
  C -->|Two| E[Result 2]`,
          language: 'markdown',
          automaticLayout: true,
          theme: 'vs',
          minimap: { enabled: false },
          fontFamily: 'Consolas, Courier New, monospace',
          fontSize: 14
        }
      );
      resolve(editor);
    });
  });
}
