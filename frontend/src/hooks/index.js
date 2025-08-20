// Editor-related hooks for easy importing
export { default as useMonacoEditor } from './useMonacoEditor';
export { default as useSpellCheck } from './useSpellCheck';
export { default as useKeyboardShortcuts } from './useKeyboardShortcuts';
export { default as useListBehavior } from './useListBehavior';
export { default as useDebouncedCursorChange } from './useDebouncedCursorChange';

// This allows importing like:
// import { useMonacoEditor, useSpellCheck } from '@/hooks';
// or
// import { useMonacoEditor, useSpellCheck } from '@/hooks/editor';
