/**
 * Syntax highlighting service that uses the backend API for comprehensive language support
 */

import config from './config.js';

class SyntaxHighlightingService {
    constructor() {
        this.cache = new Map(); // Cache highlighted code to avoid redundant API calls
        this.supportedLanguages = new Set(); // Cache of supported languages
        this.apiBase = config.apiBaseUrl;
    }

    /**
     * Highlight code using the backend API
     * @param {string} code - The source code to highlight
     * @param {string} language - The programming language
     * @returns {Promise<string>} - HTML with syntax highlighting
     */
    async highlightCode(code, language) {
        if (!code || !code.trim()) {
            return this.escapeHtml(code);
        }

        if (!language) {
            return this.escapeHtml(code);
        }

        // Create cache key
        const cacheKey = `${language}:${this.hashCode(code)}`;

        // Check cache first
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const response = await fetch(`${this.apiBase}/highlight/highlight`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    code: code,
                    language: language
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();

            // Cache the result
            this.cache.set(cacheKey, result.highlighted_code);

            // Update supported languages cache
            if (result.is_supported) {
                this.supportedLanguages.add(language.toLowerCase());
            }

            return result.highlighted_code;

        } catch (error) {
            console.warn(`Failed to highlight code for language '${language}':`, error);
            // Fallback to escaped HTML
            const escaped = this.escapeHtml(code);
            this.cache.set(cacheKey, escaped);
            return escaped;
        }
    }

    /**
     * Check if a language is supported
     * @param {string} language - The programming language
     * @returns {Promise<boolean>} - Whether the language is supported
     */
    async isLanguageSupported(language) {
        if (!language) return false;

        const langLower = language.toLowerCase();

        // Check cache first
        if (this.supportedLanguages.has(langLower)) {
            return true;
        }

        try {
            const response = await fetch(`${this.apiBase}/highlight/languages/${encodeURIComponent(language)}/check`);

            if (!response.ok) {
                return false;
            }

            const result = await response.json();

            if (result.is_supported) {
                this.supportedLanguages.add(langLower);
            }

            return result.is_supported;

        } catch (error) {
            console.warn(`Failed to check language support for '${language}':`, error);
            return false;
        }
    }

    /**
     * Get all available languages
     * @returns {Promise<Object>} - Object mapping language aliases to full names
     */
    async getAvailableLanguages() {
        try {
            const response = await fetch(`${this.apiBase}/highlight/languages`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();
            return result.languages;

        } catch (error) {
            console.warn('Failed to get available languages:', error);
            return {};
        }
    }

    /**
     * Clear the highlighting cache
     */
    clearCache() {
        this.cache.clear();
        this.supportedLanguages.clear();
    }

    /**
     * Escape HTML characters
     * @param {string} text - Text to escape
     * @returns {string} - Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Simple hash function for cache keys
     * @param {string} str - String to hash
     * @returns {number} - Hash value
     */
    hashCode(str) {
        let hash = 0;
        if (str.length === 0) return hash;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash;
    }
}

// Export singleton instance
export default new SyntaxHighlightingService();
