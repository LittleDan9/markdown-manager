import React, { createContext, useContext, useState, useEffect } from "react";

// Create a context for theme
export const ThemeContext = createContext({
  theme: "light",
  setTheme: () => {},
});

export function ThemeProvider({ children }) {
  // Get initial theme from localStorage or system preference
  const getInitialTheme = () => {
    let theme = localStorage.getItem("theme");
    if (theme !== "light" && theme !== "dark") {
      const sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      theme = sysDark ? "dark" : "light";
    }
    return theme;
  };

  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (event) => setTheme(event.matches ? "dark" : "light");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Custom hook for easy access
export function useTheme() {
  return useContext(ThemeContext);
}
