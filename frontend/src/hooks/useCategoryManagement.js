import { useState, useCallback, useEffect } from 'react';
import DocumentStorage from '../storage/DocumentStorage';

export default function useCategoryManagement({ isAuthenticated, token }) {
  const DEFAULT_CATEGORY = 'General';
  const DRAFTS_CATEGORY = 'Drafts';
  // Ensure both Drafts and General appear first by default
  const stored = DocumentStorage.getCategories() || [];
  const initialCategories = Array.from(
    new Set([DRAFTS_CATEGORY, DEFAULT_CATEGORY, ...stored])
  );
  const [categories, setCategories] = useState(initialCategories);
  // Ensure Drafts exists for all users (sync to backend if needed)
  useEffect(() => {
    if (isAuthenticated && !categories.includes(DRAFTS_CATEGORY)) {
      // addCategory will sync to storage/backend
      addCategory(DRAFTS_CATEGORY).then((updated) => setCategories(updated));
    }
  }, [isAuthenticated, categories, addCategory]);

  const addCategory = useCallback(async (category) => {
    const name = (category || '').trim();
    if (!name || name === DEFAULT_CATEGORY || name === DRAFTS_CATEGORY) {
      return categories;
    }
    const updated = await DocumentStorage.addCategory(name, isAuthenticated, token);
    setCategories(updated);
    return updated;
  }, [isAuthenticated, token]);

  const deleteCategory = useCallback(async (name, options = {}) => {
    if (name === DEFAULT_CATEGORY || name === DRAFTS_CATEGORY) {
      return categories;
    }
    const updated = await DocumentStorage.deleteCategory(name, options, isAuthenticated, token);
    setCategories(updated);
    return updated;
  }, [isAuthenticated, token]);

  const renameCategory = useCallback(async (oldName, newName) => {
    const name = (newName || '').trim();
    if (
      oldName === DEFAULT_CATEGORY ||
      oldName === DRAFTS_CATEGORY ||
      !name ||
      name === DEFAULT_CATEGORY ||
      name === DRAFTS_CATEGORY
    ) {
      return categories;
    }
    const updated = await DocumentStorage.renameCategory(oldName, name, isAuthenticated, token);
    setCategories(updated);
    return updated;
  }, [isAuthenticated, token]);

  return { categories, setCategories, addCategory, deleteCategory, renameCategory };
}
