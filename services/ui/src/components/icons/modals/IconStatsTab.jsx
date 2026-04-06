import React from 'react';
import { Button, Alert, Spinner, Card, Row, Col } from 'react-bootstrap';
import { useIconStatistics, useIconCache } from '../../../hooks/icons';

function StatCard({ label, value, icon, variant = 'primary' }) {
  return (
    <Card className="icon-stat-card text-center h-100">
      <Card.Body className="py-3">
        {icon && <div className={`mb-1 fs-4 text-${variant}`}><i className={`bi ${icon}`} /></div>}
        <div className={`fs-3 fw-bold text-${variant}`}>{value ?? '—'}</div>
        <div className="text-muted small">{label}</div>
      </Card.Body>
    </Card>
  );
}

export default function IconStatsTab({ iconPacks, onReloadData }) {
  const {
    systemStats,
    _popularIcons,
    loading: statsLoading,
    refreshAll: refreshStats
  } = useIconStatistics();

  const {
    cacheStats,
    cacheAnalysis,
    loading: cacheLoading,
    clearCache,
    warmCache,
    cleanupExpired,
    refreshAll: refreshCache
  } = useIconCache();

  const handleRefreshAll = async () => {
    await Promise.all([
      refreshStats(),
      refreshCache(),
      onReloadData?.()
    ]);
  };

  const totalPacks = systemStats?.overview?.total_packs || iconPacks.length;
  const totalIcons = systemStats?.overview?.total_icons
    || iconPacks.reduce((sum, pack) => sum + pack.icon_count, 0);
  const docsAnalyzed = systemStats?.document_usage?.documents_analyzed || 0;
  const diagrams = systemStats?.document_usage?.mermaid_diagrams || 0;
  const cached = cacheStats?.cache_performance?.metadata?.size || 0;
  const hitRate = ((cacheStats?.cache_performance?.metadata?.hit_ratio || 0) * 100).toFixed(0);
  const memoryMb = (cacheStats?.cache_performance?.memory_estimate_mb || 0).toFixed(1);

  return (
    <div className="icon-stats-tab">
      {/* ── Overview Section ── */}
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h6 className="mb-0 fw-semibold">
          <i className="bi bi-speedometer2 me-2" />
          Overview
        </h6>
        <Button
          size="sm"
          variant="outline-secondary"
          onClick={handleRefreshAll}
          disabled={statsLoading || cacheLoading}
        >
          {(statsLoading || cacheLoading)
            ? <Spinner size="sm" animation="border" />
            : <><i className="bi bi-arrow-clockwise me-1" />Refresh All</>}
        </Button>
      </div>

      {statsLoading ? (
        <div className="text-center py-4">
          <Spinner animation="border" size="sm" />
        </div>
      ) : systemStats ? (
        <Row className="g-3 mb-4">
          <Col xs={6} md={4} xl={2}><StatCard label="Packs" value={totalPacks} icon="bi-collection" /></Col>
          <Col xs={6} md={4} xl={2}><StatCard label="Icons" value={totalIcons} icon="bi-images" variant="success" /></Col>
          <Col xs={6} md={4} xl={2}><StatCard label="Docs Analyzed" value={docsAnalyzed} icon="bi-file-earmark-text" variant="info" /></Col>
          <Col xs={6} md={4} xl={2}><StatCard label="Diagrams" value={diagrams} icon="bi-diagram-3" variant="warning" /></Col>
          <Col xs={6} md={4} xl={2}><StatCard label="Cached" value={cached} icon="bi-hdd" variant="secondary" /></Col>
          <Col xs={6} md={4} xl={2}><StatCard label="Hit Rate" value={`${hitRate}%`} icon="bi-bullseye" variant="secondary" /></Col>
        </Row>
      ) : (
        <Alert variant="warning" className="mb-4">
          <i className="bi bi-exclamation-triangle me-2" />
          Failed to load statistics. Try refreshing.
        </Alert>
      )}

      {/* ── Cache Performance Section ── */}
      <Card className="mb-3">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h6 className="mb-0 fw-semibold">
            <i className="bi bi-speedometer me-2" />
            Cache Performance
          </h6>
          <div className="d-flex gap-2">
            <Button variant="outline-success" size="sm" onClick={warmCache} disabled={cacheLoading}>
              <i className="bi bi-fire me-1" />Warm
            </Button>
            <Button variant="outline-warning" size="sm" onClick={clearCache} disabled={cacheLoading}>
              <i className="bi bi-trash3 me-1" />Clear
            </Button>
            <Button variant="outline-secondary" size="sm" onClick={cleanupExpired} disabled={cacheLoading}>
              <i className="bi bi-broom me-1" />Cleanup
            </Button>
          </div>
        </Card.Header>
        <Card.Body>
          {cacheStats ? (
            <div className="small text-muted">
              <strong>Memory:</strong> {memoryMb} MB
              {' · '}
              <strong>Metadata:</strong> {cacheStats.cache_performance?.metadata?.max_size || 1000} max entries
              {' · '}
              <strong>SVG:</strong> {cacheStats.cache_performance?.svg?.max_size || 500} max entries
              {' · '}
              <strong>TTL:</strong> {Math.round((cacheStats.cache_performance?.svg?.ttl_seconds || 3600) / 60)} min
            </div>
          ) : (
            <div className="text-muted small">Cache stats unavailable.</div>
          )}
        </Card.Body>
      </Card>

      {/* ── Recommendations Section ── */}
      <Card>
        <Card.Header>
          <h6 className="mb-0 fw-semibold">
            <i className="bi bi-lightbulb me-2" />
            Performance Recommendations
          </h6>
        </Card.Header>
        <Card.Body>
          {cacheAnalysis?.recommendations?.length > 0 ? (
            cacheAnalysis.recommendations.map((rec, index) => (
              <Alert key={index} variant="info" className="py-2 small mb-2">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <strong>{rec.type}:</strong> {rec.suggestion}
                    {rec.current_ratio && (
                      <span className="text-muted ms-2">(current: {rec.current_ratio})</span>
                    )}
                  </div>
                  <div className="ms-2 flex-shrink-0">
                    {rec.type === 'svg_cache' && (
                      <Button variant="outline-info" size="sm" onClick={warmCache} disabled={cacheLoading}>
                        <i className="bi bi-fire me-1" />Warm
                      </Button>
                    )}
                    {rec.type === 'metadata_cache' && (
                      <Button variant="outline-info" size="sm" onClick={cleanupExpired} disabled={cacheLoading}>
                        <i className="bi bi-broom me-1" />Cleanup
                      </Button>
                    )}
                  </div>
                </div>
              </Alert>
            ))
          ) : !statsLoading && !cacheLoading ? (
            <div className="text-center py-3 text-muted">
              <i className="bi bi-check-circle text-success fs-4 mb-2 d-block" />
              <strong>Cache Performance Optimal</strong>
              <p className="mb-0 small">No performance recommendations at this time.</p>
            </div>
          ) : null}
        </Card.Body>
      </Card>
    </div>
  );
}