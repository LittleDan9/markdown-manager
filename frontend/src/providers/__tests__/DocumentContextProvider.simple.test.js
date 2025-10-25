/**
 * DocumentContextProvider Unit Tests - Simplified Version
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { DocumentContextProvider, useDocumentContext } from '@/providers/DocumentContextProvider';

// Mock all the dependencies
jest.mock('@/providers/AuthProvider', () => ({
  useAuth: jest.fn(() => ({
    token: 'mock-token',
    user: { id: 1, name: 'Test User' },
    isAuthenticated: true,
    isInitializing: false
  }))
}));

jest.mock('@/components/NotificationProvider.jsx', () => ({
  useNotification: jest.fn(() => ({
    showSuccess: jest.fn(),
    showError: jest.fn(),
    showWarning: jest.fn()
  }))
}));

jest.mock('@/hooks/document', () => ({
  useDocumentState: jest.fn(() => ({
    currentDocument: { id: 1, name: 'Test Document', content: 'Test content' },
    content: 'Test content',
    documents: [],
    categories: ['General'],
    loading: false,
    saving: false,
    error: '',
    loadDocument: jest.fn(),
    saveDocument: jest.fn(),
    createDocument: jest.fn(),
    deleteDocument: jest.fn()
  }))
}));

jest.mock('@/hooks/ui', () => ({
  useSharedViewState: jest.fn(() => ({
    isSharedView: false,
    sharedDocument: null,
    sharedLoading: false,
    sharedError: null
  })),
  usePreviewHTMLState: jest.fn(() => ({
    previewHTML: '',
    setPreviewHTML: jest.fn()
  }))
}));

describe('DocumentContextProvider - Basic Functionality', () => {
  // Test component to verify context is provided
  const TestComponent = () => {
    const context = useDocumentContext();
    return (
      <div data-testid="test-component">
        <div data-testid="current-doc">Document: {context?.currentDocument?.name || 'No document'}</div>
        <div data-testid="auth-status">Auth: {context?.isAuthenticated ? 'Authenticated' : 'Not authenticated'}</div>
        <div data-testid="content">Content: {context?.content || 'No content'}</div>
      </div>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render children and provide document context', () => {
    render(
      <DocumentContextProvider>
        <TestComponent />
      </DocumentContextProvider>
    );

    expect(screen.getByTestId('test-component')).toBeInTheDocument();
    expect(screen.getByText(/Document: Test Document/)).toBeInTheDocument();
    expect(screen.getByText(/Auth: Authenticated/)).toBeInTheDocument();
    expect(screen.getByText(/Content: Test content/)).toBeInTheDocument();
  });

  it('should throw error when useDocumentContext is used outside provider', () => {
    // Create a component that uses the context outside provider
    const OutsideComponent = () => {
      const context = useDocumentContext();
      return <div>{context ? 'Has context' : 'No context'}</div>;
    };

    render(<OutsideComponent />);

    // When used outside provider, context should be undefined
    expect(screen.getByText('No context')).toBeInTheDocument();
  });

  it('should provide all expected context values', () => {
    const TestContextValues = () => {
      const context = useDocumentContext();

      const expectedProperties = [
        'currentDocument',
        'content',
        'documents',
        'categories',
        'loading',
        'saving',
        'error',
        'token',
        'user',
        'isAuthenticated',
        'isInitializing',
        'isSharedView',
        'previewHTML'
      ];

      return (
        <div data-testid="context-props">
          {expectedProperties.map(prop => (
            <div key={prop} data-testid={`prop-${prop}`}>
              {prop}: {context && context.hasOwnProperty(prop) ? 'present' : 'missing'}
            </div>
          ))}
        </div>
      );
    };

    render(
      <DocumentContextProvider>
        <TestContextValues />
      </DocumentContextProvider>
    );

    // Check that all expected properties are present
    expect(screen.getByTestId('prop-currentDocument')).toHaveTextContent('currentDocument: present');
    expect(screen.getByTestId('prop-content')).toHaveTextContent('content: present');
    expect(screen.getByTestId('prop-documents')).toHaveTextContent('documents: present');
    expect(screen.getByTestId('prop-token')).toHaveTextContent('token: present');
    expect(screen.getByTestId('prop-isAuthenticated')).toHaveTextContent('isAuthenticated: present');
  });
});