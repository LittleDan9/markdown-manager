import AuthService from '../AuthService';

// Mock all external dependencies
jest.mock('@/api/userApi.js');
jest.mock('@/services/core/DocumentStorageService');
jest.mock('@/services/utilities/notifications.js');
jest.mock('@/services/dictionary', () => ({
  syncAfterLogin: jest.fn().mockResolvedValue(),
  clear: jest.fn()
}));
jest.mock('@/utils/authHelpers');

describe('AuthService - Focused Tests', () => {
  let authService;

  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Get the singleton instance
    authService = AuthService;
    
    // Reset the service state
    authService.performLogout();
  });

  describe('Basic State Management', () => {
    it('should have correct initial state', () => {
      expect(authService.isAuthenticated).toBe(false);
      expect(authService.user.id).toBe(-1);
      expect(authService.user.display_name).toBe('Guest');
      expect(authService.token).toBeNull();
    });

    it('should update auth state correctly', () => {
      const testUser = { id: 1, display_name: 'Test User' };
      const testToken = 'test-token';
      
      authService.setUser(testUser);
      authService.setToken(testToken);
      authService.isAuthenticated = true;
      
      expect(authService.user).toEqual(testUser);
      expect(authService.token).toBe(testToken);
      expect(authService.isAuthenticated).toBe(true);
    });

    it('should clear state on logout', () => {
      // Set some state first
      authService.setUser({ id: 1, display_name: 'Test User' });
      authService.setToken('test-token');
      authService.isAuthenticated = true;
      
      // Perform logout
      authService.performLogout();
      
      expect(authService.isAuthenticated).toBe(false);
      expect(authService.user.id).toBe(-1);
      expect(authService.token).toBeNull();
    });
  });

  describe('Auth State Helper', () => {
    it('should return correct auth state object', () => {
      const state = authService.getAuthState();
      
      expect(state).toHaveProperty('user');
      expect(state).toHaveProperty('isAuthenticated');
      expect(state).toHaveProperty('token');
      expect(state.isAuthenticated).toBe(false);
      expect(state.user.id).toBe(-1);
    });

    it('should return authenticated state when logged in', () => {
      authService.setUser({ id: 1, display_name: 'Test User' });
      authService.setToken('test-token');
      authService.isAuthenticated = true;
      
      const state = authService.getAuthState();
      
      expect(state.isAuthenticated).toBe(true);
      expect(state.user.id).toBe(1);
      expect(state.token).toBe('test-token');
    });
  });

  describe('Token Management', () => {
    it('should store token in localStorage', () => {
      const testToken = 'test-token-123';
      
      authService.setToken(testToken);
      
      expect(localStorage.getItem('authToken')).toBe(testToken);
      expect(authService.token).toBe(testToken);
    });

    it('should clear token from localStorage on logout', () => {
      authService.setToken('test-token');
      expect(localStorage.getItem('authToken')).toBe('test-token');
      
      authService.performLogout();
      
      expect(localStorage.getItem('authToken')).toBeNull();
      expect(authService.token).toBeNull();
    });
  });

  describe('User Management', () => {
    it('should store user data correctly', () => {
      const testUser = {
        id: 1,
        email: 'test@example.com',
        display_name: 'Test User',
        first_name: 'Test',
        last_name: 'User'
      };
      
      authService.setUser(testUser);
      
      expect(authService.user).toEqual(testUser);
    });

    it('should handle missing user data gracefully', () => {
      authService.setUser(null);
      
      expect(authService.user.id).toBe(-1);
      expect(authService.user.display_name).toBe('Guest');
    });
  });
});