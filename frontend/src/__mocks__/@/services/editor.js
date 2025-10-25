// Mock for editor services
export const EditorService = {
  setup: jest.fn().mockResolvedValue({
    setValue: jest.fn(),
    getValue: jest.fn().mockReturnValue(''),
    onDidChangeModelContent: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    onDidChangeCursorPosition: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    onKeyDown: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    onDidLayoutChange: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    addCommand: jest.fn(),
    executeEdits: jest.fn(),
    setPosition: jest.fn(),
    getPosition: jest.fn().mockReturnValue({ lineNumber: 1, column: 1 }),
    getModel: jest.fn().mockReturnValue({
      getLineContent: jest.fn().mockReturnValue(''),
      getLineCount: jest.fn().mockReturnValue(1)
    }),
    trigger: jest.fn(),
    dispose: jest.fn(),
    getScrollTop: jest.fn().mockReturnValue(0),
    setScrollTop: jest.fn()
  }),
  applyTheme: jest.fn()
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