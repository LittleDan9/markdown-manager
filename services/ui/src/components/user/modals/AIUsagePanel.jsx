import React, { useState, useEffect } from 'react';
import { Alert, Card, Col, Form, Row, Spinner, Table, Badge } from 'react-bootstrap';
import aiUsageApi from '../../../api/aiUsageApi';

const SOURCE_LABELS = {
  'team-manager': 'Team Manager',
  'markdown-manager': 'Markdown Manager',
};

function formatNumber(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/**
 * AI Usage dashboard panel — shows aggregated usage across local and remote apps.
 */
export default function AIUsagePanel() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    aiUsageApi.getUsageStats(days)
      .then(data => { setStats(data); setError(null); })
      .catch(() => { setStats(null); setError('Failed to load usage stats'); })
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) {
    return (
      <div className="text-center py-3 mt-3">
        <Spinner animation="border" size="sm" className="me-2" />
        Loading usage stats...
      </div>
    );
  }

  if (!stats || !stats.stats?.length) {
    return (
      <div className="mt-3">
        <h6><i className="bi bi-bar-chart me-1" />AI Usage</h6>
        <p className="text-muted small">
          No usage data yet. Start chatting with AI to see statistics here.
        </p>
      </div>
    );
  }

  const totals = stats.stats.reduce((acc, s) => ({
    requests: acc.requests + s.request_count,
    input: acc.input + s.input_tokens,
    output: acc.output + s.output_tokens,
    errors: acc.errors + s.error_count,
  }), { requests: 0, input: 0, output: 0, errors: 0 });

  return (
    <div className="mt-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="mb-0"><i className="bi bi-bar-chart me-1" />AI Usage</h6>
        <Form.Select size="sm" style={{ width: 'auto' }} value={days} onChange={e => setDays(Number(e.target.value))}>
          <option value={7}>7 days</option>
          <option value={14}>14 days</option>
          <option value={30}>30 days</option>
          <option value={90}>90 days</option>
        </Form.Select>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {/* Summary cards */}
      <Row className="g-2 mb-3">
        <Col xs={6} md={3}>
          <Card className="text-center">
            <Card.Body className="py-2">
              <div className="fs-4 fw-bold">{formatNumber(totals.requests)}</div>
              <small className="text-muted">Requests</small>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} md={3}>
          <Card className="text-center">
            <Card.Body className="py-2">
              <div className="fs-4 fw-bold">{formatNumber(totals.output)}</div>
              <small className="text-muted">Output Tokens</small>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} md={3}>
          <Card className="text-center">
            <Card.Body className="py-2">
              <div className="fs-4 fw-bold">{formatNumber(totals.input)}</div>
              <small className="text-muted">Input Tokens</small>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} md={3}>
          <Card className="text-center">
            <Card.Body className="py-2">
              <div className={`fs-4 fw-bold ${totals.errors > 0 ? 'text-danger' : ''}`}>
                {totals.errors}
              </div>
              <small className="text-muted">Errors</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Table */}
      <Table size="sm" hover responsive className="small">
        <thead>
          <tr>
            <th>Source</th>
            <th>Provider</th>
            <th>Model</th>
            <th className="text-end">Requests</th>
            <th className="text-end">Tokens</th>
            <th className="text-end">Errors</th>
          </tr>
        </thead>
        <tbody>
          {stats.stats.map((s, idx) => (
            <tr key={idx}>
              <td><Badge bg="info" pill>{SOURCE_LABELS[s.source] || s.source}</Badge></td>
              <td>{s.provider}</td>
              <td className="text-truncate" style={{ maxWidth: 150 }}>{s.model}</td>
              <td className="text-end">{formatNumber(s.request_count)}</td>
              <td className="text-end">{formatNumber(s.output_tokens)}</td>
              <td className="text-end">{s.error_count || '—'}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
