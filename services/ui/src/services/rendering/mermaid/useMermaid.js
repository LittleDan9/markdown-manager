import { useState, useEffect, useCallback, useRef } from 'react';
import MermaidRenderer from './MermaidRenderer.js';

/**
 * React hook for Mermaid diagram rendering
 * Provides a clean React interface for using the MermaidRenderer service
 */
export function useMermaid(initialTheme = 'default') {
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(initialTheme);
  const [isLoading, setIsLoading] = useState(false);
  const rendererRef = useRef(null);

  // Initialize renderer on first use
  useEffect(() => {
    if (!rendererRef.current) {
      rendererRef.current = new MermaidRenderer();
    }
  }, []);

  // Initialize Mermaid when theme changes
  useEffect(() => {
    const initializeMermaid = async () => {
      if (rendererRef.current && !isInitialized) {
        setIsLoading(true);
        try {
          await rendererRef.current.init(currentTheme);
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
    if (rendererRef.current && newTheme !== currentTheme) {
      setIsLoading(true);
      try {
        await rendererRef.current.updateTheme(newTheme);
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
    if (!rendererRef.current) {
      throw new Error('Mermaid renderer not initialized');
    }

    setIsLoading(true);
    try {
      const result = await rendererRef.current.render(htmlContent, theme);
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
    if (rendererRef.current) {
      rendererRef.current.clearCache();
    }
  }, []);

  /**
   * Get cache statistics
   * @returns {object} - Cache statistics
   */
  const getCacheStats = useCallback(() => {
    if (rendererRef.current) {
      return rendererRef.current.getCacheStats();
    }
    return { size: 0, theme: currentTheme, isInitialized };
  }, [currentTheme, isInitialized]);

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
