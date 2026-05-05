/**
 * Inline styles for clipboard HTML so that Word, Outlook, and other
 * rich-text consumers render elements correctly (they ignore external CSS).
 * Uses hardcoded light-theme colors since clipboard HTML has no theme context.
 */
export function inlineStylesForClipboard(html) {
  if (!html) return html;

  const container = document.createElement('div');
  container.innerHTML = html;

  // Tables
  container.querySelectorAll('table').forEach(el => {
    el.style.cssText += 'border-collapse:collapse;border-spacing:0;';
  });
  container.querySelectorAll('th').forEach(el => {
    el.style.cssText += 'border:1px solid #dee2e6;padding:8px 12px;text-align:left;font-weight:600;background-color:#f8f9fa;';
  });
  container.querySelectorAll('td').forEach(el => {
    el.style.cssText += 'border:1px solid #dee2e6;padding:8px 12px;text-align:left;';
  });

  // Headings
  const headingStyles = {
    H1: 'font-size:2em;font-weight:600;margin:0.67em 0;',
    H2: 'font-size:1.5em;font-weight:600;margin:0.75em 0;',
    H3: 'font-size:1.25em;font-weight:600;margin:0.83em 0;',
    H4: 'font-size:1em;font-weight:600;margin:1em 0;',
    H5: 'font-size:0.875em;font-weight:600;margin:1em 0;',
    H6: 'font-size:0.85em;font-weight:600;margin:1em 0;',
  };
  Object.entries(headingStyles).forEach(([tag, style]) => {
    container.querySelectorAll(tag).forEach(el => {
      el.style.cssText += style;
    });
  });

  // Code blocks (pre)
  container.querySelectorAll('pre').forEach(el => {
    el.style.cssText += 'background-color:#f8f9fa;padding:12px 16px;border-radius:6px;overflow-x:auto;font-family:SFMono-Regular,Consolas,Liberation Mono,Menlo,monospace;font-size:0.9em;';
  });

  // Inline code (code not inside pre)
  container.querySelectorAll('code').forEach(el => {
    if (el.closest('pre')) return;
    el.style.cssText += 'background-color:#f1f3f5;padding:2px 6px;border-radius:3px;font-family:SFMono-Regular,Consolas,Liberation Mono,Menlo,monospace;font-size:0.9em;';
  });

  // Blockquotes
  container.querySelectorAll('blockquote').forEach(el => {
    el.style.cssText += 'border-left:4px solid #dee2e6;padding-left:16px;margin-left:0;color:#495057;';
  });

  return container.innerHTML;
}
