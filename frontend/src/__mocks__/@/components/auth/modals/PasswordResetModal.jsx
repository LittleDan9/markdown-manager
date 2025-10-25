// Mock for PasswordResetModal
export default function PasswordResetModal({ show, onHide }) {
  return show ? <div data-testid="password-reset-modal">Password Reset Modal</div> : null;
};