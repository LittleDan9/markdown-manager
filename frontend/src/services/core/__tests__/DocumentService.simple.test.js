/**
 * DocumentService Unit Tests - Simplified Version
 */

import DocumentService from '@/services/core/DocumentService';

// Mock dependencies
jest.mock('@/services/core/DocumentStorageService');
jest.mock('@/services/utilities/notifications.js');
jest.mock('@/services/core/AuthService');
jest.mock('file-saver');

describe('DocumentService - Basic Functionality', () => {
  let documentService;

  beforeEach(() => {
    jest.clearAllMocks();
    // DocumentService is exported as singleton instance
    documentService = DocumentService;
  });

  it('should be defined', () => {
    expect(DocumentService).toBeDefined();
    expect(documentService).toBeDefined();
  });

  it('should have initial state', () => {
    expect(typeof documentService.isSaving).toBe('boolean');
    expect(documentService.saveQueue).toBeInstanceOf(Map);
    expect(documentService.retryAttempts).toBeInstanceOf(Map);
    expect(typeof documentService.maxRetries).toBe('number');
  });

  it('should have required methods', () => {
    const requiredMethods = [
      'getAuthState',
      'saveDocument',
      'deleteDocument',
      'loadDocument',
      'exportAsMarkdown',
      'exportAsPDF',
      'getSharedDocument'
    ];

    requiredMethods.forEach(method => {
      expect(typeof documentService[method]).toBe('function');
    });
  });

  it('should have getAuthState method that returns auth state', () => {
    const mockAuthState = {
      user: { id: 1 },
      token: 'mock-token',
      isAuthenticated: true
    };

    // Mock AuthService.getAuthState
    const AuthService = require('@/services/core/AuthService').default;
    AuthService.getAuthState = jest.fn(() => mockAuthState);

    const result = documentService.getAuthState();
    expect(result).toEqual(mockAuthState);
    expect(AuthService.getAuthState).toHaveBeenCalled();
  });

  it('should initialize save queue and retry attempts as Maps', () => {
    expect(documentService.saveQueue).toBeInstanceOf(Map);
    expect(documentService.retryAttempts).toBeInstanceOf(Map);
  });
});