---
applyTo: "frontend/src/services/linting/**/*"
description: "Phase 3: Rules Configuration System - MarkdownLintRulesService, API integration, rule management"
---

# Phase 3: Rules Configuration System

## 🎯 **Phase Objective**
Implement the rules configuration system that manages markdown linting rules per category and folder. This includes the service layer for rule resolution, local storage caching, and API integration for persistent rule storage.

## 📋 **Requirements Analysis**

### **Rule Hierarchy Requirements**
1. **System defaults**: Built-in sensible defaults for all markdownlint rules
2. **User defaults**: Personal preferences overriding system defaults
3. **Category rules**: Category-specific rule configurations
4. **Folder rules**: Folder-specific rules (highest priority)

### **Storage Requirements**
- **Local Storage**: Immediate rule caching for performance
- **Database**: Persistent storage via backend API
- **Synchronization**: Keep local and remote rules in sync

### **Configuration Format**
Follow markdownlint standard configuration format:
```javascript
{
  "MD001": true,                    // Enable rule
  "MD003": { "style": "atx" },      // Rule with configuration
  "MD013": false,                   // Disable rule
  "extends": ["base-config"]        // Future: rule inheritance
}
```

## 🔧 **Implementation Tasks**

### **Task 3.1: Create MarkdownLintRulesService**
**File**: `frontend/src/services/linting/MarkdownLintRulesService.js`

```javascript
/**
 * Service for managing markdown linting rules configuration
 * Handles rule hierarchy: folder > category > user defaults > system defaults
 * 
 * Integrates with:
 * - MarkdownLintService (Phase 2): Provides rules for API-based linting requests
 * - Backend markdown-lint-service (Phase 1): Node.js Express server for rule definitions
 * - Main backend API: Persists user/category/folder rule configurations
 */
export default class MarkdownLintRulesService {

  /**
   * System default rules based on markdownlint best practices
   * These provide sensible defaults for most use cases
   */
  static DEFAULT_RULES = {
    // Disabled by default (often too restrictive)
    MD013: false, // line-length - many docs exceed 80 chars

    // Heading rules
    MD001: true,  // heading-increment
    MD003: { style: 'atx' }, // heading-style (# ## ###)
    MD018: true,  // no-missing-space-atx
    MD019: true,  // no-multiple-space-atx
    MD020: true,  // no-missing-space-closed-atx
    MD021: true,  // no-multiple-space-closed-atx
    MD022: true,  // blanks-around-headings
    MD023: true,  // heading-start-left
    MD024: true,  // no-duplicate-heading
    MD025: true,  // single-title
    MD026: true,  // no-trailing-punctuation

    // List rules
    MD004: { style: 'dash' }, // ul-style
    MD005: true,  // list-indent
    MD007: { indent: 2 }, // ul-indent
    MD029: { style: 'ordered' }, // ol-prefix
    MD030: true,  // list-marker-space
    MD032: true,  // blanks-around-lists

    // Spacing rules
    MD009: true,  // no-trailing-spaces
    MD010: true,  // no-hard-tabs
    MD012: { maximum: 2 }, // no-multiple-blanks
    MD027: true,  // no-multiple-space-blockquote

    // Link and image rules
    MD011: true,  // no-reversed-links
    MD034: true,  // no-bare-urls
    MD039: true,  // no-space-in-links
    MD042: true,  // no-empty-links
    MD045: true,  // no-alt-text
    MD051: true,  // link-fragments
    MD052: true,  // reference-links-images
    MD053: true,  // link-image-reference-definitions

    // Code rules
    MD031: true,  // blanks-around-fences
    MD040: true,  // fenced-code-language
    MD046: { style: 'fenced' }, // code-block-style
    MD048: { style: 'backtick' }, // code-fence-style

    // Style rules
    MD033: false, // no-inline-html - often needed
    MD035: { style: 'consistent' }, // hr-style
    MD036: true,  // no-emphasis-as-heading
    MD037: true,  // no-space-in-emphasis
    MD038: true,  // no-space-in-code
    MD047: true,  // single-trailing-newline
    MD049: { style: 'asterisk' }, // emphasis-style
    MD050: { style: 'asterisk' }, // strong-style

    // Table rules
    MD054: { style: 'consistent' }, // link-image-style
    MD055: { style: 'consistent' }, // table-pipe-style
    MD056: true,  // table-column-count
    MD058: true   // blanks-around-tables
  };

  /**
   * Get applicable rules for a specific context
   * @param {string} folderPath - Folder path (e.g., "/projects/docs")
   * @param {number} categoryId - Category ID
   * @returns {Object} Merged rule configuration
   */
  static getApplicableRules(folderPath = null, categoryId = null) {
    // Start with system defaults
    let rules = { ...this.DEFAULT_RULES };

    // Apply user defaults
    const userRules = this.getUserDefaultRules();
    if (userRules) {
      rules = { ...rules, ...userRules };
    }

    // Apply category-specific rules
    if (categoryId) {
      const categoryRules = this.getCategoryRules(categoryId);
      if (categoryRules) {
        rules = { ...rules, ...categoryRules };
      }
    }

    // Apply folder-specific rules (highest priority)
    if (folderPath) {
      const folderRules = this.getFolderRules(folderPath);
      if (folderRules) {
        rules = { ...rules, ...folderRules };
      }
    }

    return rules;
  }

  /**
   * Get user default rules from local storage
   * @returns {Object|null} User default rules or null
   */
  static getUserDefaultRules() {
    try {
      const stored = localStorage.getItem('markdownlint_user_defaults');
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.warn('Failed to load user default rules:', error);
      return null;
    }
  }

  /**
   * Set user default rules
   * @param {Object} rules - Rule configuration object
   */
  static async setUserDefaultRules(rules) {
    try {
      localStorage.setItem('markdownlint_user_defaults', JSON.stringify(rules));

      // Future: Sync to backend
      // await MarkdownLintApi.updateUserDefaultRules(rules);
    } catch (error) {
      console.error('Failed to save user default rules:', error);
      throw new Error('Failed to save user preferences');
    }
  }

  /**
   * Get category-specific rules
   * @param {number} categoryId - Category ID
   * @returns {Object|null} Category rules or null
   */
  static getCategoryRules(categoryId) {
    try {
      const key = `markdownlint_category_${categoryId}`;
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.warn(`Failed to load category rules for ${categoryId}:`, error);
      return null;
    }
  }

  /**
   * Set category-specific rules
   * @param {number} categoryId - Category ID
   * @param {Object} rules - Rule configuration object
   */
  static async setCategoryRules(categoryId, rules) {
    try {
      const key = `markdownlint_category_${categoryId}`;
      localStorage.setItem(key, JSON.stringify(rules));

      // Sync to backend via API
      const MarkdownLintApi = await import('../../api/markdownLintApi');
      await MarkdownLintApi.default.updateCategoryRules(categoryId, rules);
    } catch (error) {
      console.error(`Failed to save category rules for ${categoryId}:`, error);
      throw new Error('Failed to save category rules');
    }
  }

  /**
   * Get folder-specific rules
   * @param {string} folderPath - Folder path
   * @returns {Object|null} Folder rules or null
   */
  static getFolderRules(folderPath) {
    try {
      const normalizedPath = this._normalizeFolderPath(folderPath);
      const key = `markdownlint_folder_${btoa(normalizedPath)}`;
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.warn(`Failed to load folder rules for ${folderPath}:`, error);
      return null;
    }
  }

  /**
   * Set folder-specific rules
   * @param {string} folderPath - Folder path
   * @param {Object} rules - Rule configuration object
   */
  static async setFolderRules(folderPath, rules) {
    try {
      const normalizedPath = this._normalizeFolderPath(folderPath);
      const key = `markdownlint_folder_${btoa(normalizedPath)}`;
      localStorage.setItem(key, JSON.stringify(rules));

      // Sync to backend via API
      const MarkdownLintApi = await import('../../api/markdownLintApi');
      await MarkdownLintApi.default.updateFolderRules(normalizedPath, rules);
    } catch (error) {
      console.error(`Failed to save folder rules for ${folderPath}:`, error);
      throw new Error('Failed to save folder rules');
    }
  }

  /**
   * Load rules from backend and cache locally
   * @param {number} categoryId - Category ID (optional)
   * @param {string} folderPath - Folder path (optional)
   */
  static async loadRulesFromBackend(categoryId = null, folderPath = null) {
    try {
      const MarkdownLintApi = await import('../../api/markdownLintApi');

      if (categoryId) {
        const categoryRules = await MarkdownLintApi.default.getCategoryRules(categoryId);
        if (categoryRules) {
          const key = `markdownlint_category_${categoryId}`;
          localStorage.setItem(key, JSON.stringify(categoryRules));
        }
      }

      if (folderPath) {
        const normalizedPath = this._normalizeFolderPath(folderPath);
        const folderRules = await MarkdownLintApi.default.getFolderRules(normalizedPath);
        if (folderRules) {
          const key = `markdownlint_folder_${btoa(normalizedPath)}`;
          localStorage.setItem(key, JSON.stringify(folderRules));
        }
      }
    } catch (error) {
      console.warn('Failed to load rules from backend:', error);
      // Continue with cached rules
    }
  }

  /**
   * Get all available rule definitions with descriptions
   * @returns {Object} Rule definitions
   */
  static getRuleDefinitions() {
    return {
      // Heading rules
      MD001: {
        name: 'heading-increment',
        description: 'Heading levels should only increment by one level at a time',
        category: 'Headings',
        fixable: false,
        configurable: false
      },
      MD003: {
        name: 'heading-style',
        description: 'Heading style',
        category: 'Headings',
        fixable: true,
        configurable: true,
        options: ['atx', 'atx_closed', 'setext', 'setext_with_atx']
      },
      MD004: {
        name: 'ul-style',
        description: 'Unordered list style',
        category: 'Lists',
        fixable: true,
        configurable: true,
        options: ['dash', 'asterisk', 'plus', 'consistent']
      },
      MD007: {
        name: 'ul-indent',
        description: 'Unordered list indentation',
        category: 'Lists',
        fixable: true,
        configurable: true,
        options: { indent: 'number' }
      },
      MD013: {
        name: 'line-length',
        description: 'Line length',
        category: 'Style',
        fixable: false,
        configurable: true,
        options: { line_length: 'number', code_blocks: 'boolean' }
      },
      MD040: {
        name: 'fenced-code-language',
        description: 'Fenced code blocks should have a language specified',
        category: 'Code',
        fixable: false,
        configurable: false
      }
      // ... add more rule definitions as needed
    };
  }

  /**
   * Validate rule configuration
   * @param {Object} rules - Rule configuration to validate
   * @returns {Object} Validation result with errors
   */
  static validateRules(rules) {
    const errors = [];
    const ruleDefinitions = this.getRuleDefinitions();

    Object.entries(rules).forEach(([ruleId, config]) => {
      if (!ruleDefinitions[ruleId]) {
        errors.push(`Unknown rule: ${ruleId}`);
        return;
      }

      const definition = ruleDefinitions[ruleId];

      // Validate configuration format
      if (typeof config === 'boolean') {
        // Boolean configuration is always valid
        return;
      }

      if (typeof config === 'object' && config !== null) {
        if (!definition.configurable) {
          errors.push(`Rule ${ruleId} does not accept configuration`);
          return;
        }

        // Validate specific configuration options
        if (definition.options) {
          Object.keys(config).forEach(option => {
            if (!definition.options[option] && !definition.options.includes(option)) {
              errors.push(`Invalid option '${option}' for rule ${ruleId}`);
            }
          });
        }
      } else {
        errors.push(`Invalid configuration type for rule ${ruleId}`);
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Normalize folder path for consistent storage
   * @param {string} folderPath - Raw folder path
   * @returns {string} Normalized path
   * @private
   */
  static _normalizeFolderPath(folderPath) {
    if (!folderPath) return '/';

    // Ensure starts with /
    let normalized = folderPath.startsWith('/') ? folderPath : `/${folderPath}`;

    // Remove trailing / except for root
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  }

  /**
   * Clear all cached rules (useful for testing)
   */
  static clearCache() {
    const keys = Object.keys(localStorage).filter(key =>
      key.startsWith('markdownlint_')
    );
    keys.forEach(key => localStorage.removeItem(key));
  }
}
```

### **Task 3.2: Create API Integration**
**File**: `frontend/src/api/markdownLintApi.js`

```javascript
import Api from './Api';

/**
 * API client for markdown linting rules
 * Handles communication with backend for rule persistence
 */
export class MarkdownLintApi extends Api {

  /**
   * Get category-specific rules
   * @param {number} categoryId - Category ID
   * @returns {Promise<Object>} Category rules
   */
  async getCategoryRules(categoryId) {
    const response = await this.apiCall(`/api/markdown-lint/categories/${categoryId}/rules`);
    return response.data;
  }

  /**
   * Update category-specific rules
   * @param {number} categoryId - Category ID
   * @param {Object} rules - Rule configuration
   * @returns {Promise<Object>} Updated rules
   */
  async updateCategoryRules(categoryId, rules) {
    const response = await this.apiCall(`/api/markdown-lint/categories/${categoryId}/rules`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ rules })
    });
    return response.data;
  }

  /**
   * Get folder-specific rules
   * @param {string} folderPath - Folder path
   * @returns {Promise<Object>} Folder rules
   */
  async getFolderRules(folderPath) {
    const encodedPath = encodeURIComponent(folderPath);
    const response = await this.apiCall(`/api/markdown-lint/folders/${encodedPath}/rules`);
    return response.data;
  }

  /**
   * Update folder-specific rules
   * @param {string} folderPath - Folder path
   * @param {Object} rules - Rule configuration
   * @returns {Promise<Object>} Updated rules
   */
  async updateFolderRules(folderPath, rules) {
    const encodedPath = encodeURIComponent(folderPath);
    const response = await this.apiCall(`/api/markdown-lint/folders/${encodedPath}/rules`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ rules })
    });
    return response.data;
  }

  /**
   * Get user default rules
   * @returns {Promise<Object>} User default rules
   */
  async getUserDefaultRules() {
    const response = await this.apiCall('/api/markdown-lint/user/defaults');
    return response.data;
  }

  /**
   * Update user default rules
   * @param {Object} rules - Rule configuration
   * @returns {Promise<Object>} Updated rules
   */
  async updateUserDefaultRules(rules) {
    const response = await this.apiCall('/api/markdown-lint/user/defaults', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ rules })
    });
    return response.data;
  }

  /**
   * Get all rule definitions and descriptions
   * Note: This endpoint should proxy to the markdown-lint-service 
   * (created in Phase 1) to get the latest rule definitions
   * @returns {Promise<Object>} Rule definitions
   */
  async getRuleDefinitions() {
    const response = await this.apiCall('/api/markdown-lint/rules/definitions');
    return response.data;
  }
}

export default new MarkdownLintApi();
```

### **Task 3.3: Create Hooks for Rule Management**
**File**: `frontend/src/hooks/useMarkdownLintRules.js`

```javascript
import { useState, useEffect, useCallback } from 'react';
import MarkdownLintRulesService from '../services/linting/MarkdownLintRulesService';

/**
 * Hook for managing markdown lint rules
 * Provides methods to get, set, and validate rules for different contexts
 */
export function useMarkdownLintRules(categoryId = null, folderPath = null) {
  const [rules, setRules] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Load applicable rules for current context
   */
  const loadRules = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Load from backend first (cache update)
      await MarkdownLintRulesService.loadRulesFromBackend(categoryId, folderPath);

      // Get applicable rules with hierarchy
      const applicableRules = MarkdownLintRulesService.getApplicableRules(folderPath, categoryId);
      setRules(applicableRules);
    } catch (err) {
      setError(err.message);
      // Fallback to cached rules
      const fallbackRules = MarkdownLintRulesService.getApplicableRules(folderPath, categoryId);
      setRules(fallbackRules);
    } finally {
      setLoading(false);
    }
  }, [categoryId, folderPath]);

  /**
   * Update category rules
   */
  const updateCategoryRules = useCallback(async (newRules) => {
    if (!categoryId) {
      throw new Error('No category ID provided');
    }

    setLoading(true);
    setError(null);

    try {
      await MarkdownLintRulesService.setCategoryRules(categoryId, newRules);
      await loadRules(); // Reload to get updated merged rules
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [categoryId, loadRules]);

  /**
   * Update folder rules
   */
  const updateFolderRules = useCallback(async (newRules) => {
    if (!folderPath) {
      throw new Error('No folder path provided');
    }

    setLoading(true);
    setError(null);

    try {
      await MarkdownLintRulesService.setFolderRules(folderPath, newRules);
      await loadRules(); // Reload to get updated merged rules
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [folderPath, loadRules]);

  /**
   * Update user default rules
   */
  const updateUserDefaults = useCallback(async (newRules) => {
    setLoading(true);
    setError(null);

    try {
      await MarkdownLintRulesService.setUserDefaultRules(newRules);
      await loadRules(); // Reload to get updated merged rules
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadRules]);

  /**
   * Validate rule configuration
   */
  const validateRules = useCallback((rulesToValidate) => {
    return MarkdownLintRulesService.validateRules(rulesToValidate);
  }, []);

  /**
   * Get rule definitions
   */
  const getRuleDefinitions = useCallback(() => {
    return MarkdownLintRulesService.getRuleDefinitions();
  }, []);

  // Load rules on mount and when context changes
  useEffect(() => {
    loadRules();
  }, [loadRules]);

  return {
    rules,
    loading,
    error,
    loadRules,
    updateCategoryRules,
    updateFolderRules,
    updateUserDefaults,
    validateRules,
    getRuleDefinitions
  };
}

export default useMarkdownLintRules;
```

### **Task 3.4: Update Service Index**
**File**: `frontend/src/services/linting/index.js`

```javascript
// Export linting services
export { default as MarkdownLintRulesService } from './MarkdownLintRulesService';

// Future exports
// export { default as MarkdownLintConfigService } from './MarkdownLintConfigService';
// export { default as MarkdownLintPresets } from './MarkdownLintPresets';
```

## ✅ **Verification Steps**

1. **Rule Resolution**: Verify rule hierarchy works correctly (folder > category > user > system)
2. **Local Storage**: Confirm rules are cached and retrieved properly
3. **API Integration**: Test backend synchronization
4. **Validation**: Verify rule configuration validation works
5. **Hook Integration**: Confirm useMarkdownLintRules hook functions correctly

## 🔗 **Integration Points**

- **Previous Phase**: Used by MarkdownLintService from Phase 1
- **Next Phase**: Phase 4 will create UI components using this service
- **Backend**: Requires API endpoints from Phase 6
- **Storage**: Uses local storage for caching and performance

## 📊 **Performance Considerations**

- **Caching**: Local storage prevents repeated API calls
- **Lazy Loading**: API module loaded only when needed
- **Rule Merging**: Efficient object merging for rule hierarchy
- **Validation**: Client-side validation reduces server round trips

This phase provides the complete rule management foundation that enables flexible, hierarchical rule configuration while maintaining performance through intelligent caching.