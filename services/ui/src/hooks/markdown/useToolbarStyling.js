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
      minWidth: 0, // Allow toolbar to shrink below content width
      overflow: 'hidden' // Hide overflow to prevent horizontal scroll
    },
    button: {
      border: 'none',
      padding: '4px 6px', // Reduced padding for more compact buttons
      margin: '0 1px',
      color: theme === 'dark' ? '#fff' : '#6c757d',
      flexShrink: 0 // Prevent buttons from shrinking
    },
    separator: {
      borderLeft: `1px solid ${theme === 'dark' ? '#495057' : '#dee2e6'}`,
      height: '24px',
      flexShrink: 0 // Prevent separators from shrinking
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

      /* Responsive toolbar styles */
      .markdown-toolbar {
        container-type: inline-size;
        container-name: toolbar;
      }

      .markdown-toolbar .analysis-tools {
        flex-shrink: 1; /* Allow analysis tools to shrink */
        min-width: 0; /* Allow shrinking below content width */
      }

      .markdown-toolbar .btn-group {
        flex-wrap: nowrap; /* Keep buttons in group from wrapping */
        gap: 0; /* Remove gap between grouped buttons */
      }

      /* Hide separators when space is tight */
      @container toolbar (width < 600px) {
        .markdown-toolbar .toolbar-separator {
          display: none;
        }
      }

      /* Reduce padding on very small screens */
      @container toolbar (width < 400px) {
        .markdown-toolbar {
          padding: 4px 8px;
        }
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
