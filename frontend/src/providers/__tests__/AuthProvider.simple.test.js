/**
 * AuthProvider Unit Tests - Simplified Version
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';

// Mock the AuthService
jest.mock('@/services/core/AuthService', () => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isInitialized: false,
  settings: { autosave: true, theme: 'light' },
  getAuthState: jest.fn(() => ({
    user: null,
    token: null,
    isAuthenticated: false
  })),
  waitForInitialization: jest.fn(() => Promise.resolve(true)),
  initializeAuth: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
}));

// Mock other dependencies
jest.mock('@/components/auth/modals/LoginModal.jsx', () => {
  return function MockLoginModal() {
    return <div data-testid="login-modal">Login Modal</div>;
  };
});

jest.mock('@/components/security/modals/VerifyMFAModal.jsx', () => {
  return function MockVerifyMFAModal() {
    return <div data-testid="mfa-modal">MFA Modal</div>;
  };
});

jest.mock('@/components/auth/modals/PasswordResetModal.jsx', () => {
  return function MockPasswordResetModal() {
    return <div data-testid="password-reset-modal">Password Reset Modal</div>;
  };
});

// LogoutModal doesn't exist, skipping this mock

describe('AuthProvider - Basic Functionality', () => {
  // Test component to verify context is provided
  const TestComponent = () => {
    const auth = useAuth();
    return (
      <div data-testid="test-component">
        Auth Status: {auth.isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
      </div>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render children and provide auth context', () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId('test-component')).toBeInTheDocument();
    expect(screen.getByText(/Auth Status: Not Authenticated/)).toBeInTheDocument();
  });

  it('should throw error when useAuth is used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useAuth must be used within an AuthProvider');

    consoleSpy.mockRestore();
  });
});