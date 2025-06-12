/**
 * js/preview.js
 *
 * renderPreviewOnChange(editor)
 *   - Takes a Monaco editor instance
 *   - Reads its current text, renders it using mermaid.render(),
 *     and injects the resulting SVG directly into #preview.
 *   - If there’s a parsing problem, we catch it and log it.
 */
export async function renderPreviewOnChange(editor) {
  if (typeof mermaid === 'undefined') {
    console.error('Mermaid is not loaded. Check the script tag.');
    return;
  }

  try {

    const code = editor.getValue();
    const { svg } = await mermaid.render('diagram-' + Date.now(), code);

    const previewDiv = document.getElementById('preview');
    previewDiv.innerHTML = '';
    const graphDiv = document.createElement('div');
    graphDiv.className = 'mermaid';
    previewDiv.appendChild(graphDiv);
    graphDiv.innerHTML = svg;
  } catch (err) {
    console.error('Mermaid parse error:', err);
    graphDiv.innerHTML = '<span style="color: red;">Error rendering diagram</span>';
  }
}