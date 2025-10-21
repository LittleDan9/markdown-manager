// Mock for UserAPI
export default {
  login: jest.fn(),
  getCurrentUser: jest.fn(),
  refreshToken: jest.fn(),
  logout: jest.fn(),
  updateProfile: jest.fn(),
  updatePassword: jest.fn(),
  deleteAccount: jest.fn(),
  enableMFA: jest.fn(),
  disableMFA: jest.fn(),
  requestPasswordReset: jest.fn(),
  confirmPasswordReset: jest.fn(),
  verifyMFA: jest.fn()
};