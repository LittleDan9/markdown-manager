import React, { useState, useEffect } from 'react';
import { Modal, Button, Row, Col, Spinner, Alert, Form, OverlayTrigger, Tooltip } from 'react-bootstrap';
import iconsApi from '../../../api/iconsApi';
import { adminIconsApi } from '../../../api/admin';
import { cleanSvgBodyForBrowser } from '../../../utils/svgUtils';

export default function IconViewModal({ icon, show, onHide, initialEditMode = false, onSave }) {
  const [iconData, setIconData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedKey, setEditedKey] = useState('');
  const [editedSearchTerms, setEditedSearchTerms] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (show && icon?.id) {
      // Reset iconData when a new icon is selected
      setIconData(null);
      setError(null);
      setSaveSuccess(false);

      // Fetch fresh data directly without using the callback to avoid circular dependency
      const loadIconData = async () => {
        setLoading(true);
        setError(null);
        try {
          // Use the proper RESTful endpoint for getting icon metadata
          if (icon.pack && icon.pack.name && icon.key) {
            const freshIcon = await iconsApi.getIconMetadata(icon.pack.name, icon.key);
            setIconData(freshIcon);
          } else {
            // Fallback to the ID-based method if pack info is not available
            console.warn('Using ID-based getIconById - pack information not available');
            const freshIcon = await iconsApi.getIconById(icon.id);
            setIconData(freshIcon);
          }
        } catch (err) {
          console.error('Error fetching icon data:', err);
          setError(err.message);
          // Fallback to the passed icon data
          setIconData(icon);
        } finally {
          setLoading(false);
        }
      };

      loadIconData();
      
      // Set initial edit mode immediately if requested, even before data loads
      if (initialEditMode) {
        setIsEditing(true);
        setEditedKey(icon.key || '');
        setEditedSearchTerms(icon.search_terms || '');
      } else {
        // Ensure we're not in edit mode unless explicitly requested
        setIsEditing(false);
      }
    } else if (!show) {
      // Reset all state when modal is hidden
      setIconData(null);
      setError(null);
      setSaveSuccess(false);
      setIsEditing(false);
      setEditedKey('');
      setEditedSearchTerms('');
      setSaving(false);
    }
  }, [show, icon?.id, icon?.key, icon?.search_terms, initialEditMode]); // Removed fetchIconData dependency

  const handleEdit = () => {
    setIsEditing(true);
    setSaveSuccess(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset to original values
    const currentIcon = iconData || icon;
    setEditedKey(currentIcon.key || '');
    setEditedSearchTerms(currentIcon.search_terms || '');
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const metadata = {
        key: editedKey.trim(),
        search_terms: editedSearchTerms.trim()
      };

      const updatedIcon = await adminIconsApi.updateIconMetadata(icon.id, metadata);
      setIconData(updatedIcon);
      setIsEditing(false);
      setSaveSuccess(true);

      // Call parent callback if provided
      if (onSave && typeof onSave === 'function') {
        onSave(updatedIcon);
      }

      // Hide success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error updating icon:', err);
      setError(err.message || 'Failed to update icon');
    } finally {
      setSaving(false);
    }
  };

  if (!icon) return null;

  const renderLargeIcon = () => {
    if (loading) {
      return (
        <div className="text-center text-muted p-5">
          <Spinner animation="border" />
          <p className="mt-2">Loading icon data...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center text-muted p-5">
          <i className="bi bi-exclamation-triangle" style={{ fontSize: '4rem' }}></i>
          <p className="mt-2">Error loading icon: {error}</p>
        </div>
      );
    }

    // Use fresh API data if available, fallback to passed icon data
    const iconToRender = iconData || icon;

    if (!iconToRender.icon_data || !iconToRender.icon_data.body) {
      return (
        <div className="text-center text-muted p-5">
          <i className="bi bi-image" style={{ fontSize: '4rem' }}></i>
          <p className="mt-2">No icon data available</p>
        </div>
      );
    }

    const { body, width = 24, height = 24, viewBox } = iconToRender.icon_data;

    return (
      <div className="text-center p-4">
        <div style={{
          border: '1px solid var(--bs-border-color)',
          borderRadius: '0.375rem',
          padding: '20px',
          backgroundColor: 'var(--bs-body-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
        }}>
          <svg
            viewBox={viewBox || `0 0 ${width} ${height}`}
            fill="currentColor"
            className="icon-svg"
            style={{
              display: 'block',
              color: 'var(--bs-primary, #0d6efd)',
              width: '100%',
              height: '100%',
              maxWidth: '260px',
              maxHeight: '260px'
            }}
          >
            <g dangerouslySetInnerHTML={{ __html: cleanSvgBodyForBrowser(body) }} />
          </svg>
        </div>
      </div>
    );
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      // You could add a toast notification here if needed
    });
  };

  // Use fresh API data if available, fallback to passed icon data
  const displayIcon = iconData || icon;

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <div className="d-flex align-items-center">
            <div className="me-3">
              {displayIcon.icon_data && displayIcon.icon_data.body ? (
                <svg
                  width="32"
                  height="32"
                  viewBox={displayIcon.icon_data.viewBox || `0 0 ${displayIcon.icon_data.width || 24} ${displayIcon.icon_data.height || 24}`}
                  fill="currentColor"
                  className="icon-svg"
                >
                  <g dangerouslySetInnerHTML={{ __html: cleanSvgBodyForBrowser(displayIcon.icon_data.body) }} />
                </svg>
              ) : (
                <i className="bi bi-image"></i>
              )}
            </div>
            <div>
              <div>{displayIcon.key}</div>
              <small className="text-muted">
                {displayIcon.pack ? displayIcon.pack.display_name : 'Unknown Pack'}
              </small>
            </div>
          </div>
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {saveSuccess && (
          <Alert variant="success" className="mb-3">
            Icon updated successfully! Documents using this icon have been automatically updated.
          </Alert>
        )}

        <Row>
          {/* Large Icon Display */}
          <Col md={6}>
            <h6 className="mb-3">Icon Preview</h6>
            {renderLargeIcon()}
          </Col>

          {/* Icon Details */}
          <Col md={6}>
            <h6 className="mb-3">Details</h6>

            <div className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <strong>Icon Key:</strong>
                {!isEditing && !initialEditMode && (
                  <Button variant="outline-primary" size="sm" onClick={handleEdit}>
                    <i className="bi bi-pencil"></i> Edit
                  </Button>
                )}
              </div>
              <div className="mt-1">
                {isEditing ? (
                  <Form.Control
                    type="text"
                    value={editedKey}
                    onChange={(e) => setEditedKey(e.target.value)}
                    placeholder="Enter icon key"
                    disabled={saving}
                  />
                ) : (
                  <span
                    className="cursor-pointer"
                    onClick={() => copyToClipboard(displayIcon.key)}
                    title="Click to copy"
                    style={{ cursor: 'pointer' }}
                  >
                    {displayIcon.key}
                  </span>
                )}
              </div>
            </div>

            <div className="mb-3">
              <strong>Full Key:</strong>
              <div className="mt-1">
                <small
                  className="text-muted cursor-pointer text-decoration-underline"
                  onClick={() => copyToClipboard(displayIcon.full_key)}
                  title="Click to copy full key"
                  style={{ cursor: 'pointer' }}
                >
                  {displayIcon.full_key.length > 40
                    ? `${displayIcon.full_key.substring(0, 37)}...`
                    : displayIcon.full_key
                  }
                </small>
              </div>
            </div>

            {displayIcon.search_terms && (
              <div className="mb-3">
                <div className="d-flex align-items-center mb-2">
                  <strong>Search Terms:</strong>
                  <OverlayTrigger
                    placement="top"
                    overlay={
                      <Tooltip>
                        Space-delimited keywords used when searching for this icon.
                        Example: &quot;aws lambda serverless function compute&quot;
                      </Tooltip>
                    }
                  >
                    <i className="bi bi-info-circle ms-2 text-muted" style={{ cursor: 'help' }}></i>
                  </OverlayTrigger>
                </div>
                <div className="mt-1">
                  {isEditing ? (
                    <Form.Control
                      as="textarea"
                      rows={2}
                      value={editedSearchTerms}
                      onChange={(e) => setEditedSearchTerms(e.target.value)}
                      placeholder="Enter space-delimited keywords (e.g., aws lambda serverless function)"
                      disabled={saving}
                    />
                  ) : (
                    <small className="text-muted">{displayIcon.search_terms}</small>
                  )}
                </div>
              </div>
            )}

            {displayIcon.icon_data && (displayIcon.icon_data.width !== 24 || displayIcon.icon_data.height !== 24 || displayIcon.icon_data.viewBox) && (
              <div className="mb-3">
                <strong>Properties:</strong>
                <div className="mt-1">
                  <small className="text-muted">
                    {displayIcon.icon_data.width || 24} × {displayIcon.icon_data.height || 24}
                    {displayIcon.icon_data.viewBox && ` • ViewBox: ${displayIcon.icon_data.viewBox}`}
                  </small>
                </div>
              </div>
            )}
          </Col>
        </Row>
      </Modal.Body>

      <Modal.Footer>
        {isEditing ? (
          <div className="d-flex gap-2">
            <Button
              variant="outline-secondary"
              onClick={handleCancel}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saving || !editedKey.trim()}
            >
              {saving ? (
                <>
                  <Spinner size="sm" className="me-2" />
                  Saving...
                </>
              ) : (
                <>
                  <i className="bi bi-check-lg"></i> Save Changes
                </>
              )}
            </Button>
          </div>
        ) : (
          <Button variant="secondary" onClick={onHide}>
            Close
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}
