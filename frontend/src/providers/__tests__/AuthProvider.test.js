import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../AuthProvider';

// Mock the AuthService
jest.mock('@/services/core/AuthService');

// Mock the modal components manually
jest.mock('@/components/auth/modals/LoginModal.jsx', () => {
  return function LoginModal({ show, onHide: _onHide, onLoginSuccess: _onLoginSuccess }) {
    return show ? <div data-testid="login-modal">Login Modal</div> : null;
  };
});

jest.mock('@/components/security/modals/VerifyMFAModal.jsx', () => {
  return function VerifyMFAModal({ show, onHide: _onHide, onVerifySuccess: _onVerifySuccess }) {
    return show ? <div data-testid="mfa-modal">MFA Modal</div> : null;
  };
});

jest.mock('@/components/auth/modals/PasswordResetModal.jsx', () => {
  return function PasswordResetModal({ show, onHide: _onHide }) {
    return show ? <div data-testid="password-reset-modal">Password Reset Modal</div> : null;
  };
});

jest.mock('@/components/LogoutProgressModal.jsx', () => {
  return function LogoutProgressModal({ show, config: _config }) {
    return show ? <div data-testid="logout-modal">Logout Modal</div> : null;
  };
});

// Test component to access the auth context
function TestComponent() {
  const auth = useAuth();

  return (
    <div>
      <div data-testid="user-display">{auth.user.display_name}</div>
      <div data-testid="auth-status">{auth.isAuthenticated ? 'authenticated' : 'not-authenticated'}</div>
      <div data-testid="initializing-status">{auth.isInitializing ? 'initializing' : 'initialized'}</div>
      <button data-testid="login-button" onClick={() => auth.login('test@example.com', 'password')}>
        Login
      </button>
      <button data-testid="logout-button" onClick={() => auth.logout()}>
        Logout
      </button>
      <button data-testid="show-login-modal" onClick={() => auth.setShowLoginModal(true)}>
        Show Login Modal
      </button>
      <button data-testid="update-profile" onClick={() => auth.updateProfile({ display_name: 'Updated Name' })}>
        Update Profile
      </button>
      <div data-testid="autosave-enabled">{auth.autosaveEnabled ? 'enabled' : 'disabled'}</div>
      <button data-testid="toggle-autosave" onClick={() => auth.setAutosaveEnabled(!auth.autosaveEnabled)}>
        Toggle Autosave
      </button>
    </div>
  );
}

describe('AuthProvider', () => {
  let mockAuthService;

  const mockUser = {
    id: 1,
    email: 'test@example.com',
    display_name: 'Test User',
    first_name: 'Test',
    last_name: 'User',
    is_active: true,
    is_verified: true,
    mfa_enabled: false
  };

  const mockAuthState = {
    user: mockUser,
    isAuthenticated: true,
    token: 'mock-token'
  };

  beforeEach(() => {
    // Reset localStorage
    localStorage.clear();

    // Reset all mocks
    jest.clearAllMocks();

    // Mock AuthService
    mockAuthService = {
      getAuthState: jest.fn().mockReturnValue({
        user: { id: -1, display_name: 'Guest' },
        isAuthenticated: false,
        token: null
      }),
      initializationPromise: Promise.resolve(),
      waitForInitialization: jest.fn().mockResolvedValue(),
      login: jest.fn(),
      verifyMFA: jest.fn(),
      logout: jest.fn(),
      updateProfile: jest.fn(),
      updatePassword: jest.fn(),
      deleteAccount: jest.fn(),
      enableMFA: jest.fn(),
      disableMFA: jest.fn(),
      requestPasswordReset: jest.fn(),
      confirmPasswordReset: jest.fn(),
      updateSetting: jest.fn().mockImplementation((key, value) => {
        localStorage.setItem(key, value);
        return Promise.resolve();
      })
    };

    // Mock the AuthService properly for the provider tests
    const AuthService = require('@/services/core/AuthService').default;

    // Replace methods with jest functions while preserving the singleton nature
    Object.assign(AuthService, mockAuthService);

    // Ensure getInstance returns the singleton with our mocked methods
    if (AuthService.getInstance) {
      AuthService.getInstance = jest.fn(() => AuthService);
    }
  });

  describe('Provider Initialization', () => {
    it('should render children and provide auth context', () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId('user-display')).toHaveTextContent('Guest');
      expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
      expect(screen.getByTestId('initializing-status')).toHaveTextContent('initializing');
    });

    it('should initialize with localStorage settings', () => {
      localStorage.setItem('autosaveEnabled', 'false');
      localStorage.setItem('syncPreviewScrollEnabled', 'false');
      localStorage.setItem('autoCommitEnabled', 'false');

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId('autosave-enabled')).toHaveTextContent('disabled');
    });

    it('should complete initialization and update state', async () => {
      mockAuthService.getAuthState.mockReturnValue(mockAuthState);
      mockAuthService.initializationPromise = Promise.resolve();

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('initializing-status')).toHaveTextContent('initialized');
      });

      expect(screen.getByTestId('user-display')).toHaveTextContent('Test User');
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    });
  });

  describe('Authentication Actions', () => {
    it('should handle successful login', async () => {
      mockAuthService.login.mockResolvedValue({
        success: true,
        mfa_required: false
      });
      mockAuthService.getAuthState.mockReturnValue(mockAuthState);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      const loginButton = screen.getByTestId('login-button');

      await act(async () => {
        await userEvent.click(loginButton);
      });

      expect(mockAuthService.login).toHaveBeenCalledWith('test@example.com', 'password');

      // Wait for state update
      await waitFor(() => {
        expect(screen.getByTestId('user-display')).toHaveTextContent('Test User');
        expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      });
    });

    it('should handle login with MFA required', async () => {
      mockAuthService.login.mockResolvedValue({
        success: true,
        mfaRequired: true
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      const loginButton = screen.getByTestId('login-button');

      await act(async () => {
        await userEvent.click(loginButton);
      });

      expect(mockAuthService.login).toHaveBeenCalledWith('test@example.com', 'password');

      // Should show MFA modal
      await waitFor(() => {
        expect(screen.getByTestId('mfa-modal')).toBeInTheDocument();
      });
    });

    it('should handle login failure', async () => {
      mockAuthService.login.mockResolvedValue({
        success: false,
        error: 'Invalid credentials'
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      const loginButton = screen.getByTestId('login-button');

      await act(async () => {
        await userEvent.click(loginButton);
      });

      expect(mockAuthService.login).toHaveBeenCalledWith('test@example.com', 'password');
      expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
    });

    it('should handle logout', async () => {
      // Start with authenticated state
      mockAuthService.getAuthState.mockReturnValue(mockAuthState);
      mockAuthService.logout.mockResolvedValue({ success: true });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Wait for initialization
      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      });

      const logoutButton = screen.getByTestId('logout-button');

      // Mock logout state change
      mockAuthService.getAuthState.mockReturnValue({
        user: { id: -1, display_name: 'Guest' },
        isAuthenticated: false,
        token: null
      });

      await act(async () => {
        await userEvent.click(logoutButton);
      });

      expect(mockAuthService.logout).toHaveBeenCalled();
    });
  });

  describe('Modal Management', () => {
    it('should show login modal when requested', async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      const showModalButton = screen.getByTestId('show-login-modal');

      await act(async () => {
        await userEvent.click(showModalButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('login-modal')).toBeInTheDocument();
      });
    });

    it('should show logout modal during logout process', async () => {
      mockAuthService.getAuthState.mockReturnValue(mockAuthState);
      // Mock a delayed logout that shows the modal
      mockAuthService.logout.mockResolvedValue({
        success: true,
        delayed: true,
        message: 'Logging out...'
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Wait for initialization
      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      });

      const logoutButton = screen.getByTestId('logout-button');

      await act(async () => {
        await userEvent.click(logoutButton);
      });

      // Should show logout modal during process
      await waitFor(() => {
        expect(screen.getByTestId('logout-modal')).toBeInTheDocument();
      });
    });
  });

  describe('Profile Management', () => {
    beforeEach(() => {
      mockAuthService.getAuthState.mockReturnValue(mockAuthState);
    });

    it('should update profile successfully', async () => {
      mockAuthService.updateProfile.mockResolvedValue({
        success: true,
        user: { ...mockUser, display_name: 'Updated Name' }
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      const updateButton = screen.getByTestId('update-profile');

      await act(async () => {
        await userEvent.click(updateButton);
      });

      expect(mockAuthService.updateProfile).toHaveBeenCalledWith({ display_name: 'Updated Name' });
    });

    it('should handle profile update failure', async () => {
      mockAuthService.updateProfile.mockResolvedValue({
        success: false,
        error: 'Update failed'
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      const updateButton = screen.getByTestId('update-profile');

      await act(async () => {
        await userEvent.click(updateButton);
      });

      expect(mockAuthService.updateProfile).toHaveBeenCalled();
    });
  });

  describe('Settings Management', () => {
    it('should toggle autosave setting', async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId('autosave-enabled')).toHaveTextContent('enabled');

      const toggleButton = screen.getByTestId('toggle-autosave');

      await act(async () => {
        await userEvent.click(toggleButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('autosave-enabled')).toHaveTextContent('disabled');
      });

      expect(localStorage.getItem('autosaveEnabled')).toBe('false');
    });

    it('should persist settings to localStorage', async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      const toggleButton = screen.getByTestId('toggle-autosave');

      await act(async () => {
        await userEvent.click(toggleButton);
      });

      expect(localStorage.getItem('autosaveEnabled')).toBe('false');
    });
  });

  describe('Hook Usage', () => {
    it('should throw error when useAuth is used outside provider', () => {
      // Suppress console error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestComponent />);
      }).toThrow();

      consoleSpy.mockRestore();
    });

    it('should provide all expected context values', () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // All context values should be available
      expect(screen.getByTestId('user-display')).toBeInTheDocument();
      expect(screen.getByTestId('auth-status')).toBeInTheDocument();
      expect(screen.getByTestId('initializing-status')).toBeInTheDocument();
      expect(screen.getByTestId('autosave-enabled')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors gracefully', async () => {
      // Mock waitForInitialization to reject
      mockAuthService.waitForInitialization = jest.fn().mockImplementation(async () => {
        throw new Error('Init failed');
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Wait for the initialization to complete (even if it fails)
      await waitFor(() => {
        expect(screen.getByTestId('initializing-status')).toHaveTextContent('initialized');
      }, { timeout: 1000 });

      // Should still show default state
      expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
    });

    it('should handle auth service method errors', async () => {
      mockAuthService.login = jest.fn().mockImplementation(async () => {
        throw new Error('Network error');
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      const loginButton = screen.getByTestId('login-button');

      // Wrap in act and handle the rejection
      await act(async () => {
        await userEvent.click(loginButton);
        // Wait a bit for the promise to be processed
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      // Should remain unauthenticated
      expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
    });
  });

  describe('State Consistency', () => {
    it('should maintain consistent state across re-renders', async () => {
      const { rerender } = render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');

      rerender(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
    });

    it('should update state when AuthService state changes', async () => {
      mockAuthService.getAuthState
        .mockReturnValueOnce({
          user: { id: -1, display_name: 'Guest' },
          isAuthenticated: false,
          token: null
        })
        .mockReturnValueOnce(mockAuthState);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Simulate auth state change
      await act(async () => {
        // Trigger a state update
        mockAuthService.getAuthState.mockReturnValue(mockAuthState);
      });

      // State should reflect the authenticated user
      await waitFor(() => {
        expect(screen.getByTestId('user-display')).toHaveTextContent('Test User');
      });
    });
  });
});