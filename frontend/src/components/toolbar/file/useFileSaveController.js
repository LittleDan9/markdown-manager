import { useCallback } from "react";

export function useFileSaveController({ saveDocument, currentDocument, editorValue, setDocumentTitle }) {
  const handleSave = useCallback(() => {
    if (!currentDocument) return;
    saveDocument({ ...currentDocument, content: editorValue });
    setDocumentTitle(currentDocument.name);
  }, [saveDocument, currentDocument, editorValue, setDocumentTitle]);

  return { handleSave };
}
