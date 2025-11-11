// Editor domain services
export { default as EditorService } from './EditorService';
export { default as CommentService } from './CommentService';
export { default as HighlightService } from './HighlightService';
export { default as PerformanceOptimizer } from './PerformanceOptimizer';

// Markdown linting services (from subfolder)
export {
  MarkdownLintService,
  MarkdownLintMarkers,
  MarkdownLintMarkerAdapter,
  MarkdownLintActions
} from './markdownLint';

// Spell check services (from subfolder)
export {
  SpellCheckService,
  SpellCheckWorkerPool,
  SpellCheckMarkers,
  SpellCheckActions,
  TextRegionAnalyzer
} from './spellCheck';

// Shared utilities
export { default as MonacoMarkerAdapter } from './MonacoMarkerAdapter';
export { default as MarkdownParser } from './MarkdownParser';
