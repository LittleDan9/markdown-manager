import React, { createContext, useContext, useState, useEffect } from "react";

const PRISM_THEME_ID = "prism-theme-style";
const THEMES = {
  dark: "/prism-themes/themes/prism-vsc-dark-plus.css",
  light: "/prism-themes/themes/prism-one-light.css",
};

// Create a context for theme
export const ThemeContext = createContext({
  theme: "light",
  setTheme: () => {},
  toggleTheme: () => {},
});

// Custom hook for easy access
export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }) {

  const [theme, setTheme] = useState(() => {
    let theme = localStorage.getItem("theme");
    if (theme !== "light" && theme !== "dark") {
      const sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      theme = sysDark ? "dark" : "light";
    }
    return theme;
  });

  const toggleTheme = () => {
    setTheme(prev => prev === "dark" ? "light" : "dark");
  };

  const setPrismTheme = (theme) => {
    let link = document.getElementById(PRISM_THEME_ID);
    if (!link) {
      link = document.createElement("link");
      link.id = PRISM_THEME_ID;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = THEMES[theme] || THEMES.light;
  }

  // Apply theme side effects (body class, localStorage)
  useEffect(() => {
    document.documentElement.setAttribute("data-bs-theme", theme);
    setPrismTheme(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
