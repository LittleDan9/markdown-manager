import React from "react";
import { createRoot } from "react-dom/client";
import App from "./components/App.jsx";

// Import Bootstrap CSS and JS (CSS will be extracted by webpack)
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
// import * as bootstrap from "bootstrap";

import "./styles/main.scss";
import "prism-themes/themes/prism-one-dark.css";
import "prism-themes/themes/prism-one-light.css";

import { DocumentProvider } from "./context/DocumentProvider";
import { AuthProvider } from "./context/AuthProvider.jsx";

const container = document.getElementById("root");
const root = createRoot(container);
root.render(
  <AuthProvider>
    <DocumentProvider>
      <App />
    </DocumentProvider>
  </AuthProvider>
);
