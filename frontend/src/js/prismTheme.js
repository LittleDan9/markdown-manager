// Prism.js dynamic theme loader for Markdown Manager
// Supports switching between one-dark and one-light from prism-themes

const PRISM_THEME_ID = "prism-theme-style";
const THEMES = {
  dark: "prism-themes/themes/prism-one-dark.css",
  light: "prism-themes/themes/prism-one-light.css",
};

export function setPrismTheme(theme) {
  let link = document.getElementById(PRISM_THEME_ID);
  if (!link) {
    link = document.createElement("link");
    link.id = PRISM_THEME_ID;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  link.href = THEMES[theme] || THEMES.light;
}

export function initPrismTheme(theme) {
  setPrismTheme(theme);
}
