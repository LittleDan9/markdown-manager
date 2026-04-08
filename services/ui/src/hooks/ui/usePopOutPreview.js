import { useRef, useEffect, useCallback } from 'react';

/**
 * Hook to manage pop-out read-only preview windows.
 * Opens a child window with a frozen snapshot of the rendered document.
 * All child windows close automatically when the parent window closes.
 */
export default function usePopOutPreview() {
  const childWindowsRef = useRef(new Set());

  // Clean up closed windows from the set periodically
  const pruneClosedWindows = useCallback(() => {
    for (const win of childWindowsRef.current) {
      if (win.closed) {
        childWindowsRef.current.delete(win);
      }
    }
  }, []);

  // Close all child windows on parent unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      for (const win of childWindowsRef.current) {
        try {
          if (!win.closed) win.close();
        } catch (_e) {
          // Cross-origin or already closed — ignore
        }
      }
      childWindowsRef.current.clear();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      handleBeforeUnload();
    };
  }, []);

  const openPopOut = useCallback((title, renderedHTML, theme) => {
    pruneClosedWindows();

    const child = window.open('', '', 'width=900,height=700,scrollbars=yes,resizable=yes');
    if (!child) return; // Popup blocked

    childWindowsRef.current.add(child);

    // Collect parent stylesheets to replicate in the child window
    const stylesheetLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map(link => `<link rel="stylesheet" href="${link.href}" />`)
      .join('\n');

    const escapedTitle = title
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    const html = `<!DOCTYPE html>
<html data-bs-theme="${theme === 'dark' ? 'dark' : 'light'}">
<head>
  <meta charset="utf-8" />
  <title>${escapedTitle} — Read-only Preview</title>
  ${stylesheetLinks}
  <style>
    body {
      margin: 0;
      padding: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    .popout-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-bottom: 1px solid var(--mm-border, #dee2e6);
      background: var(--mm-bg-surface, #f8f9fa);
      flex-shrink: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .popout-header .doc-title {
      font-weight: 600;
      font-size: 14px;
      color: var(--mm-text, #212529);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .popout-header .badge {
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 4px;
      background: var(--mm-primary, #4f6df5);
      color: #fff;
      font-weight: 500;
      flex-shrink: 0;
    }
    .popout-body {
      flex: 1;
      overflow-y: auto;
      padding: 24px 32px;
    }
  </style>
</head>
<body>
  <div class="popout-header">
    <i class="bi bi-file-earmark-text" style="font-size:16px;color:var(--mm-text-secondary,#6c757d)"></i>
    <span class="doc-title">${escapedTitle}</span>
    <span class="badge">
      <i class="bi bi-eye" style="margin-right:4px"></i>Read-only
    </span>
  </div>
  <div class="popout-body">
    <div class="preview-content">${renderedHTML || ''}</div>
  </div>
</body>
</html>`;

    child.document.open();
    child.document.write(html);
    child.document.close();

    // Remove from tracking set when child is closed by user
    child.addEventListener('beforeunload', () => {
      childWindowsRef.current.delete(child);
    });
  }, [pruneClosedWindows]);

  return { openPopOut };
}
