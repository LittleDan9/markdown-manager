import React from 'react';
import { Card, Badge, Button, Alert, Spinner, Row, Col } from 'react-bootstrap';
import { useIconStatistics, useIconCache } from '../../../hooks/icons';

export default function IconStatsTab({ iconPacks, onReloadData }) {
  const {
    systemStats,
    popularIcons,
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
    <div className="icon-stats-tab overflow-hidden">
      {/* System Overview & Cache Management - Integrated Layout */}
      <Row className="g-2 mb-3">
        {/* System Health Summary */}
        <Col md={6} lg={4}>
          <Card className="h-100 shadow-sm border-0">
            <Card.Header className="bg-primary text-white border-0">
              <h6 className="mb-0 fw-semibold">
                <i className="bi bi-speedometer2 me-2"></i>
                System Health
              </h6>
            </Card.Header>
            <Card.Body className="p-3">
              {statsLoading ? (
                <div className="text-center py-3">
                  <Spinner animation="border" variant="primary" size="sm" />
                  <p className="mt-2 mb-0 small text-muted">Loading...</p>
                </div>
              ) : systemStats ? (
                <Row className="g-1">
                  <Col xs={6}>
                    <div className="text-center p-2 bg-primary bg-opacity-10 rounded">
                      <div className="h5 fw-bold text-primary mb-1">
                        {systemStats.overview?.total_packs || iconPacks.length}
                      </div>
                      <div className="text-muted small">Packs</div>
                    </div>
                  </Col>
                  <Col xs={6}>
                    <div className="text-center p-2 bg-success bg-opacity-10 rounded">
                      <div className="h5 fw-bold text-success mb-1">
                        {systemStats.overview?.total_icons || iconPacks.reduce((sum, pack) => sum + pack.icon_count, 0)}
                      </div>
                      <div className="text-muted small">Icons</div>
                    </div>
                  </Col>
                  <Col xs={6}>
                    <div className="text-center p-2 bg-info bg-opacity-10 rounded">
                      <div className="h5 fw-bold text-info mb-1">
                        {systemStats.document_usage?.documents_analyzed || 0}
                      </div>
                      <div className="text-muted small">Docs</div>
                    </div>
                  </Col>
                  <Col xs={6}>
                    <div className="text-center p-2 bg-warning bg-opacity-10 rounded">
                      <div className="h5 fw-bold text-warning mb-1">
                        {systemStats.document_usage?.mermaid_diagrams || 0}
                      </div>
                      <div className="text-muted small">Diagrams</div>
                    </div>
                  </Col>
                </Row>
              ) : (
                <div className="text-muted text-center py-3 small">
                  <i className="bi bi-exclamation-triangle opacity-50"></i>
                  <p className="mb-0 mt-1">Failed to load stats</p>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* Cache Performance */}
        <Col md={6} lg={4}>
          <Card className="h-100 shadow-sm border-0">
            <Card.Header className="bg-info text-white border-0">
              <h6 className="mb-0 fw-semibold">
                <i className="bi bi-hdd-stack me-2"></i>
                Cache Performance
              </h6>
            </Card.Header>
            <Card.Body className="p-3">
              {cacheStats ? (
                <Row className="g-1">
                  <Col xs={6}>
                    <div className="text-center p-2 bg-primary bg-opacity-10 rounded">
                      <div className="h5 fw-bold text-primary mb-1">
                        {cacheStats.cache_performance?.metadata?.size || 0}
                      </div>
                      <div className="text-muted small">Items</div>
                    </div>
                  </Col>
                  <Col xs={6}>
                    <div className="text-center p-2 bg-success bg-opacity-10 rounded">
                      <div className="h5 fw-bold text-success mb-1">
                        {((cacheStats.cache_performance?.metadata?.hit_ratio || 0) * 100).toFixed(0)}%
                      </div>
                      <div className="text-muted small">Hit Rate</div>
                    </div>
                  </Col>
                  <Col xs={12}>
                    <div className="text-center p-2 bg-info bg-opacity-10 rounded">
                      <div className="h6 fw-bold text-info mb-1">
                        {(cacheStats.cache_performance?.memory_estimate_mb || 0).toFixed(1)}MB
                      </div>
                      <div className="text-muted small">Memory Usage</div>
                    </div>
                  </Col>
                </Row>
              ) : (
                <div className="text-center py-3">
                  <Spinner animation="border" size="sm" />
                  <span className="ms-2 small">Loading cache...</span>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* Quick Actions */}
        <Col md={12} lg={4}>
          <Card className="h-100 shadow-sm border-0">
            <Card.Header className="bg-secondary text-white border-0">
              <h6 className="mb-0 fw-semibold">
                <i className="bi bi-lightning-charge me-2"></i>
                Quick Actions
              </h6>
            </Card.Header>
            <Card.Body className="p-3">
              <div className="d-grid gap-2">
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={handleRefreshAll}
                  disabled={statsLoading || cacheLoading}
                  className="d-flex align-items-center justify-content-center"
                >
                  {(statsLoading || cacheLoading) ? (
                    <Spinner animation="border" size="sm" />
                  ) : (
                    <>
                      <i className="bi bi-arrow-clockwise me-2"></i>
                      Refresh All
                    </>
                  )}
                </Button>
                <Button
                  variant="outline-success"
                  size="sm"
                  onClick={warmCache}
                  disabled={cacheLoading}
                  className="d-flex align-items-center justify-content-center"
                >
                  {cacheLoading ? (
                    <Spinner animation="border" size="sm" />
                  ) : (
                    <>
                      <i className="bi bi-fire me-2"></i>
                      Warm Cache
                    </>
                  )}
                </Button>
                <Button
                  variant="outline-warning"
                  size="sm"
                  onClick={clearCache}
                  disabled={cacheLoading}
                  className="d-flex align-items-center justify-content-center"
                >
                  {cacheLoading ? (
                    <Spinner animation="border" size="sm" />
                  ) : (
                    <>
                      <i className="bi bi-trash3 me-2"></i>
                      Clear Cache
                    </>
                  )}
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Cache Operations Details */}
      <Row className="g-2 mb-3">
        <Col lg={8}>
          <Card className="shadow-sm border-0">
            <Card.Header className="bg-info text-white border-0">
              <h6 className="mb-0 fw-semibold">
                <i className="bi bi-speedometer me-2"></i>
                Cache Performance Details
              </h6>
            </Card.Header>
            <Card.Body className="p-3">
              {cacheAnalysis && cacheAnalysis.recommendations && cacheAnalysis.recommendations.length > 0 ? (
                <div className="recommendations">
                  <div className="small fw-medium text-muted mb-2">Performance Recommendations:</div>
                  {cacheAnalysis.recommendations.map((rec, index) => (
                    <Alert key={index} variant="info" className="py-2 small mb-2">
                      <i className="bi bi-lightbulb me-1"></i>
                      <strong>{rec.type}:</strong> {rec.suggestion}
                      {rec.current_ratio && (
                        <div className="mt-1 text-muted">
                          Current: {rec.current_ratio}
                        </div>
                      )}

                      {/* Detailed explanation for cache recommendations */}
                      {rec.type === 'svg_cache' && (
                        <div className="mt-2 p-2 bg-body-secondary rounded">
                          <small className="text-body-secondary">
                            <strong>What this means:</strong><br/>
                            • SVG Cache Size: Currently 500 entries, may need increase<br/>
                            • TTL Settings: SVG content expires after 1 hour<br/>
                            • Impact: Low hit ratio = more file system reads = slower performance<br/>
                            <strong>Next Steps:</strong><br/>
                            • Monitor usage patterns for 1-2 weeks<br/>
                            • Consider server configuration adjustments<br/>
                            • Use "Warm Cache" regularly for popular icons
                          </small>
                        </div>
                      )}

                      {rec.type === 'metadata_cache' && (
                        <div className="mt-2 p-2 bg-body-secondary rounded">
                          <small className="text-body-secondary">
                            <strong>What this means:</strong><br/>
                            • Metadata Cache Size: Currently 1000 entries<br/>
                            • Impact: Icon info requests hitting database instead of cache<br/>
                            <strong>Immediate Actions:</strong><br/>
                            • Use "Warm Cache" to preload popular icons<br/>
                            • Clean up expired entries regularly
                          </small>
                        </div>
                      )}
                    </Alert>
                  ))}
                </div>
              ) : (
                <div className="text-center py-3">
                  <i className="bi bi-check-circle text-success display-6 mb-2"></i>
                  <h6>Cache Performance Optimal</h6>
                  <p className="text-muted mb-0 small">No performance recommendations at this time.</p>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col lg={4}>
          <Card className="shadow-sm border-0">
            <Card.Header className="bg-secondary text-white border-0">
              <h6 className="mb-0 fw-semibold">
                <i className="bi bi-tools me-2"></i>
                Cache Operations
              </h6>
            </Card.Header>
            <Card.Body className="p-3">
              <div className="d-grid gap-2">
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={cleanupExpired}
                  disabled={cacheLoading}
                  className="d-flex align-items-center justify-content-center"
                >
                  {cacheLoading ? (
                    <Spinner animation="border" size="sm" />
                  ) : (
                    <>
                      <i className="bi bi-broom me-2"></i>
                      Cleanup Expired
                    </>
                  )}
                </Button>

                <hr className="my-2" />

                {/* Current Cache Configuration Display */}
                <div className="small text-muted mb-2">
                  <strong>Current Configuration:</strong>
                  {cacheStats && (
                    <div className="mt-1">
                      <div>Metadata Cache: {cacheStats.cache_performance?.metadata?.max_size || 1000} entries</div>
                      <div>SVG Cache: {cacheStats.cache_performance?.svg?.max_size || 500} entries</div>
                      <div>SVG TTL: {Math.round((cacheStats.cache_performance?.svg?.ttl_seconds || 3600) / 60)} minutes</div>
                    </div>
                  )}
                </div>

                <hr className="my-2" />

                <div className="small text-muted">
                  <strong>Cache Health Tips:</strong>
                  <ul className="mt-2 ps-3 small mb-0">
                    <li className="text-break">Target 70%+ hit ratio for good performance</li>
                    <li className="text-break">Warm cache during low-traffic periods</li>
                    <li className="text-break">Clear cache if memory usage is high</li>
                  </ul>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Optimization Tips */}
      <Row className="mb-3">
        <Col>
          <Alert variant="light" className="border-primary bg-primary bg-opacity-5 mb-0">
            <div className="d-flex align-items-start">
              <i className="bi bi-lightbulb text-primary me-2 flex-shrink-0 mt-1"></i>
              <div className="flex-grow-1 min-width-0">
                <h6 className="alert-heading small fw-semibold mb-2">
                  <i className="bi bi-rocket me-1"></i>
                  Optimization Tips
                </h6>
                <div className="small">
                  <Row className="g-1">
                    <Col md={4} className="mb-2">
                      <div className="text-break">
                        <strong>Performance:</strong> Monitor cache hit ratios regularly - target &gt;70% for optimal performance
                      </div>
                    </Col>
                    <Col md={4} className="mb-2">
                      <div className="text-break">
                        <strong>Memory:</strong> Adjust cache sizes based on usage patterns and available memory
                      </div>
                    </Col>
                    <Col md={4} className="mb-2">
                      <div className="text-break">
                        <strong>Maintenance:</strong> Clear cache during low-traffic periods and warm with popular icons
                      </div>
                    </Col>
                  </Row>
                </div>
              </div>
            </div>
          </Alert>
        </Col>
      </Row>
    </div>
  );
}