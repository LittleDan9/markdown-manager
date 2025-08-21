// Main services barrel export
// Provides clean import interface for all services

// Core business logic services
export * from './core';

// Editor services
export * from './editor';

// Content rendering services
export * from './rendering';

// Pure utility services
export * from './utilities';

// Legacy compatibility exports (can be removed later)
export { AuthService } from './core';
export { DocumentService, DocumentStorageService } from './core';
export {
  EditorService,
  CommentService,
  HighlightService,
  PerformanceOptimizer,
  SpellCheckService,
  SpellCheckWorkerPool
} from './editor';
export { render, MermaidService } from './rendering';
export { notification, DictionaryService, IconPackManager, AwsIconLoader } from './utilities';
