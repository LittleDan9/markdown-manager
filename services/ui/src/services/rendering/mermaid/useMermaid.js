import { useState, useEffect, useCallback } from 'react';
import mermaidSingleton from './singleton.js';

/**
 * React hook for Mermaid diagram rendering.
 * Wraps the shared MermaidRenderer singleton with React-friendly
 * loading/theme state so all consumers share one cache and one
 * mermaid.initialize() call.
 */
export function useMermaid(initialTheme = 'default') {
  const [isInitialized, setIsInitialized] = useState(mermaidSingleton.isInitialized);
  const [currentTheme, setCurrentTheme] = useState(initialTheme);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize Mermaid on first mount (or when theme changes before init)
  useEffect(() => {
    const initializeMermaid = async () => {
      if (!isInitialized) {
        setIsLoading(true);
        try {
          await mermaidSingleton.init(currentTheme);
          setIsInitialized(true);
        } catch (error) {
          console.error('Failed to initialize Mermaid:', error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    initializeMermaid();
  }, [currentTheme, isInitialized]);

  /**
   * Update the theme for Mermaid diagrams
   * @param {string} newTheme - The new theme ('dark' or 'light')
   */
  const updateTheme = useCallback(async (newTheme) => {
    if (newTheme !== currentTheme) {
      setIsLoading(true);
      try {
        await mermaidSingleton.updateTheme(newTheme);
        setCurrentTheme(newTheme);
      } catch (error) {
        console.error('Failed to update Mermaid theme:', error);
      } finally {
        setIsLoading(false);
      }
    }
  }, [currentTheme]);

  /**
   * Render Mermaid diagrams in HTML content
   * @param {string} htmlContent - HTML string containing Mermaid blocks
   * @param {string} theme - Optional theme override
   * @returns {Promise<string>} - HTML string with rendered diagrams
   */
  const renderDiagrams = useCallback(async (htmlContent, theme = null) => {
    setIsLoading(true);
    try {
      const result = await mermaidSingleton.render(htmlContent, theme);
      return result;
    } catch (error) {
      console.error('Failed to render Mermaid diagrams:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Clear the diagram cache
   */
  const clearCache = useCallback(() => {
    mermaidSingleton.clearCache();
  }, []);

  /**
   * Get cache statistics
   * @returns {object} - Cache statistics
   */
  const getCacheStats = useCallback(() => {
    return mermaidSingleton.getCacheStats();
  }, []);

  return {
    isInitialized,
    isLoading,
    currentTheme,
    updateTheme,
    renderDiagrams,
    clearCache,
    getCacheStats,
  };
}

export default useMermaid;
