// Mock for LoginModal
export default function LoginModal({ show, onHide, onLoginSuccess }) {
  return show ? <div data-testid="login-modal">Login Modal</div> : null;
};