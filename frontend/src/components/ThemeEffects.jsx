import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { setPrismTheme } from '../js/prismTheme';
// import updateThemeIcon if needed

function ThemeEffects() {
  const { theme } = useTheme();
  React.useEffect(() => {
    document.documentElement.setAttribute("data-bs-theme", theme);
    setPrismTheme(theme);
  }, [theme]);

  return null;
}

export default ThemeEffects;