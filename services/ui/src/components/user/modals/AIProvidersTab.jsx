import React, { useState, useEffect, useCallback } from 'react';
import {
  Accordion,
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  Row,
  Spinner,
} from 'react-bootstrap';
import apiKeysApi from '../../../api/apiKeysApi';

/** Registry of known provider types — drives the "Add Provider" dropdown. */
const PROVIDERS = [
  {
    id: 'github',
    name: 'GitHub Models',
    icon: 'bi-github',
    defaultUrl: 'https://models.github.ai',
    defaultModel: 'openai/gpt-4o-mini',
    placeholder: 'github_pat_...',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    icon: 'bi-chat-dots',
    defaultUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    placeholder: 'sk-...',
  },
  {
    id: 'xai',
    name: 'xAI (Grok)',
    icon: 'bi-lightning-charge',
    defaultUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-3-mini-fast',
    placeholder: 'xai-...',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    icon: 'bi-google',
    defaultUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.0-flash',
    placeholder: 'AIza...',
  },
];

const providerById = (id) => PROVIDERS.find((p) => p.id === id);

/** A single key card rendered inside an Accordion.Item. */
function KeyCard({ keyData, provider, onSaved, onDeleted }) {
  const [apiKey, setApiKey] = useState('');
  const [label, setLabel] = useState(keyData?.label || '');
  const [baseUrl, setBaseUrl] = useState(keyData?.base_url || '');
  const [model, setModel] = useState(keyData?.preferred_model || provider.defaultModel);
  const [models, setModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState('');

  const isConfigured = !!keyData?.id;

  const fetchModels = useCallback(async () => {
    if (!keyData?.id) return;
    setLoadingModels(true);
    try {
      const result = await apiKeysApi.listModels(keyData.id);
      if (result.models?.length) setModels(result.models);
    } catch {
      // Silently fail — user can still type manually
    } finally {
      setLoadingModels(false);
    }
  }, [keyData?.id]);

  useEffect(() => { fetchModels(); }, [fetchModels]);

  const handleSave = async () => {
    if (!isConfigured && !apiKey) return;
    setSaving(true);
    setError('');
    setTestResult(null);
    try {
      const data = {
        provider: provider.id,
        label: label || provider.name,
        base_url: baseUrl || undefined,
        preferred_model: model,
      };
      if (isConfigured) {
        const updates = { label: data.label, base_url: data.base_url, preferred_model: data.preferred_model };
        if (apiKey) updates.api_key = apiKey;
        await apiKeysApi.updateKey(keyData.id, updates);
      } else {
        data.api_key = apiKey;
        await apiKeysApi.addKey(data);
      }
      setApiKey('');
      onSaved();
    } catch (err) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!keyData?.id) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await apiKeysApi.testKey(keyData.id);
      setTestResult(result);
    } catch (err) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!keyData?.id) return;
    const displayName = keyData.label || provider.name;
    if (!window.confirm(`Remove "${displayName}" API key?`)) return;
    try {
      await apiKeysApi.deleteKey(keyData.id);
      onDeleted();
    } catch (err) {
      setError(err.message || 'Failed to delete');
    }
  };

  return (
    <div className="ai-key-card-body">
      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}
      {testResult && (
        <Alert variant={testResult.success ? 'success' : 'danger'} dismissible onClose={() => setTestResult(null)}>
          {testResult.success
            ? `Connected successfully (model: ${testResult.model})`
            : `Connection failed: ${testResult.error || 'Unknown error'}`}
        </Alert>
      )}

      <Row className="g-3">
        <Col md={6}>
          <Form.Group>
            <Form.Label>API Key</Form.Label>
            <Form.Control
              type="password"
              placeholder={isConfigured ? '••••••••••••• (unchanged)' : provider.placeholder}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
            />
            <Form.Text className="text-muted">
              {isConfigured ? 'Leave blank to keep current key' : 'Required'}
            </Form.Text>
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group>
            <Form.Label>Label</Form.Label>
            <Form.Control
              type="text"
              placeholder={provider.name}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group>
            <Form.Label>
              Model
              {isConfigured && (
                <Button variant="link" size="sm" className="p-0 ms-2" onClick={fetchModels} disabled={loadingModels} title="Refresh models from provider">
                  <i className={`bi bi-arrow-clockwise${loadingModels ? ' spin' : ''}`} />
                </Button>
              )}
            </Form.Label>
            {models.length > 0 ? (
              <>
                <Form.Select value={model} onChange={(e) => setModel(e.target.value)}>
                  {!models.some((m) => m.id === model) && model && <option value={model}>{model}</option>}
                  {models.map((m) => <option key={m.id} value={m.id}>{m.name || m.id}</option>)}
                </Form.Select>
                <Form.Text className="text-muted">{models.length} models available</Form.Text>
              </>
            ) : (
              <>
                <Form.Control type="text" placeholder={provider.defaultModel} value={model} onChange={(e) => setModel(e.target.value)} />
                <Form.Text className="text-muted">
                  {isConfigured
                    ? (loadingModels ? 'Loading models...' : 'Save and test key to load available models')
                    : 'Save key first to load available models'}
                </Form.Text>
              </>
            )}
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group>
            <Form.Label>Base URL <span className="text-muted small">(optional)</span></Form.Label>
            <Form.Control type="text" placeholder={provider.defaultUrl} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
            <Form.Text className="text-muted">Override if using a custom endpoint</Form.Text>
          </Form.Group>
        </Col>
      </Row>

      <div className="d-flex gap-2 mt-3">
        <Button variant="primary" size="sm" onClick={handleSave} disabled={saving || (!isConfigured && !apiKey)}>
          {saving && <Spinner size="sm" animation="border" className="me-1" />}
          {isConfigured ? 'Update' : 'Save Key'}
        </Button>
        {isConfigured && (
          <Button variant="outline-secondary" size="sm" onClick={handleTest} disabled={testing}>
            {testing ? <Spinner size="sm" animation="border" className="me-1" /> : <i className="bi bi-plug me-1" />}
            Test Connection
          </Button>
        )}
        {isConfigured ? (
          <Button variant="outline-danger" size="sm" onClick={handleDelete} className="ms-auto">
            <i className="bi bi-trash me-1" />Delete
          </Button>
        ) : (
          <Button variant="outline-secondary" size="sm" onClick={() => onDeleted()} className="ms-auto">
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

function AIProvidersTab() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingCards, setPendingCards] = useState([]); // [{tempId, providerId}]
  const [addType, setAddType] = useState('');
  const [openKeys, setOpenKeys] = useState([]); // eventKeys of open accordion items

  let nextTempId = 0;

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiKeysApi.getKeys();
      const loaded = data.keys || [];
      setKeys(loaded);
      return loaded;
    } catch (err) {
      setError(err.message || 'Failed to load API keys');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  const handleAdd = () => {
    if (!addType) return;
    const tempId = `pending-${Date.now()}-${nextTempId++}`;
    setPendingCards((prev) => [...prev, { tempId, providerId: addType }]);
    setOpenKeys((prev) => [...prev, tempId]);
    setAddType('');
  };

  const handleSaved = async (tempId) => {
    // Remove the pending card if it was unsaved, then reload all keys
    if (tempId) setPendingCards((prev) => prev.filter((c) => c.tempId !== tempId));
    const prevIds = new Set(keys.map((k) => k.id));
    const loaded = await loadKeys();
    // Auto-expand the newly created key
    const newKey = loaded.find((k) => !prevIds.has(k.id));
    if (newKey) {
      setOpenKeys((prev) => [...prev, `saved-${newKey.id}`]);
    }
  };

  const handleDeletedSaved = (keyId) => {
    // A saved key was deleted — reload
    loadKeys();
  };

  const handleCancelPending = (tempId) => {
    setPendingCards((prev) => prev.filter((c) => c.tempId !== tempId));
    setOpenKeys((prev) => prev.filter((k) => k !== tempId));
  };

  if (loading) {
    return (
      <div className="text-center py-4">
        <Spinner animation="border" size="sm" className="me-2" />
        Loading AI providers...
      </div>
    );
  }

  return (
    <div className="ai-providers-tab mt-3">
      <p className="text-muted mb-3">
        Configure API keys for third-party AI providers. These are stored encrypted and used for chat responses.
        Local Ollama is always available without configuration.
      </p>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

      {/* Add Provider row */}
      <div className="ai-add-provider d-flex gap-2 mb-3 align-items-center">
        <Form.Select size="sm" value={addType} onChange={(e) => setAddType(e.target.value)} className="flex-grow-1">
          <option value="">Select a provider to add…</option>
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Form.Select>
        <Button variant="primary" size="sm" onClick={handleAdd} disabled={!addType}>
          <i className="bi bi-plus-lg me-1" />Add
        </Button>
      </div>

      {/* Saved keys + pending cards in accordion */}
      {(keys.length > 0 || pendingCards.length > 0) && (
        <Accordion
          alwaysOpen
          activeKey={openKeys}
          onSelect={(eventKeys) => setOpenKeys(eventKeys || [])}
        >
          {keys.map((key) => {
            const provider = providerById(key.provider) || {
              id: key.provider,
              name: key.provider,
              icon: 'bi-key',
              defaultUrl: '',
              defaultModel: '',
              placeholder: '',
            };
            const eventKey = `saved-${key.id}`;
            return (
              <Accordion.Item key={eventKey} eventKey={eventKey}>
                <Accordion.Header>
                  <div className="ai-key-header">
                    <i className={`bi ${provider.icon}`} />
                    <span className="ai-key-label">{key.label || provider.name}</span>
                    <Badge bg={key.is_active ? 'success' : 'secondary'} pill className="ms-2">
                      {key.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    {key.preferred_model && (
                      <span className="ai-key-model text-muted ms-2">{key.preferred_model}</span>
                    )}
                  </div>
                </Accordion.Header>
                <Accordion.Body>
                  <KeyCard
                    keyData={key}
                    provider={provider}
                    onSaved={() => handleDeletedSaved(key.id)}
                    onDeleted={() => handleDeletedSaved(key.id)}
                  />
                </Accordion.Body>
              </Accordion.Item>
            );
          })}
          {pendingCards.map((card) => {
            const provider = providerById(card.providerId);
            if (!provider) return null;
            return (
              <Accordion.Item key={card.tempId} eventKey={card.tempId}>
                <Accordion.Header>
                  <div className="ai-key-header">
                    <i className={`bi ${provider.icon}`} />
                    <span className="ai-key-label">{provider.name}</span>
                    <Badge bg="warning" text="dark" pill className="ms-2">Unsaved</Badge>
                  </div>
                </Accordion.Header>
                <Accordion.Body>
                  <KeyCard
                    keyData={null}
                    provider={provider}
                    onSaved={() => handleSaved(card.tempId)}
                    onDeleted={() => handleCancelPending(card.tempId)}
                  />
                </Accordion.Body>
              </Accordion.Item>
            );
          })}
        </Accordion>
      )}

      {/* Empty state when no keys and no pending */}
      {keys.length === 0 && pendingCards.length === 0 && (
        <div className="text-center text-muted py-3 mb-3">
          <i className="bi bi-key fs-4 d-block mb-1" />
          No API keys configured yet. Use the dropdown above to add a provider.
        </div>
      )}

      {/* Ollama info card */}
      <Card className="border-dashed">
        <Card.Body className="text-center text-muted py-3">
          <i className="bi bi-cpu fs-4 d-block mb-1" />
          <strong>Ollama (Local)</strong>
          <div className="small">Always available — configured by your administrator</div>
        </Card.Body>
      </Card>
    </div>
  );
}

export default AIProvidersTab;
