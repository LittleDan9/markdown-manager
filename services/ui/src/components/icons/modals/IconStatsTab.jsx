import React from 'react';
import { Button, Alert, Spinner, Badge } from 'react-bootstrap';
import { useIconStatistics, useIconCache } from '../../../hooks/icons';

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

  return (
    <div className="icon-stats-tab overflow-auto">
      {/* Compact Stat Strip */}
      <div className="d-flex flex-wrap gap-3 align-items-center mb-3 pb-3 border-bottom">
        {statsLoading ? (
          <Spinner animation="border" size="sm" />
        ) : systemStats ? (
          <>
            <div className="d-flex align-items-center gap-2">
              <Badge bg="primary" className="fs-6 fw-semibold px-2 py-1">
                {systemStats.overview?.total_packs || iconPacks.length}
              </Badge>
              <span className="text-muted small">Packs</span>
            </div>
            <div className="d-flex align-items-center gap-2">
              <Badge bg="success" className="fs-6 fw-semibold px-2 py-1">
                {systemStats.overview?.total_icons || iconPacks.reduce((sum, pack) => sum + pack.icon_count, 0)}
              </Badge>
              <span className="text-muted small">Icons</span>
            </div>
            <div className="d-flex align-items-center gap-2">
              <Badge bg="info" className="fs-6 fw-semibold px-2 py-1">
                {systemStats.document_usage?.documents_analyzed || 0}
              </Badge>
              <span className="text-muted small">Docs Analyzed</span>
            </div>
            <div className="d-flex align-items-center gap-2">
              <Badge bg="warning" text="dark" className="fs-6 fw-semibold px-2 py-1">
                {systemStats.document_usage?.mermaid_diagrams || 0}
              </Badge>
              <span className="text-muted small">Diagrams</span>
            </div>
          </>
        ) : (
          <span className="text-muted small">
            <i className="bi bi-exclamation-triangle me-1 opacity-50"></i>
            Failed to load stats
          </span>
        )}

        {/* Cache stats inline */}
        {cacheStats && (
          <>
            <div className="vr d-none d-md-block"></div>
            <div className="d-flex align-items-center gap-2">
              <Badge bg="secondary" className="fs-6 fw-semibold px-2 py-1">
                {cacheStats.cache_performance?.metadata?.size || 0}
              </Badge>
              <span className="text-muted small">Cached</span>
            </div>
            <div className="d-flex align-items-center gap-2">
              <Badge bg="secondary" className="fs-6 fw-semibold px-2 py-1">
                {((cacheStats.cache_performance?.metadata?.hit_ratio || 0) * 100).toFixed(0)}%
              </Badge>
              <span className="text-muted small">Hit Rate</span>
            </div>
            <div className="d-flex align-items-center gap-2">
              <Badge bg="secondary" className="fs-6 fw-semibold px-2 py-1">
                {(cacheStats.cache_performance?.memory_estimate_mb || 0).toFixed(1)}MB
              </Badge>
              <span className="text-muted small">Memory</span>
            </div>
          </>
        )}
      </div>

      {/* Actions Row */}
      <div className="d-flex flex-wrap gap-2 mb-3">
        <Button
          variant="outline-primary"
          size="sm"
          onClick={handleRefreshAll}
          disabled={statsLoading || cacheLoading}
        >
          {(statsLoading || cacheLoading) ? (
            <Spinner animation="border" size="sm" />
          ) : (
            <>
              <i className="bi bi-arrow-clockwise me-1"></i>
              Refresh All
            </>
          )}
        </Button>
        <Button
          variant="outline-success"
          size="sm"
          onClick={warmCache}
          disabled={cacheLoading}
        >
          <i className="bi bi-fire me-1"></i>
          Warm Cache
        </Button>
        <Button
          variant="outline-warning"
          size="sm"
          onClick={clearCache}
          disabled={cacheLoading}
        >
          <i className="bi bi-trash3 me-1"></i>
          Clear Cache
        </Button>
        <Button
          variant="outline-secondary"
          size="sm"
          onClick={cleanupExpired}
          disabled={cacheLoading}
        >
          <i className="bi bi-broom me-1"></i>
          Cleanup Expired
        </Button>
      </div>

      {/* Cache Configuration */}
      {cacheStats && (
        <div className="small text-muted mb-3">
          <strong>Config:</strong>{' '}
          Metadata: {cacheStats.cache_performance?.metadata?.max_size || 1000} entries{' · '}
          SVG: {cacheStats.cache_performance?.svg?.max_size || 500} entries{' · '}
          TTL: {Math.round((cacheStats.cache_performance?.svg?.ttl_seconds || 3600) / 60)} min
        </div>
      )}

      {/* Recommendations */}
      {cacheAnalysis && cacheAnalysis.recommendations && cacheAnalysis.recommendations.length > 0 ? (
        <div>
          <h6 className="fw-semibold mb-2">
            <i className="bi bi-lightbulb me-2"></i>
            Performance Recommendations
          </h6>
          {cacheAnalysis.recommendations.map((rec, index) => (
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
                      <i className="bi bi-fire me-1"></i>Warm
                    </Button>
                  )}
                  {rec.type === 'metadata_cache' && (
                    <Button variant="outline-info" size="sm" onClick={cleanupExpired} disabled={cacheLoading}>
                      <i className="bi bi-broom me-1"></i>Cleanup
                    </Button>
                  )}
                </div>
              </div>
            </Alert>
          ))}
        </div>
      ) : !statsLoading && !cacheLoading && (
        <div className="text-center py-4 text-muted">
          <i className="bi bi-check-circle text-success fs-4 mb-2 d-block"></i>
          <h6>Cache Performance Optimal</h6>
          <p className="mb-0 small">No performance recommendations at this time.</p>
        </div>
      )}
    </div>
  );
}