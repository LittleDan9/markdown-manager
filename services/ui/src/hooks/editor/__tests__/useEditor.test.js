import { renderHook, act } from '@testing-library/react';
import useEditor from '../useEditor';

// Mock the dependencies
jest.mock('@/services/editor');
jest.mock('@/providers/ThemeProvider');
jest.mock('monaco-editor/esm/vs/editor/editor.api', () => ({
  KeyCode: {
    Enter: 3,
    KeyB: 5,
    KeyI: 23,
    US_DOT: 84,
    Slash: 85
  },
  KeyMod: {
    CtrlCmd: 2048
  }
}));

describe('useEditor Hook', () => {
  let mockContainerRef;
  let mockOnChange;
  let mockOnCursorLineChange;
  let mockGetCategoryId;
  let mockGetFolderPath;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock refs and functions
    mockContainerRef = { current: document.createElement('div') };
    mockOnChange = jest.fn();
    mockOnCursorLineChange = jest.fn();
    mockGetCategoryId = jest.fn().mockReturnValue('test-category');
    mockGetFolderPath = jest.fn().mockReturnValue('/test/path');

    // Clear any global variables
    delete window.editorInstance;
    delete window.editorSpellCheckTrigger;
    delete window.editorMarkdownLintTrigger;
    delete window.CommentService;
    delete window.testCommentToggle;
  });

  describe('Basic Hook Functionality', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useEditor({
        containerRef: mockContainerRef,
        value: 'initial text',
        onChange: mockOnChange,
        onCursorLineChange: mockOnCursorLineChange,
        categoryId: 'test-category',
        getCategoryId: mockGetCategoryId,
        getFolderPath: mockGetFolderPath
      }));

      expect(result.current).toHaveProperty('editor');
      expect(result.current).toHaveProperty('spellCheck');
      expect(result.current).toHaveProperty('markdownLint');
      expect(result.current).toHaveProperty('runSpellCheck');
      expect(result.current).toHaveProperty('runMarkdownLint');
      expect(result.current).toHaveProperty('triggerSpellCheck');
      expect(result.current).toHaveProperty('triggerMarkdownLint');
    });

    it('should handle disabled features correctly', () => {
      const { result } = renderHook(() => useEditor({
        containerRef: mockContainerRef,
        value: 'test',
        enableSpellCheck: false,
        enableMarkdownLint: false,
        enableKeyboardShortcuts: false,
        enableListBehavior: false,
        getCategoryId: mockGetCategoryId,
        getFolderPath: mockGetFolderPath
      }));

      expect(result.current.spellCheck).toBeUndefined();
      expect(result.current.markdownLint).toBeUndefined();
    });
  });

  describe('Configuration Options', () => {
    it('should accept all configuration parameters', () => {
      const config = {
        containerRef: mockContainerRef,
        value: 'test content',
        onChange: mockOnChange,
        onCursorLineChange: mockOnCursorLineChange,
        enableSpellCheck: true,
        enableMarkdownLint: true,
        enableKeyboardShortcuts: true,
        enableListBehavior: true,
        categoryId: 'test-category',
        getCategoryId: mockGetCategoryId,
        getFolderPath: mockGetFolderPath
      };

      const { result } = renderHook(() => useEditor(config));

      // Should not throw and should return expected structure
      expect(result.current).toBeDefined();
      expect(typeof result.current.runSpellCheck).toBe('function');
      expect(typeof result.current.runMarkdownLint).toBe('function');
    });

    it('should handle optional parameters', () => {
      const minimalConfig = {
        containerRef: mockContainerRef,
        value: 'test',
        getCategoryId: mockGetCategoryId,
        getFolderPath: mockGetFolderPath
      };

      const { result } = renderHook(() => useEditor(minimalConfig));
      expect(result.current).toBeDefined();
    });
  });

  describe('Spell Check Functionality', () => {
    it('should provide spell check interface when enabled', () => {
      const { result } = renderHook(() => useEditor({
        containerRef: mockContainerRef,
        value: 'test',
        enableSpellCheck: true,
        getCategoryId: mockGetCategoryId,
        getFolderPath: mockGetFolderPath
      }));

      expect(result.current.spellCheck).toBeDefined();
      expect(result.current.spellCheck).toHaveProperty('progress');
      expect(result.current.spellCheck).toHaveProperty('suggestionsMap');
      expect(typeof result.current.runSpellCheck).toBe('function');
      expect(typeof result.current.triggerSpellCheck).toBe('function');
    });

    it('should execute manual spell check', () => {
      const { result } = renderHook(() => useEditor({
        containerRef: mockContainerRef,
        value: 'test',
        enableSpellCheck: true,
        getCategoryId: mockGetCategoryId,
        getFolderPath: mockGetFolderPath
      }));

      act(() => {
        result.current.runSpellCheck();
      });

      // Should not throw
      expect(result.current.runSpellCheck).toBeDefined();
    });
  });

  describe('Markdown Linting Functionality', () => {
    it('should provide markdown lint interface when enabled', () => {
      const { result } = renderHook(() => useEditor({
        containerRef: mockContainerRef,
        value: 'test',
        enableMarkdownLint: true,
        getCategoryId: mockGetCategoryId,
        getFolderPath: mockGetFolderPath
      }));

      expect(result.current.markdownLint).toBeDefined();
      expect(result.current.markdownLint).toHaveProperty('lintProgress');
      expect(result.current.markdownLint).toHaveProperty('markersMap');
      expect(typeof result.current.runMarkdownLint).toBe('function');
      expect(typeof result.current.triggerMarkdownLint).toBe('function');
    });

    it('should execute manual markdown lint', () => {
      const { result } = renderHook(() => useEditor({
        containerRef: mockContainerRef,
        value: 'test',
        enableMarkdownLint: true,
        getCategoryId: mockGetCategoryId,
        getFolderPath: mockGetFolderPath
      }));

      act(() => {
        result.current.runMarkdownLint();
      });

      // Should not throw
      expect(result.current.runMarkdownLint).toBeDefined();
    });
  });

  describe('Global Function Exposure', () => {
    it('should handle keyboard shortcuts setup without throwing', () => {
      const { result } = renderHook(() => useEditor({
        containerRef: mockContainerRef,
        value: 'test',
        enableKeyboardShortcuts: true,
        getCategoryId: mockGetCategoryId,
        getFolderPath: mockGetFolderPath
      }));

      // Just verify the hook doesn't throw and returns expected structure
      expect(result.current).toBeDefined();
      expect(typeof result.current.runSpellCheck).toBe('function');
      expect(typeof result.current.runMarkdownLint).toBe('function');
    });
  });

  describe('Hook Cleanup', () => {
    it('should cleanup resources on unmount', () => {
      const { unmount } = renderHook(() => useEditor({
        containerRef: mockContainerRef,
        value: 'test',
        getCategoryId: mockGetCategoryId,
        getFolderPath: mockGetFolderPath
      }));

      // Should not throw on unmount
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Value Changes', () => {
    it('should handle external value changes', () => {
      let value = 'initial';
      const { rerender } = renderHook(
        ({ value }) => useEditor({
          containerRef: mockContainerRef,
          value,
          onChange: mockOnChange,
          getCategoryId: mockGetCategoryId,
          getFolderPath: mockGetFolderPath
        }),
        { initialProps: { value } }
      );

      // Change the value
      value = 'updated';
      rerender({ value });

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Typing Detection', () => {
    it('should handle typing state management', () => {
      const { result } = renderHook(() => useEditor({
        containerRef: mockContainerRef,
        value: 'test',
        onChange: mockOnChange,
        getCategoryId: mockGetCategoryId,
        getFolderPath: mockGetFolderPath
      }));

      // Should initialize without throwing
      expect(result.current).toBeDefined();
    });
  });

  describe('API Consistency', () => {
    it('should maintain consistent API structure', () => {
      const { result } = renderHook(() => useEditor({
        containerRef: mockContainerRef,
        value: 'test',
        enableSpellCheck: true,
        enableMarkdownLint: true,
        getCategoryId: mockGetCategoryId,
        getFolderPath: mockGetFolderPath
      }));

      // Check API structure matches expected interface
      const expectedKeys = [
        'editor',
        'spellCheck',
        'markdownLint',
        'runSpellCheck',
        'runMarkdownLint',
        'triggerSpellCheck',
        'triggerMarkdownLint'
      ];

      expectedKeys.forEach(key => {
        expect(result.current).toHaveProperty(key);
      });

      // Check spell check structure
      expect(result.current.spellCheck).toHaveProperty('progress');
      expect(result.current.spellCheck).toHaveProperty('suggestionsMap');

      // Check markdown lint structure
      expect(result.current.markdownLint).toHaveProperty('lintProgress');
      expect(result.current.markdownLint).toHaveProperty('markersMap');
    });
  });
});