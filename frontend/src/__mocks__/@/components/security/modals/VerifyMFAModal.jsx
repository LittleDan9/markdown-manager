// Mock for VerifyMFAModal
export default function VerifyMFAModal({ show, onHide, onVerifySuccess }) {
  return show ? <div data-testid="mfa-modal">MFA Modal</div> : null;
};