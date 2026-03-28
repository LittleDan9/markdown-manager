import React, { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Dropdown, Badge, Spinner } from 'react-bootstrap';
import collaborationApi from '@/api/collaborationApi';

const SEEN_KEY = 'sharedWithMe_seen';

function getSeenIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function markSeen(docId) {
  const seen = getSeenIds();
  seen.add(docId);
  localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
}

/**
 * SharedWithMeDropdown — Toolbar dropdown showing documents shared with the current user.
 * Badge only shows for documents that haven't been opened yet.
 */
function SharedWithMeDropdown({ onOpen }) {
  const [show, setShow] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [seenIds, setSeenIds] = useState(getSeenIds);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await collaborationApi.getSharedWithMe();
      setDocuments(data);
      // Refresh seen set (prune IDs no longer in shared list)
      setSeenIds(getSeenIds());
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const unopenedCount = useMemo(() => {
    return documents.filter(d => !seenIds.has(d.document_id)).length;
  }, [documents, seenIds]);

  const handleToggle = (isOpen) => {
    setShow(isOpen);
    if (isOpen) load();
  };

  const handleOpen = (doc) => {
    markSeen(doc.id);
    setSeenIds(getSeenIds());
    if (onOpen) onOpen(doc);
    setShow(false);
  };

  return (
    <Dropdown show={show} onToggle={handleToggle} align="end">
      <Dropdown.Toggle
        variant="outline-secondary"
        size="sm"
        id="shared-with-me-dropdown"
        title="Documents shared with you"
        className="position-relative"
      >
        <i className="bi bi-people" />
        {unopenedCount > 0 && (
          <Badge
            bg="info"
            pill
            className="position-absolute top-0 start-100 translate-middle"
            style={{ fontSize: '0.6em' }}
          >
            {unopenedCount}
          </Badge>
        )}
      </Dropdown.Toggle>

      <Dropdown.Menu className="shared-dropdown-menu">
        <div className="d-flex justify-content-between align-items-center px-3 py-2 shared-dropdown-header">
          <strong>Shared with Me</strong>
          {documents.length > 0 && (
            <button
              className="btn btn-link btn-sm p-0 text-decoration-none shared-dropdown-action"
              onClick={(e) => { e.stopPropagation(); load(); }}
              title="Refresh"
            >
              <i className="bi bi-arrow-clockwise" />
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-4 shared-dropdown-empty">
            <Spinner animation="border" size="sm" className="me-2" />
            Loading...
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center shared-dropdown-empty py-4">
            <i className="bi bi-inbox d-block mb-2" style={{ fontSize: '1.5em' }} />
            No shared documents
          </div>
        ) : (
          documents.map((doc) => {
            const isNew = !seenIds.has(doc.document_id);
            return (
              <div
                key={doc.document_id}
                className={`d-flex align-items-center gap-2 px-3 py-2 shared-dropdown-item${isNew ? ' shared-dropdown-item--new' : ''}`}
                onClick={() => handleOpen({ id: doc.document_id, name: doc.document_name, ownerName: doc.owner_name })}
              >
                <i className={`bi ${isNew ? 'bi-file-earmark-plus' : 'bi-file-earmark-text'} mt-1 shared-dropdown-icon`} />
                <div className="flex-grow-1" style={{ minWidth: 0 }}>
                  <div className={`small shared-dropdown-title${isNew ? ' fw-semibold' : ' fw-medium'}`}>{doc.document_name}</div>
                  <div className="small shared-dropdown-meta">
                    {doc.owner_name}
                    {doc.updated_at && ` · ${new Date(doc.updated_at).toLocaleDateString()}`}
                  </div>
                </div>
                <Badge bg={doc.role === 'editor' ? 'primary' : 'secondary'} style={{ fontSize: '0.7em' }}>
                  {doc.role}
                </Badge>
              </div>
            );
          })
        )}
      </Dropdown.Menu>
    </Dropdown>
  );
}

SharedWithMeDropdown.propTypes = {
  onOpen: PropTypes.func.isRequired,
};

export default SharedWithMeDropdown;
