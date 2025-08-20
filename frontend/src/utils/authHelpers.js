/**
 * Authentication helper utilities for localStorage operations
 */

/**
 * Get data from localStorage safely
 * @param {string} key - The localStorage key
 * @returns {any} - Parsed JSON data or null
 */
export function getLocalStorageData(key) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.warn(`Failed to get localStorage data for key "${key}":`, error);
    return null;
  }
}

/**
 * Set data in localStorage safely
 * @param {string} key - The localStorage key
 * @param {any} data - Data to store (will be JSON stringified)
 */
export function setLocalStorageData(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.warn(`Failed to set localStorage data for key "${key}":`, error);
  }
}

/**
 * Clear data from localStorage safely
 * @param {string} key - The localStorage key to remove
 */
export function clearLocalStorageData(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn(`Failed to clear localStorage data for key "${key}":`, error);
  }
}
