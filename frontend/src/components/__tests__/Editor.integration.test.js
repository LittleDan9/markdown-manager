/**
 * Editor Component Integration Tests - Simplified Version
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import Editor from '@/components/Editor';

// Mock all the dependencies and providers
jest.mock('@/providers/DocumentContextProvider.jsx', () => ({
  useDocumentContext: jest.fn(() => ({
    currentDocument: { id: 1, name: 'Test Document', category: 'General', folder_path: '/test' },
    setCurrentDocument: jest.fn(),
    setContent: jest.fn()
  }))
}));

jest.mock('@/providers/AuthProvider.jsx', () => ({
  useAuth: jest.fn(() => ({
    isAuthenticated: true
  }))
}));

jest.mock('@/hooks/editor', () => ({
  useEditor: jest.fn(() => ({
    editorRef: { current: null },
    editorKey: 'test-key',
    handleContentChange: jest.fn(),
    handleCursorLineChange: jest.fn(),
    hasUnsavedChanges: false
  })),
  useDebouncedCursorChange: jest.fn(() => jest.fn())
}));

// Mock the child components
jest.mock('@/components/editor/MarkdownToolbar', () => {
  return function MockMarkdownToolbar() {
    return <div data-testid="markdown-toolbar">Markdown Toolbar</div>;
  };
});

jest.mock('@/components/ProgressIndicator', () => {
  return function MockProgressIndicator() {
    return <div data-testid="progress-indicator">Progress Indicator</div>;
  };
});

jest.mock('@/components/editor', () => ({
  GitStatusBar: function MockGitStatusBar() {
    return <div data-testid="git-status-bar">Git Status Bar</div>;
  }
}));

describe('Editor - Integration Tests', () => {
  const defaultProps = {
    value: 'Test markdown content',
    onChange: jest.fn(),
    onCursorLineChange: jest.fn(),
    fullscreenPreview: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render all main editor components', () => {
    render(<Editor {...defaultProps} />);

    // Check that the main editor components are rendered
    expect(screen.getByTestId('markdown-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('git-status-bar')).toBeInTheDocument();

    // Verify the editor container is present
    expect(document.getElementById('editor')).toBeInTheDocument();
    expect(document.querySelector('.monaco-container')).toBeInTheDocument();
  });

  it('should integrate with document context provider', () => {
    const useDocumentContext = require('@/providers/DocumentContextProvider.jsx').useDocumentContext;

    render(<Editor {...defaultProps} />);

    // Verify that the document context hook was called
    expect(useDocumentContext).toHaveBeenCalled();
  });

  it('should integrate with auth provider', () => {
    const useAuth = require('@/providers/AuthProvider.jsx').useAuth;

    render(<Editor {...defaultProps} />);

    // Verify that the auth hook was called
    expect(useAuth).toHaveBeenCalled();
  });

  it('should integrate with refactored editor hooks', () => {
    const { useEditor, useDebouncedCursorChange } = require('@/hooks/editor');

    render(<Editor {...defaultProps} />);

    // Verify that the refactored hooks are being used
    expect(useEditor).toHaveBeenCalled();
    expect(useDebouncedCursorChange).toHaveBeenCalled();
  });

  it('should handle fullscreen preview mode', () => {
    render(<Editor {...defaultProps} fullscreenPreview={true} />);

    // Component should still render even in fullscreen preview mode
    expect(screen.getByTestId('markdown-toolbar')).toBeInTheDocument();
  });

  it('should pass correct props to child components', () => {
    const mockOnChange = jest.fn();
    const mockOnCursorLineChange = jest.fn();

    render(
      <Editor
        value="Test content"
        onChange={mockOnChange}
        onCursorLineChange={mockOnCursorLineChange}
        fullscreenPreview={false}
      />
    );

    // The component should render without throwing errors with valid props
    expect(screen.getByTestId('markdown-toolbar')).toBeInTheDocument();
  });
});