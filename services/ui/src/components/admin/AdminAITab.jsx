import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  ProgressBar,
  Row,
  Spinner,
  Table,
} from 'react-bootstrap';
import { useNotification } from '../NotificationProvider';
import adminSystemApi from '../../api/admin/systemApi';

function StatCard({ label, value, variant = 'primary', icon }) {
  return (
    <Card className="text-center h-100">
      <Card.Body className="py-3">
        {icon && <div className="mb-1 fs-4 text-secondary"><i className={`bi ${icon}`} /></div>}
        <div className={`fs-3 fw-bold text-${variant}`}>{value ?? '—'}</div>
        <div className="text-muted small">{label}</div>
      </Card.Body>
    </Card>
  );
}

function AdminAITab() {
  const { showSuccess, showError } = useNotification();

  // Stats
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // LLM config
  const [llmConfig, setLlmConfig] = useState(null);
  const [llmLoading, setLlmLoading] = useState(false);
  const [editModel, setEditModel] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [llmSaving, setLlmSaving] = useState(false);
  const [llmDirty, setLlmDirty] = useState(false);

  // Model pull/download
  const [pulling, setPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState(null); // { status, completed, total }
  const [pullModel, setPullModel] = useState('');

  // Reindex
  const [reindexStatus, setReindexStatus] = useState(null);
  const [reindexLoading, setReindexLoading] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await adminSystemApi.getSiteStats();
      setStats(data);
    } catch (err) {
      showError(`Failed to load stats: ${err.message}`);
    } finally {
      setStatsLoading(false);
    }
  }, [showError]);

  const loadLLMConfig = useCallback(async () => {
    setLlmLoading(true);
    try {
      const data = await adminSystemApi.getLLMConfig();
      setLlmConfig(data);
      setEditModel(data.model);
      setEditUrl(data.url);
      setLlmDirty(false);
    } catch (err) {
      showError(`Failed to load LLM config: ${err.message}`);
    } finally {
      setLlmLoading(false);
    }
  }, [showError]);

  const loadReindexStatus = useCallback(async () => {
    setReindexLoading(true);
    try {
      const data = await adminSystemApi.getReindexStatus();
      setReindexStatus(data);
    } catch (err) {
      showError(`Failed to load reindex status: ${err.message}`);
    } finally {
      setReindexLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadStats();
    loadLLMConfig();
    loadReindexStatus();
  }, [loadStats, loadLLMConfig, loadReindexStatus]);

  // ── LLM config actions ───────────────────────────────────────────────────

  const handlePullModel = async (modelTag) => {
    setPulling(true);
    setPullProgress({ status: 'starting…', completed: 0, total: 0 });
    setPullModel(modelTag);
    try {
      await adminSystemApi.pullModel(modelTag, (data) => {
        setPullProgress({
          status: data.status || '',
          completed: data.completed || 0,
          total: data.total || 0,
        });
      });
      showSuccess(`Model "${modelTag}" downloaded successfully.`);
      await loadLLMConfig(); // refresh available_models list
    } catch (err) {
      showError(`Failed to pull model "${modelTag}": ${err.message}`);
    } finally {
      setPulling(false);
      setPullProgress(null);
      setPullModel('');
    }
  };

  const handleSaveLLM = async () => {
    setLlmSaving(true);
    try {
      // If the selected model is not already downloaded, pull it first
      const isDownloaded = llmConfig?.available_models?.includes(editModel);
      if (!isDownloaded && editModel) {
        setPulling(true);
        setPullProgress({ status: 'starting…', completed: 0, total: 0 });
        setPullModel(editModel);
        try {
          await adminSystemApi.pullModel(editModel, (data) => {
            setPullProgress({
              status: data.status || '',
              completed: data.completed || 0,
              total: data.total || 0,
            });
          });
        } finally {
          setPulling(false);
          setPullProgress(null);
          setPullModel('');
        }
      }
      const data = await adminSystemApi.updateLLMConfig({ model: editModel, url: editUrl });
      setLlmConfig(data);
      setLlmDirty(false);
      showSuccess(`LLM switched to "${editModel}". New settings apply immediately.`);
      loadStats();
    } catch (err) {
      showError(`Failed to save LLM config: ${err.message}`);
    } finally {
      setLlmSaving(false);
    }
  };

  const handleResetLLM = async () => {
    setLlmSaving(true);
    try {
      const data = await adminSystemApi.resetLLMConfig();
      setEditModel(data.model);
      setEditUrl(data.url);
      setLlmDirty(false);
      await loadLLMConfig();
      showSuccess('LLM config reset to environment defaults.');
    } catch (err) {
      showError(`Failed to reset LLM config: ${err.message}`);
    } finally {
      setLlmSaving(false);
    }
  };

  // ── Reindex actions ──────────────────────────────────────────────────────

  const handleReindex = async (userId = null) => {
    setReindexing(true);
    try {
      const result = await adminSystemApi.reindex(userId);
      const who = userId ? `user ${userId}` : 'all users';
      showSuccess(
        `Reindex complete for ${who}: ${result.indexed} indexed, ${result.skipped} skipped, ${result.failed} failed.`
      );
      await Promise.all([loadStats(), loadReindexStatus()]);
    } catch (err) {
      showError(`Reindex failed: ${err.message}`);
    } finally {
      setReindexing(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="admin-ai-tab">

      {/* ── Statistics ───────────────────────────────────────────────────── */}
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h5 className="mb-0"><i className="bi bi-bar-chart-line me-2" />Site Statistics</h5>
        <Button size="sm" variant="outline-secondary" onClick={loadStats} disabled={statsLoading}>
          {statsLoading ? <Spinner size="sm" animation="border" /> : <i className="bi bi-arrow-clockwise" />}
        </Button>
      </div>

      {stats && (
        <Row className="g-3 mb-4">
          <Col xs={6} md={4} xl={2}>
            <StatCard label="Total Users" value={stats.total_users} icon="bi-people" />
          </Col>
          <Col xs={6} md={4} xl={2}>
            <StatCard label="Active Users" value={stats.active_users} variant="success" icon="bi-person-check" />
          </Col>
          <Col xs={6} md={4} xl={2}>
            <StatCard label="Documents" value={stats.total_documents} icon="bi-file-text" />
          </Col>
          <Col xs={6} md={4} xl={2}>
            <StatCard label="Embeddings" value={stats.total_embeddings} icon="bi-cpu" />
          </Col>
          <Col xs={6} md={4} xl={2}>
            <StatCard
              label="w/ Summary"
              value={stats.embeddings_with_summary}
              variant={stats.embeddings_with_summary === stats.total_embeddings ? 'success' : 'warning'}
              icon="bi-card-text"
            />
          </Col>
          <Col xs={6} md={4} xl={2}>
            <StatCard
              label="Missing Index"
              value={stats.embeddings_missing}
              variant={stats.embeddings_missing === 0 ? 'success' : 'danger'}
              icon="bi-exclamation-triangle"
            />
          </Col>
        </Row>
      )}

      <hr />

      {/* ── LLM Configuration ────────────────────────────────────────────── */}
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h5 className="mb-0"><i className="bi bi-robot me-2" />LLM Configuration</h5>
        {llmConfig && (
          <Badge bg={llmConfig.source === 'db' ? 'warning' : 'secondary'}>
            {llmConfig.source === 'db' ? 'DB override active' : 'Using env defaults'}
          </Badge>
        )}
      </div>

      {llmLoading ? (
        <div className="text-center py-3"><Spinner animation="border" size="sm" /></div>
      ) : llmConfig ? (
        <>
          {/* Active model + URL controls */}
          <Card className="mb-3">
            <Card.Body>
              <Row className="g-3">
                <Col md={5}>
                  <Form.Group>
                    <Form.Label className="small fw-semibold">Active Model</Form.Label>
                    <Form.Select
                      size="sm"
                      value={editModel}
                      onChange={(e) => { setEditModel(e.target.value); setLlmDirty(true); }}
                      disabled={pulling || llmSaving}
                    >
                      {/* Currently downloaded models */}
                      {llmConfig.available_models.length > 0 && (
                        <optgroup label="Downloaded (ready to use)">
                          {llmConfig.available_models.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </optgroup>
                      )}
                      {/* Recommended models not yet downloaded */}
                      {(() => {
                        const notDownloaded = (llmConfig.recommended_models || []).filter(
                          (r) => !llmConfig.available_models.includes(r.model)
                        );
                        if (notDownloaded.length === 0) return null;
                        return (
                          <optgroup label="Recommended (will download on save)">
                            {notDownloaded.map((r) => (
                              <option key={r.model} value={r.model}>
                                {r.name} — {r.size} (not downloaded)
                              </option>
                            ))}
                          </optgroup>
                        );
                      })()}
                      {/* If current model is neither downloaded nor recommended */}
                      {!llmConfig.available_models.includes(editModel) &&
                       !(llmConfig.recommended_models || []).some((r) => r.model === editModel) && (
                        <option value={editModel}>{editModel} (custom)</option>
                      )}
                    </Form.Select>
                    <Form.Text className="text-muted">
                      {llmConfig.available_models.length === 0
                        ? 'Ollama unreachable — models listed from curated catalog'
                        : `${llmConfig.available_models.length} model(s) downloaded`}
                    </Form.Text>
                  </Form.Group>
                </Col>
                <Col md={5}>
                  <Form.Group>
                    <Form.Label className="small fw-semibold">Ollama URL</Form.Label>
                    <Form.Control
                      size="sm"
                      value={editUrl}
                      onChange={(e) => { setEditUrl(e.target.value); setLlmDirty(true); }}
                      placeholder="http://ollama:11434"
                      disabled={pulling || llmSaving}
                    />
                  </Form.Group>
                </Col>
                <Col md={2} className="d-flex align-items-end gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={handleSaveLLM}
                    disabled={llmSaving || pulling || !llmDirty}
                  >
                    {(llmSaving || pulling) ? <Spinner size="sm" animation="border" /> : 'Save'}
                  </Button>
                  {llmConfig.source === 'db' && (
                    <Button size="sm" variant="outline-secondary" onClick={handleResetLLM} disabled={llmSaving || pulling}>
                      Reset
                    </Button>
                  )}
                </Col>
              </Row>
              {llmDirty && !pulling && (
                <Alert variant="info" className="mt-2 mb-0 py-1 small">
                  {!llmConfig.available_models.includes(editModel)
                    ? <>Model &quot;{editModel}&quot; is not downloaded yet — saving will download it first (this may take a few minutes).</>
                    : <>Unsaved changes — save to apply across all users immediately.</>
                  }
                </Alert>
              )}

              {/* Pull progress bar */}
              {pulling && pullProgress && (
                <div className="mt-3">
                  <div className="d-flex justify-content-between small text-muted mb-1">
                    <span>Downloading &quot;{pullModel}&quot;…</span>
                    <span>{pullProgress.status}</span>
                  </div>
                  <ProgressBar
                    now={pullProgress.total > 0 ? (pullProgress.completed / pullProgress.total) * 100 : 100}
                    animated
                    striped
                    variant="info"
                    label={pullProgress.total > 0
                      ? `${Math.round((pullProgress.completed / pullProgress.total) * 100)}%`
                      : ''}
                  />
                  {pullProgress.total > 0 && (
                    <div className="text-muted small mt-1">
                      {(pullProgress.completed / 1e9).toFixed(2)} / {(pullProgress.total / 1e9).toFixed(2)} GB
                    </div>
                  )}
                </div>
              )}
            </Card.Body>
          </Card>

          {/* Recommended models catalog */}
          {(llmConfig.recommended_models || []).length > 0 && (
            <Card className="mb-4">
              <Card.Header className="py-2">
                <span className="small fw-semibold"><i className="bi bi-stars me-1" />Recommended CPU-Friendly Models</span>
              </Card.Header>
              <Card.Body className="p-0">
                <Table size="sm" hover responsive className="mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Model</th>
                      <th>Size</th>
                      <th>Description</th>
                      <th className="text-center">Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {llmConfig.recommended_models.map((rec) => {
                      const isDownloaded = llmConfig.available_models.includes(rec.model);
                      const isActive = llmConfig.model === rec.model;
                      const isPulling = pulling && pullModel === rec.model;
                      return (
                        <tr key={rec.model} className={isActive ? 'table-success' : ''}>
                          <td className="fw-semibold">{rec.name}</td>
                          <td className="text-nowrap">{rec.size}</td>
                          <td className="text-muted small">{rec.description}</td>
                          <td className="text-center">
                            {isActive ? (
                              <Badge bg="success">Active</Badge>
                            ) : isDownloaded ? (
                              <Badge bg="secondary">Downloaded</Badge>
                            ) : isPulling ? (
                              <Spinner size="sm" animation="border" />
                            ) : (
                              <Badge bg="outline-secondary" className="text-muted border">Not downloaded</Badge>
                            )}
                          </td>
                          <td className="text-end text-nowrap">
                            {!isDownloaded && !isPulling && (
                              <Button
                                size="sm"
                                variant="outline-primary"
                                onClick={() => handlePullModel(rec.model)}
                                disabled={pulling || llmSaving}
                                title={`Download ${rec.name}`}
                                className="me-1"
                              >
                                <i className="bi bi-download" />
                              </Button>
                            )}
                            {isDownloaded && !isActive && (
                              <Button
                                size="sm"
                                variant="outline-success"
                                onClick={() => { setEditModel(rec.model); setLlmDirty(true); }}
                                disabled={pulling || llmSaving}
                                title={`Switch to ${rec.name}`}
                              >
                                <i className="bi bi-check2-circle me-1" />Use
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          )}
        </>
      ) : null}

      <hr />

      {/* ── Reindex ──────────────────────────────────────────────────────── */}
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h5 className="mb-0"><i className="bi bi-arrow-repeat me-2" />Embedding Reindex</h5>
        <Button size="sm" variant="outline-secondary" onClick={loadReindexStatus} disabled={reindexLoading}>
          {reindexLoading ? <Spinner size="sm" animation="border" /> : <i className="bi bi-arrow-clockwise" />}
        </Button>
      </div>

      <Card className="mb-4">
        <Card.Body>
          <Row className="g-2 align-items-end mb-3">
            <Col md={4}>
              <Form.Group>
                <Form.Label className="small fw-semibold">Reindex scope</Form.Label>
                <Form.Select
                  size="sm"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                >
                  <option value="">All users (site-wide)</option>
                  {reindexStatus?.map((row) => (
                    <option key={row.user_id} value={row.user_id}>
                      {row.email} ({row.documents} docs)
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md="auto">
              <Button
                size="sm"
                variant="warning"
                onClick={() => handleReindex(selectedUserId ? Number(selectedUserId) : null)}
                disabled={reindexing}
              >
                {reindexing ? (
                  <><Spinner size="sm" animation="border" className="me-1" />Reindexing…</>
                ) : (
                  <><i className="bi bi-arrow-repeat me-1" />
                    {selectedUserId ? 'Reindex User' : 'Reindex All'}
                  </>
                )}
              </Button>
            </Col>
          </Row>

          {reindexStatus && reindexStatus.length > 0 && (
            <Table size="sm" hover responsive className="mb-0">
              <thead className="table-light">
                <tr>
                  <th>User</th>
                  <th className="text-end">Docs</th>
                  <th className="text-end">Embedded</th>
                  <th className="text-end">w/ Summary</th>
                  <th className="text-end">Coverage</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {reindexStatus.map((row) => (
                  <tr key={row.user_id}>
                    <td className="text-truncate" style={{ maxWidth: 200 }}>{row.email}</td>
                    <td className="text-end">{row.documents}</td>
                    <td className="text-end">{row.embeddings}</td>
                    <td className="text-end">{row.summaries}</td>
                    <td className="text-end">
                      <Badge bg={row.coverage_pct >= 100 ? 'success' : row.coverage_pct >= 50 ? 'warning' : 'danger'}>
                        {row.coverage_pct}%
                      </Badge>
                    </td>
                    <td className="text-end">
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        onClick={() => handleReindex(row.user_id)}
                        disabled={reindexing}
                        title={`Reindex ${row.email}`}
                      >
                        <i className="bi bi-arrow-repeat" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}

export default AdminAITab;
