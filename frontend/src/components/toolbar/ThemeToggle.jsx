import React from "react";
import { useTheme } from "../../context/ThemeContext";

function ThemeToggle({ idPrefix = "" }) {
  const { theme } = useTheme();
  return (
    <>
      <i
        id={idPrefix + "themeIcon"}
        className={`bi me-2 ${theme === "dark" ? "bi-sun-fill" : "bi-moon-fill"}`}
        style={{ cursor: "pointer" }}
      ></i>
      <span id={idPrefix + "themeText"} style={{ cursor: "pointer" }}>
        {theme === "dark" ? "Light Theme" : "Dark Theme"}
      </span>
    </>
  );
}

export default ThemeToggle;
