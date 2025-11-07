import React, { useState, useEffect } from "react";
import { Dropdown } from "react-bootstrap";
import { useDocumentContext } from "@/providers/DocumentContextProvider.jsx";
import { useNotification } from "@/components/NotificationProvider";

function UnsavedDocumentsDropdown({ onFileSelect, onClose }) {
  const { documents } = useDocumentContext();
  const { showInfo } = useNotification();
  const [unsavedDocs, setUnsavedDocs] = useState([]);
  const [showSubmenu, setShowSubmenu] = useState(false);

  useEffect(() => {
    loadUnsavedDocuments();
  }, [documents]);

  const loadUnsavedDocuments = () => {
    // Filter documents that exist only in localStorage (doc IDs starting with 'doc_')
    const localStorageOnly = documents.filter(doc =>
      String(doc.id).startsWith('doc_') &&
      doc.name !== 'Untitled Document' &&
      doc.content &&
      doc.content.trim() !== ''
    );

    // Sort by last updated (most recent first)
    const sorted = localStorageOnly.sort((a, b) => {
      const dateA = new Date(a.updated_at || a.created_at || 0);
      const dateB = new Date(b.updated_at || b.created_at || 0);
      return dateB - dateA;
    });

    setUnsavedDocs(sorted);
  };

  const handleFileSelect = (file) => {
    if (onFileSelect) {
      onFileSelect(file);

      // Show informational message about saving to backend
      showInfo(`Opened "${file.name}" from browser storage. Consider saving to backend to prevent data loss.`);
    }

    setShowSubmenu(false);

    if (onClose) {
      onClose();
    }
  };

  const formatFileDisplayName = (file) => {
    const fileName = file.name || 'Untitled';
    if (fileName.length > 30) {
      return fileName.substring(0, 27) + '...';
    }
    return fileName;
  };

  const formatLastModified = (updatedAt) => {
    if (!updatedAt) return '';

    const date = new Date(updatedAt);
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

  const getContentPreview = (content) => {
    if (!content) return '';

    // Get first line or first 50 characters as preview
    const firstLine = content.split('\n')[0];
    const preview = firstLine.length > 50 ? firstLine.substring(0, 47) + '...' : firstLine;
    return preview || 'Empty document';
  };

  // Don't show if there are no unsaved documents
  if (unsavedDocs.length === 0) {
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
          <i className="bi bi-exclamation-triangle text-warning me-2"></i>
          Unsaved Documents ({unsavedDocs.length})
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
            minWidth: '320px',
            maxWidth: '400px',
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
              <i className="bi bi-exclamation-triangle text-warning me-2"></i>
              <span className="fw-semibold text-warning">Unsaved Documents</span>
            </div>

            <div className="text-muted mb-3" style={{ fontSize: '0.8rem' }}>
              <i className="bi bi-info-circle me-1"></i>
              These documents exist only in your browser. Save them to prevent data loss.
            </div>

            <div className="unsaved-docs-list">
              {unsavedDocs.map((file) => (
                <div
                  key={`unsaved-${file.id}`}
                  className="unsaved-doc-item dropdown-item d-flex flex-column p-2 rounded cursor-pointer border-start border-warning border-2 mb-2"
                  onClick={() => handleFileSelect(file)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleFileSelect(file);
                    }
                  }}
                  style={{
                    marginLeft: '0.5rem',
                    backgroundColor: 'var(--bs-warning-bg-subtle)',
                    borderColor: 'var(--bs-warning-border-subtle)!important'
                  }}
                >
                  <div className="d-flex align-items-start justify-content-between">
                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                      <div className="fw-medium text-truncate d-flex align-items-center" style={{ fontSize: '0.9rem' }}>
                        <i className="bi bi-file-earmark-text me-1 text-warning"></i>
                        {formatFileDisplayName(file)}
                      </div>
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                        {file.category || 'General'} • {file.content ? `${file.content.length} chars` : '0 chars'}
                      </div>
                      <div className="text-muted mt-1" style={{ fontSize: '0.7rem', fontStyle: 'italic' }}>
                        "{getContentPreview(file.content)}"
                      </div>
                    </div>
                    <div className="text-muted ms-2 d-flex flex-column align-items-end" style={{ fontSize: '0.7rem', flexShrink: 0 }}>
                      <span>{formatLastModified(file.updated_at)}</span>
                      <span className="badge bg-warning text-dark mt-1" style={{ fontSize: '0.6rem' }}>
                        Browser Only
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Call to action */}
            <div className="mt-3 pt-2 border-top">
              <div className="text-center">
                <small className="text-muted">
                  <i className="bi bi-lightbulb me-1"></i>
                  Click a document to open it, then use <strong>Save</strong> to store it on the server
                </small>
              </div>
            </div>
          </div>
        </div>
      )}

      <Dropdown.Divider />
    </div>
  );
}

export default UnsavedDocumentsDropdown;