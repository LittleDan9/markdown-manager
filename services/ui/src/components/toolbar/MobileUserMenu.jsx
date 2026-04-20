import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Offcanvas } from 'react-bootstrap';
import { useAuth } from '@/providers/AuthProvider';
import { useNotification } from '@/components/NotificationProvider';
import { useImageManagement } from '@/hooks/image/useImageManagement';
import { useDocumentContext } from '@/providers/DocumentContextProvider';

import UserSettingsModal from '@/components/user/modals/UserSettingsModal';
import GitHubModal from '@/components/github/modals/GitHubModal';
import GitManagementModal from '@/components/git/GitManagementModal';
import IconManagementModal from '@/components/icons/modals/IconManagementModal';
import AdminModal from '@/components/admin/AdminModal';
import SystemHealthModal from '@/components/system/SystemHealthModal';
import ImageBrowserModal from '@/components/images/ImageBrowserModal';
import RegisterModal from '@/components/auth/modals/RegisterModal';
import UserAPI from '@/api/userApi';

/**
 * MobileUserMenu — profile/account offcanvas for mobile.
 * Replaces the Bootstrap Dropdown user menu with native touch-friendly items.
 */
function MobileUserMenu({ show, onHide }) {
  const {
    user, logout, setShowLoginModal, setLoginEmail,
    autosaveEnabled, setAutosaveEnabled,
    syncPreviewScrollEnabled, setSyncPreviewScrollEnabled,
    autoCommitEnabled, setAutoCommitEnabled,
  } = useAuth();
  const { showSuccess } = useNotification();
  const { generateMarkdown } = useImageManagement();
  const { setShowChatDrawer, setChatHelpMode, setShowHelpModal, setShowGuidedTour } = useDocumentContext();

  const isLoggedIn = user?.is_active;

  // Modal states
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [activeTab, setActiveTab] = useState('profile-info');
  const [showGitHubModal, setShowGitHubModal] = useState(false);
  const [showGitModal, setShowGitModal] = useState(false);
  const [showIconModal, setShowIconModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showSystemHealthModal, setShowSystemHealthModal] = useState(false);
  const [showImageBrowserModal, setShowImageBrowserModal] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [registerError, setRegisterError] = useState('');

  // GitHub modal return callback
  useEffect(() => {
    if (isLoggedIn) {
      window.gitHubModalReturnCallback = () => {
        setShowGitHubModal(prev => prev ? prev : true);
      };
    }
    return () => {
      if (isLoggedIn) delete window.gitHubModalReturnCallback;
    };
  }, [isLoggedIn]);

  // Listen for openSettings events from editor toolbar buttons
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.tab) {
        setActiveTab(e.detail.tab);
        setShowSettingsModal(true);
        onHide();
      }
    };
    window.addEventListener('openSettings', handler);
    return () => window.removeEventListener('openSettings', handler);
  }, [onHide]);

  // Close offcanvas and open a settings tab
  const openSettings = useCallback((tab) => {
    setActiveTab(tab);
    setShowSettingsModal(true);
    onHide();
  }, [onHide]);

  // Close offcanvas and run an action
  const handleAction = useCallback((action) => {
    action();
    onHide();
  }, [onHide]);

  const handleLogout = useCallback(() => {
    logout().then(() => showSuccess('You have been logged out.'));
    onHide();
  }, [logout, showSuccess, onHide]);

  const handleRegister = useCallback((formData) => {
    UserAPI.register(formData)
      .then(() => {
        setShowRegister(false);
        showSuccess('Registration successful! Please log in.');
        setLoginEmail(formData.email || '');
        setShowLoginModal(true);
      })
      .catch((error) => {
        setRegisterError(error.message || 'Registration failed.');
      });
  }, [showSuccess, setLoginEmail, setShowLoginModal]);

  const handleImageSelected = useCallback((image) => {
    if (image && window.editorInstance) {
      const editor = window.editorInstance;
      const selection = editor.getSelection();
      const markdown = generateMarkdown(image, 'Image', '');
      if (selection) {
        editor.executeEdits('insert-image', [{ range: selection, text: markdown }]);
      }
      editor.focus();
    }
  }, [generateMarkdown]);

  // Memoize modal close handlers
  const hideSettings = useCallback(() => setShowSettingsModal(false), []);
  const hideGitHub = useCallback(() => setShowGitHubModal(false), []);
  const hideGit = useCallback(() => setShowGitModal(false), []);
  const hideIcons = useCallback(() => setShowIconModal(false), []);
  const hideAdmin = useCallback(() => setShowAdminModal(false), []);
  const hideSystemHealth = useCallback(() => setShowSystemHealthModal(false), []);
  const hideImageBrowser = useCallback(() => setShowImageBrowserModal(false), []);

  return (
    <>
      <Offcanvas show={show} onHide={onHide} placement="end" className="mobile-user-menu">
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>
            <i className={`bi ${user?.is_admin ? 'bi-person-fill-gear' : 'bi-person-circle'} me-2`} />
            {isLoggedIn ? user.display_name : 'Account'}
          </Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          <nav className="mobile-menu-nav">
            {isLoggedIn ? (
              <>
                {/* Settings & Tools */}
                <button type="button" className="mobile-menu-item" onClick={() => openSettings('profile-info')}>
                  <i className="bi bi-gear" /><span>Settings</span>
                </button>

                <hr className="mobile-menu-divider" />

                {/* Content & Tools */}
                <button type="button" className="mobile-menu-item" onClick={() => handleAction(() => setShowImageBrowserModal(true))}>
                  <i className="bi bi-file-image" /><span>Image Manager</span>
                </button>
                <button type="button" className="mobile-menu-item" onClick={() => handleAction(() => setShowSystemHealthModal(true))}>
                  <i className="bi bi-activity" /><span>System Health</span>
                </button>

                <hr className="mobile-menu-divider" />

                {/* Toggles — don't close the offcanvas */}
                <button type="button" className="mobile-menu-item" onClick={() => setAutosaveEnabled(prev => !prev)}>
                  <i className={`bi ${autosaveEnabled ? 'bi-toggle-on text-success' : 'bi-toggle-off'}`} />
                  <span>Autosave</span>
                </button>
                <button type="button" className="mobile-menu-item" onClick={() => setSyncPreviewScrollEnabled(prev => !prev)}>
                  <i className={`bi ${syncPreviewScrollEnabled ? 'bi-toggle-on text-success' : 'bi-toggle-off'}`} />
                  <span>Sync Preview Scroll</span>
                </button>
                <button type="button" className="mobile-menu-item" onClick={() => setAutoCommitEnabled(prev => !prev)}>
                  <i className={`bi ${autoCommitEnabled ? 'bi-toggle-on text-success' : 'bi-toggle-off'}`} />
                  <span>Auto-commit on Close</span>
                </button>

                <hr className="mobile-menu-divider" />

                {/* Integrations */}
                <button type="button" className="mobile-menu-item" onClick={() => handleAction(() => setShowGitHubModal(true))}>
                  <i className="bi bi-github" /><span>GitHub</span>
                </button>
                <button type="button" className="mobile-menu-item" onClick={() => handleAction(() => setShowGitModal(true))}>
                  <i className="bi bi-git" /><span>Git Management</span>
                </button>

                {user.is_admin && (
                  <>
                    <hr className="mobile-menu-divider" />
                    <button type="button" className="mobile-menu-item" onClick={() => handleAction(() => setShowIconModal(true))}>
                      <i className="bi bi-images" /><span>Icon Management</span>
                    </button>
                    <button type="button" className="mobile-menu-item text-danger" onClick={() => handleAction(() => setShowAdminModal(true))}>
                      <i className="bi bi-shield-fill-check" /><span>Admin</span>
                    </button>
                  </>
                )}

                <hr className="mobile-menu-divider" />

                <button type="button" className="mobile-menu-item" onClick={() => handleAction(() => { setChatHelpMode(true); setShowChatDrawer(true); })}>
                  <i className="bi bi-chat-dots" /><span>Ask AI for Help</span>
                </button>
                <button type="button" className="mobile-menu-item" onClick={() => handleAction(() => setShowHelpModal(true))}>
                  <i className="bi bi-book" /><span>User Guide</span>
                </button>
                <button type="button" className="mobile-menu-item" onClick={() => handleAction(() => setShowGuidedTour(true))}>
                  <i className="bi bi-signpost-split" /><span>Take a Tour</span>
                </button>

                <button type="button" className="mobile-menu-item text-danger" onClick={handleLogout}>
                  <i className="bi bi-box-arrow-right" /><span>Logout</span>
                </button>
              </>
            ) : (
              <>
                {/* Logged out */}
                <button type="button" className="mobile-menu-item" onClick={() => handleAction(() => setShowLoginModal(true))}>
                  <i className="bi bi-box-arrow-in-right" /><span>Login</span>
                </button>
                <button type="button" className="mobile-menu-item" onClick={() => { setShowRegister(true); setRegisterError(''); onHide(); }}>
                  <i className="bi bi-person-plus" /><span>Sign Up</span>
                </button>

                <hr className="mobile-menu-divider" />

                <button type="button" className="mobile-menu-item" onClick={() => openSettings('dictionary')}>
                  <i className="bi bi-book" /><span>Dictionary</span>
                </button>
                <button type="button" className="mobile-menu-item" onClick={() => handleAction(() => setShowSystemHealthModal(true))}>
                  <i className="bi bi-activity" /><span>System Health</span>
                </button>
              </>
            )}
          </nav>
        </Offcanvas.Body>
      </Offcanvas>

      {/* Modals — rendered outside offcanvas so they portal correctly */}
      <UserSettingsModal
        show={showSettingsModal}
        onHide={hideSettings}
        defaultActiveKey={activeTab}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        guestMode={!isLoggedIn}
      />
      <SystemHealthModal
        show={showSystemHealthModal}
        onHide={hideSystemHealth}
        isAdmin={user?.is_admin || false}
      />
      <RegisterModal
        show={showRegister}
        onHide={() => { setShowRegister(false); setRegisterError(''); }}
        onRegister={handleRegister}
        error={registerError}
      />

      {isLoggedIn && (
        <>
          <GitHubModal show={showGitHubModal} onHide={hideGitHub} />
          <GitManagementModal show={showGitModal} onHide={hideGit} />
          <IconManagementModal show={showIconModal} onHide={hideIcons} />
          <AdminModal show={showAdminModal} onHide={hideAdmin} />
          <ImageBrowserModal
            show={showImageBrowserModal}
            onHide={hideImageBrowser}
            onImageSelected={handleImageSelected}
            allowMultiple={false}
          />
        </>
      )}
    </>
  );
}

MobileUserMenu.propTypes = {
  show: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
};

export default MobileUserMenu;
