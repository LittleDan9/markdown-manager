// Mock implementations for editor services

export const EditorService = {
  init: jest.fn().mockResolvedValue(),
  setTheme: jest.fn(),
  getValue: jest.fn().mockReturnValue(''),
  setValue: jest.fn(),
  insertText: jest.fn(),
  focus: jest.fn(),
  dispose: jest.fn()
};

export const PerformanceOptimizer = {
  optimizeForLargeFile: jest.fn(),
  resetOptimizations: jest.fn()
};

export const CommentService = {
  handleCommentToggle: jest.fn()
};

export const HighlightService = {
  highlightText: jest.fn(),
  clearHighlights: jest.fn()
};

// Spell Check services
export const SpellCheckService = {
  init: jest.fn().mockResolvedValue(),
  scan: jest.fn().mockResolvedValue([])
};

export const SpellCheckMarkers = {
  clearMarkers: jest.fn()
};

export const SpellCheckActions = {
  registerQuickFixActions: jest.fn()
};

export const SpellCheckWorkerPool = {
  init: jest.fn().mockResolvedValue(),
  terminate: jest.fn()
};

// Markdown Lint services
export const MarkdownLintService = {
  init: jest.fn().mockResolvedValue(),
  scan: jest.fn().mockResolvedValue([])
};

export const MarkdownLintMarkers = {
  clearMarkers: jest.fn()
};

export const MarkdownLintActions = {
  registerQuickFixActions: jest.fn()
};

export const MarkdownLintMarkerAdapter = {
  clearMarkers: jest.fn(),
  toMonacoMarkers: jest.fn().mockReturnValue(new Map())
};

// Shared utilities
export const TextRegionAnalyzer = {
  getChangedRegion: jest.fn().mockReturnValue({
    regionText: 'test',
    startOffset: 0
  })
};

export const MonacoMarkerAdapter = {
  toMonacoMarkers: jest.fn().mockReturnValue(new Map())
};

export const MarkdownParser = {
  parse: jest.fn().mockReturnValue({ ast: {}, metadata: {} })
};

export const SpellCheckService = {
  init: jest.fn().mockResolvedValue(),
  scan: jest.fn().mockResolvedValue([])
};

export const SpellCheckMarkers = {
  clearMarkers: jest.fn()
};

export const SpellCheckActions = {
  registerQuickFixActions: jest.fn()
};

export const MarkdownLintService = {
  init: jest.fn().mockResolvedValue(),
  scan: jest.fn().mockResolvedValue([])
};

export const MarkdownLintMarkers = {
  clearMarkers: jest.fn()
};

export const MarkdownLintActions = {
  registerQuickFixActions: jest.fn()
};

export const MarkdownLintMarkerAdapter = {
  clearMarkers: jest.fn(),
  toMonacoMarkers: jest.fn().mockReturnValue(new Map())
};

export const CommentService = {
  handleCommentToggle: jest.fn()
};

export const TextRegionAnalyzer = {
  getChangedRegion: jest.fn().mockReturnValue({
    regionText: 'test',
    startOffset: 0
  })
};

export const MonacoMarkerAdapter = {
  toMonacoMarkers: jest.fn().mockReturnValue(new Map())
};