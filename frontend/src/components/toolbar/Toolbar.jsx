import React, { useEffect, useState } from "react";
import FileDropdown from "./File";
import DocumentToolbar from "./Document";
import { useTheme } from "../../context/ThemeContext";

function Toolbar() {
  const { theme, setTheme } = useTheme();
  const [documentTitle, setDocumentTitle] = useState("Untitled Document");

  useEffect(() => {
    // Update theme icons for both guest and user menus
    const themeIcon = document.getElementById("themeIcon");
    const themeText = document.getElementById("themeText");
    const themeIconUser = document.getElementById("themeIconUser");
    const themeTextUser = document.getElementById("themeTextUser");

    const iconClass =
      theme === "dark" ? "bi bi-moon-fill me-2" : "bi bi-sun-fill me-2";
    const textContent = theme === "dark" ? "Dark Theme" : "Light Theme";

    if (themeIcon && themeText) {
      themeIcon.className = iconClass;
      themeText.textContent = textContent;
    }

    if (themeIconUser && themeTextUser) {
      themeIconUser.className = iconClass;
      themeTextUser.textContent = textContent;
    }
  });

  const handleThemeToggle = (e) => {
    e.preventDefault();
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
  };
  return (
    <nav id="toolbar" className="navbar navbar-expand-lg bg-body-tertiary px-3">
      <div className="d-flex align-items-center justify-content-between w-100">
        {/* Left side: File Menu & Document Title */}
        <div className="d-flex align-items-center gap-3">
          <FileDropdown setDocumentTitle={setDocumentTitle} />
          <div className="vr opacity-50"></div>
          <div className="d-flex align-items-center">
            <i className="bi bi-file-earmark-text me-2 text-muted"></i>
            <DocumentToolbar
              documentTitle={documentTitle}
              setDocumentTitle={setDocumentTitle}
            />
          </div>
        </div>
        {/* Right side: Utility Controls */}
        <div className="d-flex align-items-center gap-2" id="utilityControls">
          <button
            id="searchBtn"
            className="btn btn-sm btn-outline-secondary"
            data-bs-toggle="tooltip"
            data-bs-placement="bottom"
            title="Search (Coming Soon)"
            disabled
          >
            <i className="bi bi-search"></i>
          </button>
          <button
            id="fullScreenBtn"
            className="btn btn-sm btn-outline-secondary"
            data-bs-toggle="tooltip"
            data-bs-placement="bottom"
            title="Open preview in fullscreen"
          >
            <i className="bi bi-fullscreen"></i>
          </button>
          {/* User Profile Dropdown (simplified for now) */}
          <div className="dropdown" id="userDropdown">
            <button
              className="btn btn-outline-secondary btn-sm dropdown-toggle d-flex align-items-center gap-2"
              type="button"
              id="userMenuDropdown"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              <i className="bi bi-person-circle"></i>
              <span id="userDisplayName">Guest</span>
            </button>
            <ul
              className="dropdown-menu dropdown-menu-end"
              aria-labelledby="userMenuDropdown"
            >
              <li>
                <a className="dropdown-item" href="#" id="loginBtn">
                  <i className="bi bi-box-arrow-in-right me-2"></i>Login
                </a>
              </li>
              <li>
                <a className="dropdown-item" href="#" id="registerBtn">
                  <i className="bi bi-person-plus me-2"></i>Sign Up
                </a>
              </li>
              <li>
                <hr className="dropdown-divider" />
              </li>
              <li>
                <a
                  className="dropdown-item"
                  href="#"
                  id="themeToggleBtn"
                  onClick={handleThemeToggle}
                >
                  <i id="themeIcon" className="bi bi-sun-fill me-2"></i>
                  <span id="themeText">Light Theme</span>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Toolbar;
