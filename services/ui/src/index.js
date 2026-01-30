import React from "react";
import { createRoot } from "react-dom/client";
import App from "./components/App.jsx";
import AppProviders from "./providers/AppProviders.jsx";

// Import Bootstrap CSS and JS (CSS will be extracted by webpack)
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
// import * as bootstrap from "bootstrap";

// Import KaTeX CSS for mathematical expressions
import "katex/dist/katex.min.css";

import "./styles/main.scss";

const container = document.getElementById("root");
const root = createRoot(container);
root.render(
  <AppProviders>
    <App />
  </AppProviders>
);
/* Force rebuild for KaTeX deployment Thu Jan 29 23:44:07 EST 2026 */
/* Force rebuild for KaTeX deployment Thu Jan 29 23:48:36 EST 2026 */
