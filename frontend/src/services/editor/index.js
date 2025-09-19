// Editor domain services
export { default as EditorService } from './EditorService';
export { default as CommentService } from './CommentService';
export { default as HighlightService } from './HighlightService';
export { default as PerformanceOptimizer } from './PerformanceOptimizer';
export { default as SpellCheckService } from './SpellCheckService';
export { default as SpellCheckWorkerPool } from './SpellCheckWorkerPool';

// Markdown linting services
export { default as MarkdownLintService } from './MarkdownLintService';
export { default as MarkdownLintMarkers } from './MarkdownLintMarkers';
export { default as MarkdownLintMarkerAdapter } from './MarkdownLintMarkerAdapter';
export { default as MarkdownLintActions } from './MarkdownLintActions';

// Spell check utilities
export { default as SpellCheckMarkers } from './SpellCheckMarkers';
export { default as TextRegionAnalyzer } from './TextRegionAnalyzer';
export { default as MonacoMarkerAdapter } from './MonacoMarkerAdapter';
export { default as SpellCheckActions } from './SpellCheckActions';
export { default as MarkdownParser } from './MarkdownParser';

// Backward compatibility exports
export const clearSpellCheckMarkers = (editor, suggestionsMap) =>
  SpellCheckMarkers.clearMarkers(editor, suggestionsMap);

export const getChangedRegion = (editor, prevValue, newValue, fullTextThreshold = 2000) =>
  TextRegionAnalyzer.getChangedRegion(editor, prevValue, newValue, fullTextThreshold);

export const toMonacoMarkers = (editor, issues, startOffset, prevSuggestionsMap = new Map()) =>
  MonacoMarkerAdapter.toMonacoMarkers(editor, issues, startOffset, prevSuggestionsMap);

export const registerQuickFixActions = (editor, suggestionsMapRef, getCategoryId = null, getFolderPath = null) =>
  SpellCheckActions.registerQuickFixActions(editor, suggestionsMapRef, getCategoryId, getFolderPath);
