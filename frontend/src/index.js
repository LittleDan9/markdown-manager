import React from "react";
import { createRoot } from "react-dom/client";
import App from "./components/App.jsx";
import GlobalErrorBoundary from "./components/GlobalErrorBoundary.jsx";

// Import Bootstrap CSS and JS (CSS will be extracted by webpack)
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
// import * as bootstrap from "bootstrap";

import "./styles/main.scss";

import { DocumentProvider } from "./context/DocumentProvider";
import { AuthProvider } from "./context/AuthContext";
import { NotificationProvider } from "./components/NotificationProvider.jsx";
import { RecoveryProvider } from "./components/recovery/RecoveryProvider.jsx";
import { LoggerProvider } from "./context/LoggerProvider.jsx";

const container = document.getElementById("root");
const root = createRoot(container);
root.render(
  <LoggerProvider>
    <GlobalErrorBoundary>
      <NotificationProvider>
        <AuthProvider>
          <RecoveryProvider>
            <DocumentProvider>
              <App />
            </DocumentProvider>
          </RecoveryProvider>
        </AuthProvider>
      </NotificationProvider>
    </GlobalErrorBoundary>
  </LoggerProvider>
);
