import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import HighlightingApi from "@/api/highlightingApi";

const SYNTAX_THEME_STYLE_ID = "syntax-theme-style";

// Known companion pairs for auto-switching on dark/light toggle
const COMPANION_MAP = {
  "one-dark": "one-light",
  "one-light": "one-dark",
  "github-dark": "github-light",
  "github-light": "github-dark",
  "gruvbox-dark": "gruvbox-light",
  "gruvbox-light": "gruvbox-dark",
  "solarized-dark": "solarized-light",
  "solarized-light": "solarized-dark",
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
  const cssCacheRef = useRef({});

  const [theme, setTheme] = useState(() => {
    let theme = localStorage.getItem("theme");
    if (theme !== "light" && theme !== "dark") {
      const sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      theme = sysDark ? "dark" : "light";
    }
    // Apply theme immediately to prevent flash
    document.documentElement.setAttribute("data-bs-theme", theme);
    localStorage.setItem("theme", theme);
    return theme;
  });

  const toggleTheme = () => {
    setTheme(prev => prev === "dark" ? "light" : "dark");
  };

  /**
   * Load syntax theme CSS from the backend API and inject into a <style> tag.
   * Caches CSS in memory to avoid redundant fetches.
   */
  const loadSyntaxThemeCSS = useCallback(async (styleName) => {
    if (!styleName) return;

    let css = cssCacheRef.current[styleName];
    if (!css) {
      css = await HighlightingApi.getStyleCSS(styleName);
      if (css) {
        cssCacheRef.current[styleName] = css;
      }
    }

    if (css) {
      let styleEl = document.getElementById(SYNTAX_THEME_STYLE_ID);
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = SYNTAX_THEME_STYLE_ID;
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = css;
    }
  }, []);

  // Apply theme side effects when theme changes
  useEffect(() => {
    document.documentElement.setAttribute("data-bs-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Load syntax theme on mount
  useEffect(() => {
    const syntaxTheme = localStorage.getItem("syntaxTheme") || "one-dark";
    loadSyntaxThemeCSS(syntaxTheme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-switch to companion syntax theme when app theme toggles
  const prevThemeRef = useRef(theme);
  useEffect(() => {
    if (prevThemeRef.current === theme) return;
    prevThemeRef.current = theme;

    const currentSyntax = localStorage.getItem("syntaxTheme") || "one-dark";
    const companion = COMPANION_MAP[currentSyntax];
    if (companion) {
      localStorage.setItem("syntaxTheme", companion);
      loadSyntaxThemeCSS(companion);
      // Notify AuthProvider so its React state stays in sync
      window.dispatchEvent(new CustomEvent("syntaxThemeChanged", { detail: companion }));
    }
  }, [theme, loadSyntaxThemeCSS]);

  return (
    <ThemeContext.Provider value={{
      theme,
      setTheme,
      toggleTheme,
      isDarkMode: theme === 'dark',
      loadSyntaxThemeCSS,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}
