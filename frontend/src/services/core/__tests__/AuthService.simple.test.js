/**
 * AuthService Unit Tests - Simplified Version
 */

import AuthService from '@/services/core/AuthService';

// Mock dependencies
jest.mock('@/api/userApi.js');
jest.mock('@/services/core/DocumentStorageService');
jest.mock('@/services/utilities/notifications.js');
jest.mock('@/services/dictionary');

describe('AuthService - Basic Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(AuthService).toBeDefined();
  });

  it('should have initial state', () => {
    expect(AuthService.user).toBeDefined();
    expect(AuthService.isAuthenticated).toBeDefined();
    expect(typeof AuthService.login).toBe('function');
    expect(typeof AuthService.logout).toBe('function');
  });

  it('should have required methods', () => {
    const requiredMethods = [
      'login',
      'logout',
      'waitForInitialization',
      'getAuthState',
      'setUser',
      'setToken',
      'startTokenRefresh',
      'stopTokenRefresh'
    ];

    requiredMethods.forEach(method => {
      expect(typeof AuthService[method]).toBe('function');
    });
  });
});