// Editor-related hooks for easy importing
export { default as useMonacoEditor } from './useMonacoEditor';
export { default as useSpellCheck } from './useSpellCheck';
export { default as useKeyboardShortcuts } from './useKeyboardShortcuts';
export { default as useListBehavior } from './useListBehavior';
export { default as useDebouncedCursorChange } from './useDebouncedCursorChange';

// App-level hooks
export { default as useAutoSave } from './useAutoSave';
export { default as useChangeTracker } from './useChangeTracker';
export { default as useSaveDocument } from './useSaveDocument';
export { default as useGlobalKeyboardShortcuts } from './useGlobalKeyboardShortcuts';
export { default as useAutoSaveManager } from './useAutoSaveManager';
export { default as useAppUIState } from './useAppUIState';
export { default as useSharedViewEffects } from './useSharedViewEffects';

// This allows importing like:
// import { useMonacoEditor, useSpellCheck } from '@/hooks';
// or
// import { useMonacoEditor, useSpellCheck } from '@/hooks/editor';
