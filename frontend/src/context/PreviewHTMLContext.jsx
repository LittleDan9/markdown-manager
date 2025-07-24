import React, { createContext, useContext, useState } from "react";

const PreviewHTMLContext = createContext();

export function usePreviewHTML() {
  return useContext(PreviewHTMLContext);
}

export function PreviewHTMLProvider({ children }) {
  const [previewHTML, setPreviewHTML] = useState("");
  return (
    <PreviewHTMLContext.Provider value={{ previewHTML, setPreviewHTML }}>
      {children}
    </PreviewHTMLContext.Provider>
  );
}
