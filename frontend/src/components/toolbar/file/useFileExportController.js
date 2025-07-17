import { useCallback } from "react";

export function useFileExportController({ exportAsMarkdown, exportAsPDF, currentDocument }) {
  const handleExportMarkdown = useCallback(() => {
    if (!currentDocument) return;
    exportAsMarkdown(currentDocument.content, currentDocument.name);
  }, [exportAsMarkdown, currentDocument]);

  const handleExportPDF = useCallback(() => {
    if (!currentDocument) return;
    exportAsPDF(currentDocument.content, currentDocument.name);
  }, [exportAsPDF, currentDocument]);

  return { handleExportMarkdown, handleExportPDF };
}
