import React, { useState, useEffect, useCallback } from 'react';
import { Card, Badge, Button, Alert, Spinner, Row, Col, Table, Nav } from 'react-bootstrap';
import { adminIconsApi } from '../../../api/admin';
import { useNotification } from '../../NotificationProvider';

export default function DocumentUsageInsights({ documentId, documentName, onClose }) {
  const [analysis, setAnalysis] = useState(null);
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [error, setError] = useState(null);

  const { _showSuccess, showError } = useNotification();

  const loadDocumentAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const analysisData = await adminIconsApi.analyzeDocumentRealtime(documentId);
      setAnalysis(analysisData);
    } catch (err) {
      console.error('Failed to load document analysis:', err);
      setError(`Failed to analyze document: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    if (documentId) {
      loadDocumentAnalysis();
    }
  }, [documentId, loadDocumentAnalysis]);

  const loadTrends = async () => {
    if (trends) return; // Already loaded

    setLoading(true);
    try {
      const trendsData = await adminIconsApi.getUsageTrendsRealtime(30);
      setTrends(trendsData);
    } catch (err) {
      console.error('Failed to load trends:', err);
      showError(`Failed to load trends: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'trends') {
      loadTrends();
    }
  };

  if (loading && !analysis) {
    return (
      <div className="document-usage-insights loading">
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-3 mb-0">Analyzing document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="document-usage-insights error">
        <Alert variant="danger">
          <Alert.Heading>Analysis Failed</Alert.Heading>
          <p>{error}</p>
          <div className="d-flex justify-content-end">
            <Button variant="outline-danger" onClick={loadDocumentAnalysis} className="me-2">
              Retry
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  if (!analysis) {
    return null;
  }

  return (
    <div className="document-usage-insights h-100 d-flex flex-column">
      {/* Header */}
      <div className="insights-header p-3 border-bottom bg-light">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h5 className="mb-1">
              <i className="bi bi-graph-up me-2"></i>
              Document Usage Insights
            </h5>
            <p className="text-muted mb-0 small">
              <i className="bi bi-file-text me-1"></i>
              {documentName || `Document ${documentId}`}
            </p>
          </div>
          <Button variant="outline-secondary" size="sm" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <Nav variant="tabs" className="flex-shrink-0">
        <Nav.Item>
          <Nav.Link
            active={activeTab === 'overview'}
            onClick={() => handleTabChange('overview')}
          >
            <i className="bi bi-info-circle me-1"></i>
            Overview
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link
            active={activeTab === 'patterns'}
            onClick={() => handleTabChange('patterns')}
          >
            <i className="bi bi-diagram-3 me-1"></i>
            Usage Patterns
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link
            active={activeTab === 'recommendations'}
            onClick={() => handleTabChange('recommendations')}
          >
            <i className="bi bi-lightbulb me-1"></i>
            Recommendations
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link
            active={activeTab === 'trends'}
            onClick={() => handleTabChange('trends')}
          >
            <i className="bi bi-graph-up-arrow me-1"></i>
            Trends
          </Nav.Link>
        </Nav.Item>
      </Nav>

      {/* Tab Content */}
      <div className="tab-content flex-grow-1 overflow-auto p-3">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="overview-tab">
            <Row className="g-3 mb-4">
              <Col md={3}>
                <Card className="h-100 text-center">
                  <Card.Body>
                    <div className="h4 text-primary mb-1">
                      {analysis.icon_usage?.total_icon_references || 0}
                    </div>
                    <div className="small text-muted">Icon References</div>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card className="h-100 text-center">
                  <Card.Body>
                    <div className="h4 text-success mb-1">
                      {analysis.icon_usage?.unique_packs_used || 0}
                    </div>
                    <div className="small text-muted">Icon Packs</div>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card className="h-100 text-center">
                  <Card.Body>
                    <div className="h4 text-info mb-1">
                      {analysis.mermaid_analysis?.diagrams_count || 0}
                    </div>
                    <div className="small text-muted">Mermaid Diagrams</div>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card className="h-100 text-center">
                  <Card.Body>
                    <div className="h4 text-warning mb-1">
                      {analysis.maintenance_metrics?.complexity_score?.toFixed(1) || 0}
                    </div>
                    <div className="small text-muted">Complexity Score</div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* Icon Usage Details */}
            {analysis.icon_usage?.packs_used && Object.keys(analysis.icon_usage.packs_used).length > 0 && (
              <Card className="mb-3">
                <Card.Header>
                  <h6 className="mb-0">Icon Packs Used</h6>
                </Card.Header>
                <Card.Body>
                  <Table striped bordered hover responsive>
                    <thead>
                      <tr>
                        <th>Pack</th>
                        <th>Icons Used</th>
                        <th>Total References</th>
                        <th>Contexts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(analysis.icon_usage.packs_used).map(([packName, packData]) => (
                        <tr key={packName}>
                          <td>
                            <strong>{packName}</strong>
                            {analysis.pack_metadata?.[packName] && (
                              <div className="small text-muted">
                                {analysis.pack_metadata[packName].display_name}
                              </div>
                            )}
                          </td>
                          <td>
                            <div className="d-flex flex-wrap gap-1">
                              {Object.keys(packData.icons).map(iconName => (
                                <Badge key={iconName} bg="secondary" className="small">
                                  {iconName}
                                </Badge>
                              ))}
                            </div>
                          </td>
                          <td>
                            <Badge bg="primary">{packData.total_count}</Badge>
                          </td>
                          <td>
                            <div className="d-flex flex-wrap gap-1">
                              {packData.contexts?.map(context => (
                                <Badge key={context} bg="outline-info" className="small">
                                  {context}
                                </Badge>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            )}

            {/* Content Analysis */}
            <Card>
              <Card.Header>
                <h6 className="mb-0">Content Analysis</h6>
              </Card.Header>
              <Card.Body>
                <Row>
                  <Col md={6}>
                    <div className="mb-2">
                      <strong>Document Size:</strong> {analysis.content_analysis?.total_words || 0} words, {analysis.content_analysis?.total_lines || 0} lines
                    </div>
                    <div className="mb-2">
                      <strong>Icon Density:</strong> {analysis.usage_patterns?.icon_density || 0} icons per 100 words
                    </div>
                    <div className="mb-2">
                      <strong>Maintainability:</strong>
                      <Badge bg={
                        analysis.maintenance_metrics?.maintainability === 'high' ? 'success' :
                        analysis.maintenance_metrics?.maintainability === 'medium' ? 'warning' : 'danger'
                      } className="ms-2">
                        {analysis.maintenance_metrics?.maintainability || 'unknown'}
                      </Badge>
                    </div>
                  </Col>
                  <Col md={6}>
                    <div className="mb-2">
                      <strong>Most Used Pack:</strong> {analysis.usage_patterns?.most_used_pack?.name || 'None'}
                    </div>
                    <div className="mb-2">
                      <strong>Most Used Icon:</strong> {analysis.usage_patterns?.most_used_icon?.name || 'None'}
                    </div>
                    <div className="mb-2">
                      <strong>Pack Diversity:</strong> {analysis.usage_patterns?.pack_diversity || 0} different packs
                    </div>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </div>
        )}

        {/* Usage Patterns Tab */}
        {activeTab === 'patterns' && (
          <div className="patterns-tab">
            <Row className="g-3">
              <Col md={6}>
                <Card>
                  <Card.Header>
                    <h6 className="mb-0">Context Breakdown</h6>
                  </Card.Header>
                  <Card.Body>
                    {analysis.icon_usage?.context_breakdown && (
                      <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span>Direct References</span>
                          <Badge bg="primary">{analysis.icon_usage.context_breakdown.direct_references}</Badge>
                        </div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span>Mermaid Diagrams</span>
                          <Badge bg="info">{analysis.icon_usage.context_breakdown.mermaid_diagrams}</Badge>
                        </div>
                        <div className="d-flex justify-content-between align-items-center">
                          <span>Markdown Images</span>
                          <Badge bg="success">{analysis.icon_usage.context_breakdown.markdown_images}</Badge>
                        </div>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </Col>
              <Col md={6}>
                <Card>
                  <Card.Header>
                    <h6 className="mb-0">Maintenance Metrics</h6>
                  </Card.Header>
                  <Card.Body>
                    {analysis.maintenance_metrics && (
                      <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span>Icon to Content Ratio</span>
                          <Badge bg="secondary">{analysis.maintenance_metrics.icon_to_content_ratio}</Badge>
                        </div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span>Pack Consolidation Score</span>
                          <Badge bg="secondary">{analysis.maintenance_metrics.pack_consolidation_score}</Badge>
                        </div>
                        <div className="d-flex justify-content-between align-items-center">
                          <span>Complexity Score</span>
                          <Badge bg={analysis.maintenance_metrics.complexity_score > 7 ? 'danger' :
                                     analysis.maintenance_metrics.complexity_score > 4 ? 'warning' : 'success'}>
                            {analysis.maintenance_metrics.complexity_score?.toFixed(1)}
                          </Badge>
                        </div>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </div>
        )}

        {/* Recommendations Tab */}
        {activeTab === 'recommendations' && (
          <div className="recommendations-tab">
            {analysis.recommendations && analysis.recommendations.length > 0 ? (
              <div className="recommendations-list">
                {analysis.recommendations.map((rec, index) => (
                  <Alert
                    key={index}
                    variant={rec.priority === 'high' ? 'danger' : rec.priority === 'medium' ? 'warning' : 'info'}
                    className="mb-3"
                  >
                    <Alert.Heading className="h6">
                      <i className={`bi bi-${
                        rec.priority === 'high' ? 'exclamation-triangle' :
                        rec.priority === 'medium' ? 'info-circle' : 'lightbulb'
                      } me-2`}></i>
                      {rec.title}
                    </Alert.Heading>
                    <p className="mb-2">{rec.description}</p>
                    <div className="small">
                      <strong>Recommended Action:</strong> {rec.action}
                    </div>
                  </Alert>
                ))}
              </div>
            ) : (
              <Alert variant="success">
                <Alert.Heading className="h6">
                  <i className="bi bi-check-circle me-2"></i>
                  All Good!
                </Alert.Heading>
                <p className="mb-0">No specific recommendations for this document. Your icon usage looks optimal!</p>
              </Alert>
            )}
          </div>
        )}

        {/* Trends Tab */}
        {activeTab === 'trends' && (
          <div className="trends-tab">
            {loading ? (
              <div className="text-center py-5">
                <Spinner animation="border" variant="primary" />
                <p className="mt-3 mb-0">Loading trends...</p>
              </div>
            ) : trends ? (
              <div>
                <Alert variant="info" className="mb-3">
                  <Alert.Heading className="h6">
                    <i className="bi bi-info-circle me-2"></i>
                    Trends Analysis ({trends.analysis_period?.days} days)
                  </Alert.Heading>
                  <p className="mb-2">
                    <strong>Total Documents Analyzed:</strong> {trends.summary?.total_documents_analyzed || 0}
                  </p>
                  <p className="mb-2">
                    <strong>Total Icon References:</strong> {trends.summary?.total_icon_references || 0}
                  </p>
                  <p className="mb-0">
                    <strong>Trend Direction:</strong>
                    <Badge bg={trends.summary?.trend_direction === 'increasing' ? 'success' : 'secondary'} className="ms-2">
                      {trends.summary?.trend_direction || 'stable'}
                    </Badge>
                  </p>
                </Alert>

                {trends.insights && trends.insights.length > 0 && (
                  <Card>
                    <Card.Header>
                      <h6 className="mb-0">Insights</h6>
                    </Card.Header>
                    <Card.Body>
                      {trends.insights.map((insight, index) => (
                        <Alert key={index} variant="light" className="mb-2">
                          <div className="small">
                            <strong>{insight.title}:</strong> {insight.description}
                            {insight.recommendation && (
                              <div className="mt-1 text-muted">
                                <em>{insight.recommendation}</em>
                              </div>
                            )}
                          </div>
                        </Alert>
                      ))}
                    </Card.Body>
                  </Card>
                )}
              </div>
            ) : (
              <Alert variant="warning">
                <Alert.Heading className="h6">No Trends Data</Alert.Heading>
                <p className="mb-0">Unable to load trends data at this time.</p>
              </Alert>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="insights-footer p-3 border-top bg-light">
        <div className="d-flex justify-content-between align-items-center">
          <div className="small text-muted">
            Analysis performed at {new Date(analysis.analysis_timestamp).toLocaleString()}
          </div>
          <div>
            <Button variant="outline-primary" size="sm" onClick={loadDocumentAnalysis} className="me-2">
              <i className="bi bi-arrow-clockwise me-1"></i>
              Refresh
            </Button>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}