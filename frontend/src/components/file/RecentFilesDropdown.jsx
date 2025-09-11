import React, { useState, useEffect } from "react";
import { Dropdown } from "react-bootstrap";
import { useAuth } from "@/providers/AuthProvider";
import { useNotification } from "@/components/NotificationProvider";
import { DocumentStorageService } from "@/services/core";
import documentsApi from "@/api/documentsApi";

function RecentFilesDropdown({ onFileSelect }) {
  const { isAuthenticated } = useAuth();
  const { showError } = useNotification();
  const [recentLocal, setRecentLocal] = useState([]);
  const [recentGitHub, setRecentGitHub] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadRecentFiles();
  }, [isAuthenticated]);

  const loadRecentFiles = async () => {
    setLoading(true);
    try {
      // Always get local recent files
      const localFiles = DocumentStorageService.getRecentLocalDocuments(3);
      setRecentLocal(localFiles);

      // Get GitHub recent files if authenticated
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

  const handleFileSelect = (file) => {
    if (onFileSelect) {
      onFileSelect(file);
    }
  };

  const formatFileDisplayName = (file) => {
    // Truncate long names
    if (file.name.length > 25) {
      return file.name.substring(0, 22) + '...';
    }
    return file.name;
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

  // Don't show the dropdown if there are no recent files
  if (!loading && recentLocal.length === 0 && recentGitHub.length === 0) {
    return null;
  }

  return (
    <>
      <Dropdown.Item className="recent-files-dropdown p-0">
        <div className="p-2">
          <div className="d-flex align-items-center mb-2">
            <i className="bi bi-clock-history me-2 text-muted"></i>
            <span className="fw-semibold text-muted">Recent Files</span>
          </div>
          
          {loading ? (
            <div className="text-center py-2">
              <div className="spinner-border spinner-border-sm text-secondary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : (
            <>
              {/* Local Documents Section */}
              {recentLocal.length > 0 && (
                <div className="mb-2">
                  <div className="d-flex align-items-center mb-1">
                    <i className="bi bi-hdd me-1" style={{ fontSize: '0.8rem' }}></i>
                    <small className="text-muted fw-medium">Local</small>
                  </div>
                  {recentLocal.map((file) => (
                    <div
                      key={file.id}
                      className="recent-file-item d-flex align-items-center justify-content-between p-2 rounded hover-bg-light cursor-pointer"
                      onClick={() => handleFileSelect(file)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          handleFileSelect(file);
                        }
                      }}
                    >
                      <div className="flex-grow-1 min-width-0">
                        <div className="fw-medium text-truncate" style={{ fontSize: '0.9rem' }}>
                          {formatFileDisplayName(file)}
                        </div>
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                          {file.category || 'General'}
                        </div>
                      </div>
                      <div className="text-muted ms-2" style={{ fontSize: '0.7rem' }}>
                        {formatLastOpened(file.last_opened_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* GitHub Documents Section */}
              {isAuthenticated && recentGitHub.length > 0 && (
                <div>
                  <div className="d-flex align-items-center mb-1">
                    <i className="bi bi-github me-1" style={{ fontSize: '0.8rem' }}></i>
                    <small className="text-muted fw-medium">GitHub</small>
                  </div>
                  {recentGitHub.map((file) => (
                    <div
                      key={file.id}
                      className="recent-file-item d-flex align-items-center justify-content-between p-2 rounded hover-bg-light cursor-pointer"
                      onClick={() => handleFileSelect(file)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          handleFileSelect(file);
                        }
                      }}
                    >
                      <div className="flex-grow-1 min-width-0">
                        <div className="fw-medium text-truncate" style={{ fontSize: '0.9rem' }}>
                          {formatFileDisplayName(file)}
                        </div>
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                          {file.github_repository?.name || 'GitHub'}
                        </div>
                      </div>
                      <div className="text-muted ms-2" style={{ fontSize: '0.7rem' }}>
                        {formatLastOpened(file.last_opened_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </Dropdown.Item>
      
      {/* Only show divider if recent files are present */}
      <Dropdown.Divider className="my-1" />
    </>
  );
}

export default RecentFilesDropdown;
