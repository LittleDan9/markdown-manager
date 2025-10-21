// Mock for LogoutProgressModal
export default function LogoutProgressModal({ show, config }) {
  return show ? <div data-testid="logout-modal">Logout Modal</div> : null;
};