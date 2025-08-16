import { useCallback } from "react";

export function useFileExportController({ exportAsMarkdown, exportAsPDF, currentDocument, renderedHTML, theme}) {
  const handleExportMarkdown = useCallback(() => {
    if (!currentDocument) return;
    exportAsMarkdown(currentDocument.content, currentDocument.name);
  }, [exportAsMarkdown, currentDocument]);

  const handleExportPDF = useCallback(() => {
    if (!currentDocument || !renderedHTML) return;
    exportAsPDF(renderedHTML, currentDocument.name, theme);
  }, [exportAsPDF, currentDocument, renderedHTML]);

  return { handleExportMarkdown, handleExportPDF };
}
