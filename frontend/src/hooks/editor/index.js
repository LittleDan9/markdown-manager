// Editor hooks - All hooks related to Monaco editor, cursor, and keyboard interactions
// Main orchestrating hook
export { default as useEditor } from './useEditor';

// Individual domain hooks (for potential future use)
export { default as useEditorCore } from './useEditorCore';
export { default as useEditorSpellCheck } from './useEditorSpellCheck';
export { default as useEditorMarkdownLint } from './useEditorMarkdownLint';
export { default as useEditorKeyboardShortcuts } from './useEditorKeyboardShortcuts';
export { default as useEditorListBehavior } from './useEditorListBehavior';

// Shared utilities
export * from './shared';

// Other editor hooks
export { default as useDebouncedCursorChange } from './useDebouncedCursorChange';
export { default as useGlobalKeyboardShortcuts } from './useGlobalKeyboardShortcuts';
