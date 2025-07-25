import { useState, useCallback, useEffect } from 'react';
import DocumentManager from '../storage/DocumentManager';

export default function useCategoryManagement({ isAuthenticated, token }) {
  const DEFAULT_CATEGORY = 'General';
  const DRAFTS_CATEGORY = 'Drafts';
  // Ensure both Drafts and General appear first by default
  const stored = DocumentManager.getCategories() || [];
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
    const updated = await DocumentManager.addCategory(name);
    setCategories(updated);
    return updated;
  }, [categories]);

  const deleteCategory = useCallback(async (name, options = {}) => {
    if (name === DEFAULT_CATEGORY || name === DRAFTS_CATEGORY) {
      return categories;
    }
    const updated = await DocumentManager.deleteCategory(name, options);
    setCategories(updated);
    return updated;
  }, [categories]);

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
    const updated = await DocumentManager.renameCategory(oldName, name);
    setCategories(updated);
    return updated;
  }, [categories]);

  return { categories, setCategories, addCategory, deleteCategory, renameCategory };
}
