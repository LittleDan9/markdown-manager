import React from "react";

function Header() {
  return (
    <header id="appHeader" className="bg-body-tertiary border-bottom">
      <div className="container-fluid px-3 py-2">
        <h1 className="h4 mb-0 text-center d-flex align-items-center justify-content-center gap-2">
          <i className="bi bi-markdown me-2 app-logo-light"></i>
          <i className="bi bi-markdown-fill me-2 app-logo-dark"></i>
          Markdown Manager
        </h1>
      </div>
    </header>
  );
}

export default Header;
