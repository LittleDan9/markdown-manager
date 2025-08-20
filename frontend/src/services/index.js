// Main services barrel export
// Provides clean import interface for all services

// Auth services
export * from './auth';

// Document services  
export * from './document';

// Editor services
export * from './editor';

// Rendering services
export * from './rendering';

// UI services
export * from './ui';

// Utility services
export * from './utils';

// Legacy compatibility exports (can be removed later)
export { AuthService } from './auth';
export { DocumentService, DocumentStorageService } from './document';
export { 
  EditorService, 
  CommentService, 
  HighlightService, 
  PerformanceOptimizer,
  SpellCheckService,
  SpellCheckWorkerPool 
} from './editor';
export { render, MermaidService } from './rendering';
export { notification } from './ui';
export { 
  AwsIconLoader, 
  DictionaryService, 
  IconPackManager, 
  ExampleAPIService 
} from './utils';
