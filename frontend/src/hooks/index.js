// Hook registry: All custom hooks

// Core hooks
export { default as useDebouncedCursorChange } from './useDebouncedCursorChange';
export { default as useChangeTracker } from './useChangeTracker';
export { default as useSaveDocument } from './useSaveDocument';
export { default as useGlobalKeyboardShortcuts } from './useGlobalKeyboardShortcuts';
export { default as useAppUIState } from './useAppUIState';
export { default as useSharedViewEffects } from './useSharedViewEffects';
export { default as useDocumentAutoSave } from './useDocumentAutoSave';
export { default as useDocumentState } from './useDocumentState';
export { default as useEditor } from './useEditor';
export { default as useFileOperations } from './useFileOperations';
export { default as usePreviewHTMLState } from './usePreviewHTMLState';
export { default as useSharedViewState } from './useSharedViewState';
export { default as useConfirmModal } from './useConfirmModal';

// Optimization hooks
export { default as useDocumentWorkflow } from './useDocumentWorkflow';
export { default as usePerformanceMonitor } from './usePerformanceMonitor';
export { default as useMemoryOptimization } from './useMemoryOptimization';

// This allows importing like:
// import { useEditor, useSaveDocument, useDocumentWorkflow } from '@/hooks';
