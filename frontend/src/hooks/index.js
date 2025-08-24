// Hook registry: All custom hooks organized by concern
// This file provides a central export point for all hooks while maintaining organization

// Document hooks - Document state, operations, and lifecycle
export * from './document';

// Editor hooks - Monaco editor, cursor, and keyboard interactions  
export * from './editor';

// Dictionary hooks - Custom dictionary management
export * from './dictionary';

// Markdown hooks - Markdown formatting and toolbar functionality
export * from './markdown';

// UI hooks - User interface state, modals, and shared UI concerns
export * from './ui';

// Performance hooks - Optimization, monitoring, and memory management
export * from './performance';

// This allows importing from specific categories:
// import { useDocumentState, useSaveDocument } from '@/hooks/document';
// import { useEditor, useGlobalKeyboardShortcuts } from '@/hooks/editor';
// import { useDictionaryState } from '@/hooks/dictionary';
// 
// Or from the main barrel export:
// import { useDocumentState, useEditor, useDictionaryState } from '@/hooks';
