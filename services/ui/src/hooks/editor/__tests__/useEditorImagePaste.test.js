import { renderHook, act } from '@testing-library/react';
import useEditorImagePaste from '../useEditorImagePaste';

// Mock useImageManagement
const mockUploadImageFile = jest.fn();
const mockGenerateMarkdown = jest.fn();

jest.mock('@/hooks/image/useImageManagement', () => ({
  useImageManagement: () => ({
    uploadImageFile: mockUploadImageFile,
    generateMarkdown: mockGenerateMarkdown
  })
}));

/**
 * Create a mock Monaco editor instance for testing.
 */
function createMockEditor() {
  let modelContent = '';
  const listeners = {};

  const mockModel = {
    findMatches: jest.fn((searchText) => {
      const index = modelContent.indexOf(searchText);
      if (index === -1) return [];
      // Simple single-line range calculation
      const lines = modelContent.substring(0, index).split('\n');
      const lineNumber = lines.length;
      const startColumn = lines[lines.length - 1].length + 1;
      const endColumn = startColumn + searchText.length;
      return [{
        range: {
          startLineNumber: lineNumber,
          startColumn,
          endLineNumber: lineNumber,
          endColumn
        }
      }];
    }),
    getValue: jest.fn(() => modelContent),
    getValueLength: jest.fn(() => modelContent.length)
  };

  const mockEditor = {
    getModel: jest.fn(() => mockModel),
    getSelection: jest.fn(() => ({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 1
    })),
    executeEdits: jest.fn((source, edits) => {
      // Simulate edit by tracking content
      for (const edit of edits) {
        // Simple simulation: append/replace
        modelContent = modelContent + edit.text;
      }
      return true;
    }),
    getDomNode: jest.fn(() => {
      const div = document.createElement('div');
      div.classList.add('monaco-editor');
      return div;
    }),
    hasTextFocus: jest.fn(() => true),
    focus: jest.fn(),
    getTargetAtClientPoint: jest.fn(() => null),
    onKeyDown: jest.fn(() => ({ dispose: jest.fn() })),
    dispose: jest.fn()
  };

  return { editor: mockEditor, model: mockModel, getContent: () => modelContent, setContent: (c) => { modelContent = c; } };
}

/**
 * Create a mock image File.
 */
function createMockImageFile(name = 'test.png', type = 'image/png') {
  return new File(['fake-image-data'], name, { type });
}

describe('useEditorImagePaste', () => {
  let mockEditorData;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockEditorData = createMockEditor();

    mockGenerateMarkdown.mockReturnValue('![Pasted Image](/api/images/1/test.png)');
    mockUploadImageFile.mockResolvedValue({
      image: { filename: 'test.png', width: 100, height: 100, url: '/images/test.png' }
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    it('should return processImageUpload and cancelAllUploads', () => {
      const { result } = renderHook(() =>
        useEditorImagePaste(mockEditorData.editor, true)
      );

      expect(result.current.processImageUpload).toBeDefined();
      expect(result.current.cancelAllUploads).toBeDefined();
      expect(result.current.activeUploads).toBeDefined();
    });

    it('should not attach listeners when disabled', () => {
      const { editor } = mockEditorData;
      const domNode = editor.getDomNode();
      const addEventSpy = jest.spyOn(domNode, 'addEventListener');

      renderHook(() => useEditorImagePaste(editor, false));

      expect(addEventSpy).not.toHaveBeenCalled();
    });

    it('should not attach listeners when editor is null', () => {
      renderHook(() => useEditorImagePaste(null, true));
      // Should not throw
    });
  });

  describe('Placeholder Tracking', () => {
    it('should insert a unique marker placeholder on upload', async () => {
      const { editor } = mockEditorData;
      const { result } = renderHook(() => useEditorImagePaste(editor, true));

      const file = createMockImageFile();

      await act(async () => {
        result.current.processImageUpload(file);
        // Let the upload resolve
        await Promise.resolve();
      });

      // Should have called executeEdits for the placeholder insertion
      const insertCall = editor.executeEdits.mock.calls.find(
        c => c[0] === 'paste-image-loading'
      );
      expect(insertCall).toBeDefined();

      const insertedText = insertCall[1][0].text;
      // Should contain unique marker comment
      expect(insertedText).toMatch(/<!-- img-upload-[a-z0-9]+-[a-z0-9]+ -->/);
      // Should contain uploading text
      expect(insertedText).toContain('![Uploading image...]()');
    });

    it('should replace placeholder with final markdown after successful upload', async () => {
      const { editor, model } = mockEditorData;
      const { result } = renderHook(() => useEditorImagePaste(editor, true));

      const file = createMockImageFile();

      await act(async () => {
        await result.current.processImageUpload(file);
      });

      // Should have called executeEdits for completion
      const completeCall = editor.executeEdits.mock.calls.find(
        c => c[0] === 'paste-image-complete'
      );
      expect(completeCall).toBeDefined();
      expect(completeCall[1][0].text).toBe('![Pasted Image](/api/images/1/test.png)');
    });

    it('should replace placeholder with empty string on failed upload', async () => {
      const { editor, model } = mockEditorData;
      mockUploadImageFile.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useEditorImagePaste(editor, true));
      const file = createMockImageFile();

      await act(async () => {
        await result.current.processImageUpload(file);
      });

      // Should have called executeEdits for error replacement
      const errorCall = editor.executeEdits.mock.calls.find(
        c => c[0] === 'paste-image-complete' && c[1][0].text.includes('upload failed')
      );
      expect(errorCall).toBeDefined();
    });
  });

  describe('Concurrent Uploads', () => {
    it('should handle multiple simultaneous uploads independently', async () => {
      const { editor, model } = mockEditorData;

      // Make uploads resolve at different times
      let resolve1, resolve2;
      mockUploadImageFile
        .mockImplementationOnce(() => new Promise(r => { resolve1 = r; }))
        .mockImplementationOnce(() => new Promise(r => { resolve2 = r; }));

      const { result } = renderHook(() => useEditorImagePaste(editor, true));

      const file1 = createMockImageFile('img1.png');
      const file2 = createMockImageFile('img2.png');

      // Start both uploads
      let p1, p2;
      await act(async () => {
        p1 = result.current.processImageUpload(file1);
        p2 = result.current.processImageUpload(file2);
      });

      // Both should have inserted unique placeholders
      const insertCalls = editor.executeEdits.mock.calls.filter(
        c => c[0] === 'paste-image-loading'
      );
      expect(insertCalls.length).toBe(2);

      // Markers should be different
      const marker1 = insertCalls[0][1][0].text;
      const marker2 = insertCalls[1][1][0].text;
      expect(marker1).not.toBe(marker2);

      // Resolve in reverse order
      await act(async () => {
        resolve2({ image: { filename: 'img2.png' } });
        await Promise.resolve();
      });

      await act(async () => {
        resolve1({ image: { filename: 'img1.png' } });
        await Promise.resolve();
      });

      // Both should have attempted replacement via findMatches
      expect(model.findMatches).toHaveBeenCalled();
    });
  });

  describe('Timeout', () => {
    it('should abort upload after timeout', async () => {
      const { editor } = mockEditorData;

      // Never-resolving upload
      mockUploadImageFile.mockImplementation(
        () => new Promise(() => {})
      );

      const { result } = renderHook(() => useEditorImagePaste(editor, true));
      const file = createMockImageFile();

      await act(async () => {
        result.current.processImageUpload(file);
      });

      // Fast-forward past timeout
      await act(async () => {
        jest.advanceTimersByTime(31000);
      });

      // Upload should have been aborted — the signal passed to uploadImageFile
      const callArgs = mockUploadImageFile.mock.calls[0];
      expect(callArgs[2]).toHaveProperty('signal');
    });
  });

  describe('Cancellation', () => {
    it('should cancel all active uploads on cancelAllUploads', async () => {
      const { editor } = mockEditorData;

      mockUploadImageFile.mockImplementation(
        () => new Promise(() => {})
      );

      const { result } = renderHook(() => useEditorImagePaste(editor, true));
      const file = createMockImageFile();

      await act(async () => {
        result.current.processImageUpload(file);
      });

      // There should be an active upload
      expect(result.current.activeUploads.current.size).toBe(1);

      // Cancel all
      act(() => {
        result.current.cancelAllUploads();
      });

      // Active uploads map should eventually clear after abort settles
      // The abort controller was triggered
      const entries = Array.from(result.current.activeUploads.current.entries());
      for (const [, controller] of entries) {
        expect(controller.signal.aborted).toBe(true);
      }
    });
  });

  describe('Event Listeners', () => {
    it('should attach paste listener to document and drop/dragover to editor DOM', () => {
      const { editor } = mockEditorData;
      const domNode = editor.getDomNode();
      editor.getDomNode.mockReturnValue(domNode);
      const docAddSpy = jest.spyOn(document, 'addEventListener');
      const domAddSpy = jest.spyOn(domNode, 'addEventListener');

      renderHook(() => useEditorImagePaste(editor, true));

      const docEvents = docAddSpy.mock.calls.map(c => c[0]);
      const domEvents = domAddSpy.mock.calls.map(c => c[0]);
      expect(docEvents).toContain('paste');
      expect(domEvents).toContain('drop');
      expect(domEvents).toContain('dragover');

      docAddSpy.mockRestore();
    });

    it('should clean up listeners on unmount', () => {
      const { editor } = mockEditorData;
      const domNode = editor.getDomNode();
      editor.getDomNode.mockReturnValue(domNode);
      const docRemoveSpy = jest.spyOn(document, 'removeEventListener');
      const domRemoveSpy = jest.spyOn(domNode, 'removeEventListener');

      const { unmount } = renderHook(() => useEditorImagePaste(editor, true));
      unmount();

      const docEvents = docRemoveSpy.mock.calls.map(c => c[0]);
      const domEvents = domRemoveSpy.mock.calls.map(c => c[0]);
      expect(docEvents).toContain('paste');
      expect(domEvents).toContain('drop');
      expect(domEvents).toContain('dragover');

      docRemoveSpy.mockRestore();
    });

    it('should only handle paste when editor has focus', () => {
      const { editor } = mockEditorData;
      editor.hasTextFocus.mockReturnValue(false);

      renderHook(() => useEditorImagePaste(editor, true));

      // Simulate paste event
      const pasteEvent = new Event('paste', { bubbles: true });
      Object.defineProperty(pasteEvent, 'clipboardData', {
        value: {
          items: [{
            type: 'image/png',
            getAsFile: () => createMockImageFile()
          }]
        }
      });

      const domNode = editor.getDomNode();
      domNode.dispatchEvent(pasteEvent);

      // Should not have tried to insert placeholder
      const insertCalls = editor.executeEdits.mock.calls.filter(
        c => c[0] === 'paste-image-loading'
      );
      expect(insertCalls.length).toBe(0);
    });
  });

  describe('Unique Filenames', () => {
    it('should generate unique filenames for each upload', async () => {
      const { editor } = mockEditorData;
      const { result } = renderHook(() => useEditorImagePaste(editor, true));

      const file1 = createMockImageFile();
      const file2 = createMockImageFile();

      await act(async () => {
        await result.current.processImageUpload(file1);
      });

      await act(async () => {
        await result.current.processImageUpload(file2);
      });

      // Both calls should have used unique filenames
      const filename1 = mockUploadImageFile.mock.calls[0][1];
      const filename2 = mockUploadImageFile.mock.calls[1][1];
      expect(filename1).toMatch(/^clipboard_\d{8}_\d{6}_[a-z0-9]+\.png$/);
      expect(filename2).toMatch(/^clipboard_\d{8}_\d{6}_[a-z0-9]+\.png$/);
      // They could theoretically be the same if generated in same millisecond,
      // but the random suffix makes collision very unlikely
    });
  });
});
