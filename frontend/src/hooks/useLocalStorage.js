import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for managing localStorage values with React state synchronization
 * @param {string} key - The localStorage key (e.g., 'editor-width')
 * @param {*} defaultValue - Default value if key doesn't exist
 * @returns {[value, setValue, removeValue]} - Current value, setter function, and remove function
 */
export function useLocalStorage(key, defaultValue) {
  // State to store our value
  const [storedValue, setStoredValue] = useState(() => {
    try {
      // Get from local storage by key
      const item = window.localStorage.getItem(key);
      // Parse stored json or if none return defaultValue
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      // If error also return defaultValue
      console.warn(`Error reading localStorage key "${key}":`, error);
      return defaultValue;
    }
  });

  // Return a wrapped version of useState's setter function that ...
  // ... persists the new value to localStorage.
  const setValue = useCallback((value) => {
    try {
      // Allow value to be a function so we have the same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      // Save state
      setStoredValue(valueToStore);
      // Save to local storage
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      // A more advanced implementation would handle the error case
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  // Remove value from localStorage
  const removeValue = useCallback(() => {
    try {
      setStoredValue(defaultValue);
      window.localStorage.removeItem(key);
    } catch (error) {
      console.warn(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, defaultValue]);

  // Listen for changes to this localStorage key from other tabs/windows
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setStoredValue(JSON.parse(e.newValue));
        } catch (error) {
          console.warn(`Error parsing localStorage change for "${key}":`, error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  return [storedValue, setValue, removeValue];
}

/**
 * Specialized hook for editor width percentage with validation
 * @param {number} defaultWidth - Default width percentage (defaults to 40)
 * @returns {[width, setWidth, resetWidth]} - Current width, setter, and reset function
 */
export function useEditorWidth(defaultWidth = 40) {
  const [width, setWidth, removeWidth] = useLocalStorage('markdown-manager-editor-width', defaultWidth);

  // Validated setter that ensures width is within bounds
  const setValidatedWidth = useCallback((newWidth) => {
    const validatedWidth = Math.max(10, Math.min(90, Math.round(newWidth)));
    setWidth(validatedWidth);
    return validatedWidth;
  }, [setWidth]);

  // Reset to default
  const resetWidth = useCallback(() => {
    setWidth(defaultWidth);
  }, [setWidth, defaultWidth]);

  return [width, setValidatedWidth, resetWidth];
}

export default useLocalStorage;