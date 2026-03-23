import { useState, useEffect, useCallback } from 'react';
import documentsApi from '@/api/documentsApi';
import DocumentStorageService from '@/services/core/DocumentStorageService';

const SORT_KEY = 'tabSortOrder';
const DISABLED_KEY = 'tabsDisabledCategories';

function getLocalSortOrder() {
  return localStorage.getItem(SORT_KEY) || 'name';
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
    case 'created':
      sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      break;
    case 'modified':
      sorted.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      break;
    case 'name':
    default:
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
  }
  return sorted;
}

/**
 * Hook to resolve sibling documents for the tab bar.
 * Authenticated users hit the API; guests derive siblings from localStorage.
 */
export default function useSiblingDocs(currentDocument, isAuthenticated, tabSortOrder) {
  const [siblingDocs, setSiblingDocs] = useState([]);
  const [tabsEnabled, setTabsEnabled] = useState(true);
  const [categoryName, setCategoryName] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const sortOrder = tabSortOrder || getLocalSortOrder();

  const refreshSiblings = useCallback(async () => {
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
  }, [currentDocument?.id, currentDocument?.category, isAuthenticated, sortOrder]);

  useEffect(() => {
    refreshSiblings();
  }, [refreshSiblings]);

  return { siblingDocs, tabsEnabled, categoryName, isLoading, refreshSiblings };
}
