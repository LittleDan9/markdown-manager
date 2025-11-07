import React, { useState, useEffect } from "react";
import { Dropdown } from "react-bootstrap";
import { useAuth } from "@/providers/AuthProvider";
import { useNotification } from "@/components/NotificationProvider";
import { serviceFactory } from "@/services/injectors";
import documentsApi from "@/api/documentsApi";

function RecentFilesDropdown({ onFileSelect, onClose }) {
  const { isAuthenticated } = useAuth();
  const { showError } = useNotification();
  const documentStorageService = serviceFactory.createDocumentStorageService();
  const [recentLocal, setRecentLocal] = useState([]);
  const [recentGitHub, setRecentGitHub] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSubmenu, setShowSubmenu] = useState(false);

  useEffect(() => {
    loadRecentFiles();
  }, [isAuthenticated]);

  const loadRecentFiles = async () => {
    setLoading(true);
    try {
      // Get local recent files (3 most recent)
      if (isAuthenticated) {
        // When authenticated, use backend API for local documents
        try {
          const localFiles = await documentsApi.getRecentLocalDocuments(3);
          setRecentLocal(localFiles);
        } catch (error) {
          console.warn('Failed to load recent local documents from API, falling back to localStorage:', error);
          const localFiles = documentStorageService.getRecentLocalDocuments(3);
          setRecentLocal(localFiles);
        }
      } else {
        // When not authenticated, use localStorage
        const localFiles = documentStorageService.getRecentLocalDocuments(3);
        setRecentLocal(localFiles);
      }

      // Get GitHub recent files if authenticated (3 most recent)
      if (isAuthenticated) {
        try {
          const githubFiles = await documentsApi.getRecentGitHubDocuments(3);
          setRecentGitHub(githubFiles);
        } catch (error) {
          console.warn('Failed to load recent GitHub documents:', error);
          setRecentGitHub([]);
        }
      } else {
        setRecentGitHub([]);
      }
    } catch (error) {
      console.error('Failed to load recent files:', error);
      showError('Failed to load recent files');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (file) => {
    if (onFileSelect) {
      // Mark document as opened if it has an ID and we're authenticated
      if (isAuthenticated && file.id) {
        try {
          await documentsApi.markDocumentOpened(file.id);
        } catch (error) {
          console.warn('Failed to mark document as opened:', error);
        }
      } else if (!isAuthenticated && file.id) {
        // For local documents when not authenticated, use local storage tracking
        documentStorageService.markDocumentOpened(file.id);
      }

      onFileSelect(file);
    }

    setShowSubmenu(false); // Close submenu after selection

    // Close the main dropdown
    if (onClose) {
      onClose();
    }
  };

  const formatFileDisplayName = (file) => {
    // Use appropriate field based on file source
    const fileName = file.name || file.title || 'Untitled';

    // Truncate long names for submenu
    if (fileName.length > 30) {
      return fileName.substring(0, 27) + '...';
    }
    return fileName;
  };

  const formatLastOpened = (lastOpenedAt) => {
    if (!lastOpenedAt) return '';

    const date = new Date(lastOpenedAt);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Don't show if there are no recent files
  if (!loading && recentLocal.length === 0 && recentGitHub.length === 0) {
    return null;
  }

  return (
    <div
      className="dropdown-submenu"
      onMouseEnter={() => setShowSubmenu(true)}
      onMouseLeave={() => setShowSubmenu(false)}
    >
      <Dropdown.Item
        as="div"
        className="d-flex justify-content-between align-items-center"
        style={{ cursor: 'pointer' }}
      >
        <span>
          <i className="bi bi-clock-history me-2"></i>
          Recent Files
        </span>
        <i className="bi bi-chevron-right"></i>
      </Dropdown.Item>

      {showSubmenu && (
        <div
          className="dropdown-submenu-menu show"
          style={{
            position: 'absolute',
            top: 0,
            left: '100%',
            zIndex: 1001,
            minWidth: '280px',
            maxWidth: '350px',
            marginTop: '-0.5rem',
            marginLeft: '0.125rem',
            backgroundColor: 'var(--bs-body-bg)',
            border: '1px solid var(--bs-border-color)',
            borderRadius: '0.375rem',
            boxShadow: '0 0.5rem 1rem rgba(0, 0, 0, 0.175)',
            padding: '0.5rem 0'
          }}
        >
          <div className="px-3 py-2">
            <div className="d-flex align-items-center mb-2">
              <i className="bi bi-clock-history me-2 text-muted"></i>
              <span className="fw-semibold text-muted">Recent Files</span>
            </div>

            {loading ? (
              <div className="text-center py-3">
                <div className="spinner-border spinner-border-sm text-secondary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
              </div>
            ) : (
              <>
                {/* Local Documents Section */}
                {recentLocal.length > 0 && (
                  <div className="mb-3">
                    <div className="d-flex align-items-center mb-2">
                      <i className="bi bi-hdd me-1" style={{ fontSize: '0.8rem' }}></i>
                      <small className="text-muted fw-medium">Local Documents</small>
                    </div>
                    {recentLocal.map((file) => (
                      <div
                        key={`local-${file.id}`}
                        className="recent-file-item dropdown-item d-flex align-items-center justify-content-between p-2 rounded cursor-pointer"
                        onClick={() => handleFileSelect(file)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            handleFileSelect(file);
                          }
                        }}
                      >
                        <div className="flex-grow-1" style={{ minWidth: 0 }}>
                          <div className="fw-medium text-truncate" style={{ fontSize: '0.9rem' }}>
                            {formatFileDisplayName(file)}
                          </div>
                          <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                            {file.category || file.category_name || file.folder_path || 'General'}
                          </div>
                        </div>
                        <div className="text-muted ms-2" style={{ fontSize: '0.7rem', flexShrink: 0 }}>
                          {formatLastOpened(file.last_opened_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* GitHub Documents Section */}
                {isAuthenticated && recentGitHub.length > 0 && (
                  <div>
                    <div className="d-flex align-items-center mb-2">
                      <i className="bi bi-github me-1" style={{ fontSize: '0.8rem' }}></i>
                      <small className="text-muted fw-medium">GitHub Documents</small>
                    </div>
                    {recentGitHub.map((file) => (
                      <div
                        key={`github-${file.id}`}
                        className="recent-file-item dropdown-item d-flex align-items-center justify-content-between p-2 rounded cursor-pointer"
                        onClick={() => handleFileSelect(file)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            handleFileSelect(file);
                          }
                        }}
                      >
                        <div className="flex-grow-1" style={{ minWidth: 0 }}>
                          <div className="fw-medium text-truncate" style={{ fontSize: '0.9rem' }}>
                            {formatFileDisplayName(file)}
                          </div>
                          <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                            {file.github_repository?.name || 'GitHub'}
                          </div>
                        </div>
                        <div className="text-muted ms-2" style={{ fontSize: '0.7rem', flexShrink: 0 }}>
                          {formatLastOpened(file.last_opened_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* No recent files message */}
                {recentLocal.length === 0 && recentGitHub.length === 0 && (
                  <div className="text-center py-3 text-muted">
                    <i className="bi bi-inbox d-block mb-2" style={{ fontSize: '1.5rem' }}></i>
                    <small>No recent files</small>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <Dropdown.Divider />
    </div>
  );
}

export default RecentFilesDropdown;
