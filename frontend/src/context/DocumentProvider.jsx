import React, { createContext, useContext } from "react";
import { useAuth } from "./AuthProvider.jsx";
import { useNotification } from "../components/NotificationProvider.jsx";
import useDocuments from "../hooks/useDocuments";

const DocumentContext = createContext();

export function DocumentProvider({ children }) {
  const { token, user, isAuthenticated } = useAuth();
  const notification = useNotification();
  const docStore = useDocuments({ isAuthenticated, token, notification });
  const value = { user, token, isAuthenticated, ...docStore };

  return (
    <DocumentContext.Provider value={value}>
      {children}
    </DocumentContext.Provider>
  );
}

export function useDocument() {
  return useContext(DocumentContext);
}
