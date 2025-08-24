import { useEffect, useMemo } from 'react';
import { useTheme } from '@/providers/ThemeProvider';

/**
 * Custom hook for toolbar styling and theme management
 */
export function useToolbarStyling() {
  const { theme } = useTheme();

  const styles = useMemo(() => ({
    toolbar: {
      padding: '8px 12px',
      backgroundColor: theme === 'dark' ? 'var(--bs-dark)' : 'var(--bs-light)',
    },
    button: {
      border: 'none',
      padding: '4px 8px',
      margin: '0 2px',
      color: theme === 'dark' ? '#fff' : '#6c757d'
    },
    separator: {
      borderLeft: `1px solid ${theme === 'dark' ? '#495057' : '#dee2e6'}`,
      height: '24px'
    }
  }), [theme]);

  const buttonVariant = useMemo(() => 
    theme === 'dark' ? 'outline-light' : 'outline-secondary'
  , [theme]);

  // Add custom CSS for proper hover states
  useEffect(() => {
    const styleId = 'markdown-toolbar-styles';
    let existingStyle = document.getElementById(styleId);

    if (!existingStyle) {
      existingStyle = document.createElement('style');
      existingStyle.id = styleId;
      document.head.appendChild(existingStyle);
    }

    existingStyle.textContent = `
      .markdown-toolbar .btn-outline-light:hover {
        color: #000 !important;
        background-color: #f8f9fa !important;
        border-color: #f8f9fa !important;
      }

      .markdown-toolbar .btn-outline-secondary:hover {
        color: #fff !important;
        background-color: #6c757d !important;
        border-color: #6c757d !important;
      }
    `;

    // Cleanup function to remove styles when component unmounts
    return () => {
      const style = document.getElementById(styleId);
      if (style) {
        style.remove();
      }
    };
  }, [theme]);

  return {
    styles,
    buttonVariant
  };
}
