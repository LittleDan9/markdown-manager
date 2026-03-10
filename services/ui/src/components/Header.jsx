import React from "react";

function Header() {
  return (
    <header id="appHeader">
      <div className="header-inner">
        <div className="app-brand">
          <span className="brand-icon-wrapper">
            <i className="bi bi-markdown-fill"></i>
          </span>
          <span className="brand-text">
            Markdown<span className="brand-text-accent">Manager</span>
          </span>
        </div>
      </div>
    </header>
  );
}

export default Header;
