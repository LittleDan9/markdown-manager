import { useState, useEffect, useCallback } from 'react';
import documentsApi from '@/api/documentsApi';
import DocumentStorageService from '@/services/core/DocumentStorageService';

const SORT_KEY = 'tabSortOrder';
const DISABLED_KEY = 'tabsDisabledCategories';

function getLocalSortOrder() {
  const saved = localStorage.getItem(SORT_KEY);
  // Migrate legacy sort values
  const migrationMap = { name: 'alpha_asc', created: 'opened_asc', modified: 'opened_desc' };
  if (saved && migrationMap[saved]) {
    const migrated = migrationMap[saved];
    localStorage.setItem(SORT_KEY, migrated);
    return migrated;
  }
  return saved || 'opened_desc';
}

function getLocalDisabledCategories() {
  try {
    return JSON.parse(localStorage.getItem(DISABLED_KEY) || '[]');
  } catch {
    return [];
  }
}

function sortDocs(docs, sortOrder) {
  const sorted = [...docs];
  switch (sortOrder) {
    case 'alpha_desc':
      sorted.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case 'opened_desc':
      sorted.sort((a, b) => {
        if (!a.last_opened_at && !b.last_opened_at) return 0;
        if (!a.last_opened_at) return 1;
        if (!b.last_opened_at) return -1;
        return new Date(b.last_opened_at) - new Date(a.last_opened_at);
      });
      break;
    case 'opened_asc':
      sorted.sort((a, b) => {
        if (!a.last_opened_at && !b.last_opened_at) return 0;
        if (!a.last_opened_at) return 1;
        if (!b.last_opened_at) return -1;
        return new Date(a.last_opened_at) - new Date(b.last_opened_at);
      });
      break;
    case 'alpha_asc':
    default:
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
  }
  return sorted;
}

/**
 * Hook to resolve sibling documents for the tab bar.
 * Authenticated users hit the API; guests derive siblings from localStorage.
 *
 * Supports an "override mode" where siblings are pinned to an explicit list
 * (e.g. recent documents) instead of being derived from the current document's category.
 */
export default function useSiblingDocs(currentDocument, isAuthenticated, tabSortOrder) {
  const [siblingDocs, setSiblingDocs] = useState([]);
  const [tabsEnabled, setTabsEnabled] = useState(true);
  const [categoryName, setCategoryName] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Override mode: when set, siblings are pinned to an explicit list
  const [overrideMode, setOverrideMode] = useState(null);   // e.g. 'recents'
  const [overrideDocs, setOverrideDocs] = useState([]);
  const [overrideLabel, setOverrideLabel] = useState(null);

  const sortOrder = tabSortOrder || getLocalSortOrder();

  const setSiblingOverride = useCallback((mode, docs, label) => {
    setOverrideMode(mode);
    setOverrideDocs(docs);
    setOverrideLabel(label || mode);
    // Apply the override immediately to visible state
    setSiblingDocs(docs);
    setTabsEnabled(true);
    setCategoryName(label || mode);
  }, []);

  const clearSiblingOverride = useCallback(() => {
    setOverrideMode(null);
    setOverrideDocs([]);
    setOverrideLabel(null);
  }, []);

  const refreshSiblings = useCallback(async () => {
    // When in override mode, skip category-based resolution
    if (overrideMode) {
      setSiblingDocs(overrideDocs);
      setTabsEnabled(true);
      setCategoryName(overrideLabel);
      return;
    }

    if (!currentDocument?.id) {
      setSiblingDocs([]);
      setTabsEnabled(true);
      setCategoryName(null);
      return;
    }

    setIsLoading(true);
    try {
      if (isAuthenticated && !String(currentDocument.id).startsWith('doc_')) {
        // Authenticated: use API
        const data = await documentsApi.getSiblingDocuments(currentDocument.id, sortOrder);
        setSiblingDocs(data.siblings || []);
        setTabsEnabled(data.tabs_enabled !== false);
        setCategoryName(data.category_name || null);
      } else {
        // Guest: derive from localStorage
        const category = currentDocument.category || 'General';
        const disabledCategories = getLocalDisabledCategories();
        if (disabledCategories.includes(category)) {
          setTabsEnabled(false);
          setSiblingDocs([]);
          setCategoryName(category);
          return;
        }

        const allDocs = DocumentStorageService.getAllDocuments();
        const siblings = allDocs
          .filter(d => (d.category || 'General') === category)
          .map(d => ({
            id: d.id,
            name: d.name,
            created_at: d.created_at || new Date().toISOString(),
            updated_at: d.updated_at || new Date().toISOString(),
            last_opened_at: d.last_opened_at || null,
          }));

        setSiblingDocs(sortDocs(siblings, sortOrder));
        setTabsEnabled(true);
        setCategoryName(category);
      }
    } catch (error) {
      console.warn('Failed to load sibling documents:', error);
      setSiblingDocs([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentDocument?.id, currentDocument?.category, isAuthenticated, sortOrder, overrideMode, overrideDocs, overrideLabel]);

  // Optimistic removal: immediately filter a doc from the tab list without an API call
  const removeSibling = useCallback((docId) => {
    setSiblingDocs(prev => prev.filter(d => d.id !== docId));
    // Also update override docs if in override mode so a refresh doesn't resurrect it
    if (overrideMode) {
      setOverrideDocs(prev => prev.filter(d => d.id !== docId));
    }
  }, [overrideMode]);

  // Update a sibling's name in-place (used after rename in override mode)
  const updateSiblingName = useCallback((docId, newName) => {
    setSiblingDocs(prev => prev.map(d => d.id === docId ? { ...d, name: newName } : d));
    if (overrideMode) {
      setOverrideDocs(prev => prev.map(d => d.id === docId ? { ...d, name: newName } : d));
    }
  }, [overrideMode]);

  useEffect(() => {
    refreshSiblings();
  }, [refreshSiblings]);

  return {
    siblingDocs, tabsEnabled, categoryName, isLoading,
    refreshSiblings, removeSibling, updateSiblingName,
    overrideMode, setSiblingOverride, clearSiblingOverride,
  };
}
