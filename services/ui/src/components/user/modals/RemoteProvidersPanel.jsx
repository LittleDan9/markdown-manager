import React, { useState, useEffect, useCallback } from 'react';
import { Alert, Badge, Button, Card, Col, Row, Spinner } from 'react-bootstrap';
import aiProviderSyncApi from '../../../api/aiProviderSyncApi';

const SOURCE_LABELS = {
  'markdown-manager': 'Markdown Manager',
  'team-manager': 'Team Manager',
};

/**
 * Cross-app remote providers panel — shows providers from other apps
 * and allows import/export of API keys.
 */
export default function RemoteProvidersPanel({ localKeys, onImported }) {
  const [remoteProviders, setRemoteProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState({});
  const [exporting, setExporting] = useState({});
  const [feedback, setFeedback] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await aiProviderSyncApi.getRemoteProviders();
      setRemoteProviders(data);
      setError(null);
    } catch {
      setError('Failed to load remote providers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleImport = async (remote) => {
    setImporting(prev => ({ ...prev, [remote.id]: true }));
    try {
      await aiProviderSyncApi.importRemoteProvider(remote.remote_id, remote.source_app);
      setFeedback({ type: 'success', msg: `Imported "${remote.label || remote.provider}" from ${SOURCE_LABELS[remote.source_app] || remote.source_app}` });
      if (onImported) onImported();
      load();
    } catch (err) {
      setFeedback({ type: 'danger', msg: err?.message || 'Import failed' });
    } finally {
      setImporting(prev => ({ ...prev, [remote.id]: false }));
    }
  };

  const handleExport = async (key) => {
    setExporting(prev => ({ ...prev, [key.id]: true }));
    try {
      await aiProviderSyncApi.exportProvider(key.id);
      setFeedback({ type: 'success', msg: `Exported "${key.label || key.provider}" to Team Manager` });
    } catch (err) {
      setFeedback({ type: 'danger', msg: err?.message || 'Export failed' });
    } finally {
      setExporting(prev => ({ ...prev, [key.id]: false }));
    }
  };

  // Check if a remote provider already exists locally
  const isAlreadyLocal = (remote) => {
    return (localKeys || []).some(
      k => k.provider === remote.provider && (k.label || '') === (remote.label || '')
    );
  };

  if (loading) {
    return (
      <div className="text-center py-3">
        <Spinner animation="border" size="sm" className="me-2" />
        Loading remote providers...
      </div>
    );
  }

  if (remoteProviders.length === 0 && (localKeys || []).length === 0) {
    return null; // Hide entire section if nothing to show
  }

  return (
    <div className="mt-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="mb-0">
          <i className="bi bi-cloud-arrow-down me-1" />
          Cross-App Sync
        </h6>
        <div className="d-flex gap-1">
          <Button variant="outline-secondary" size="sm" onClick={load} title="Refresh">
            <i className="bi bi-arrow-clockwise" />
          </Button>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => aiProviderSyncApi.publishProviderState().then(() =>
              setFeedback({ type: 'success', msg: 'State published' })
            ).catch(() => setFeedback({ type: 'danger', msg: 'Publish failed' }))}
            title="Publish state to other apps"
          >
            <i className="bi bi-cloud-arrow-up" />
          </Button>
        </div>
      </div>

      {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}
      {feedback && <Alert variant={feedback.type} dismissible onClose={() => setFeedback(null)}>{feedback.msg}</Alert>}

      {/* Remote providers available for import */}
      {remoteProviders.length > 0 && (
        <>
          <small className="text-muted d-block mb-2">
            Providers in other apps — import to copy the API key here.
          </small>
          <Row className="g-2 mb-3">
            {remoteProviders.map(r => {
              const alreadyLocal = isAlreadyLocal(r);
              return (
                <Col xs={12} md={6} key={r.id}>
                  <Card className={`h-100 ${alreadyLocal ? 'border-success' : 'border-warning'}`}>
                    <Card.Body className="py-2 px-3">
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <strong>{r.label || r.provider}</strong>
                          <Badge bg="info" className="ms-2" pill>
                            {SOURCE_LABELS[r.source_app] || r.source_app}
                          </Badge>
                        </div>
                      </div>
                      <div className="small text-muted mt-1">
                        <Badge bg="secondary" className="me-1">{r.provider}</Badge>
                        {r.preferred_model && <span>Model: {r.preferred_model}</span>}
                      </div>
                      <div className="mt-1">
                        {r.has_key ? (
                          <Badge bg="success" className="me-1">Has Key</Badge>
                        ) : (
                          <Badge bg="secondary">No Key</Badge>
                        )}
                        {alreadyLocal && <Badge bg="outline-success" text="success">Already local</Badge>}
                      </div>
                    </Card.Body>
                    <Card.Footer className="py-1 px-3">
                      <Button
                        variant="outline-primary"
                        size="sm"
                        disabled={importing[r.id] || !r.has_key}
                        onClick={() => handleImport(r)}
                      >
                        {importing[r.id] ? <Spinner animation="border" size="sm" className="me-1" /> : <i className="bi bi-cloud-download me-1" />}
                        Import
                      </Button>
                    </Card.Footer>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </>
      )}

      {/* Export local providers */}
      {(localKeys || []).filter(k => k.has_api_key !== false).length > 0 && (
        <>
          <small className="text-muted d-block mb-2">
            Export a local provider to Team Manager.
          </small>
          <div className="d-flex flex-wrap gap-1">
            {(localKeys || []).filter(k => k.has_api_key !== false).map(k => (
              <Button
                key={k.id}
                variant="outline-secondary"
                size="sm"
                disabled={exporting[k.id]}
                onClick={() => handleExport(k)}
              >
                {exporting[k.id] ? <Spinner animation="border" size="sm" className="me-1" /> : <i className="bi bi-cloud-upload me-1" />}
                {k.label || k.provider}
              </Button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
