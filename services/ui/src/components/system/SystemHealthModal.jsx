import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Alert, Badge, ListGroup, Spinner, Button, Collapse, Card } from 'react-bootstrap';
import systemHealthApi from '@/api/systemHealthApi';

const SystemHealthModal = ({ show, onHide }) => {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [expandedConsumers, setExpandedConsumers] = useState(false);

  const fetchHealthData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await systemHealthApi.getHealthStatus();
      setHealthData(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || 'Failed to fetch health data');
      console.error('Health check error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch data when modal opens
  useEffect(() => {
    if (show) {
      fetchHealthData();
    }
  }, [show, fetchHealthData]);

  // Auto-refresh every 30 seconds when modal is open
  useEffect(() => {
    if (!show) return;

    const interval = setInterval(fetchHealthData, 30000);
    return () => clearInterval(interval);
  }, [show, fetchHealthData]);

  const getStatusVariant = (status) => {
    switch (status?.toLowerCase()) {
      case 'healthy':
        return 'success';
      case 'degraded':
        return 'warning';
      case 'unhealthy':
        return 'danger';
      default:
        return 'secondary';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'healthy':
        return 'bi-check-circle-fill';
      case 'degraded':
        return 'bi-exclamation-triangle-fill';
      case 'unhealthy':
        return 'bi-x-circle-fill';
      default:
        return 'bi-question-circle-fill';
    }
  };

  const handleRefresh = () => {
    fetchHealthData();
  };

  return (
    <Modal 
      show={show} 
      onHide={onHide} 
      size="lg" 
      centered
      scrollable
      data-bs-theme={document.documentElement.getAttribute('data-bs-theme')}
      className="system-health-modal"
    >
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="bi bi-activity me-2"></i>
          System Health
        </Modal.Title>
      </Modal.Header>
      
      <Modal.Body style={{ minHeight: '60vh' }}>
        {loading && !healthData && (
          <div className="text-center py-4">
            <Spinner animation="border" role="status" className="me-2" />
            <span>Loading system health...</span>
          </div>
        )}

        {error && (
          <Alert variant="danger">
            <i className="bi bi-exclamation-triangle me-2"></i>
            <strong>Error:</strong> {error}
          </Alert>
        )}

        {healthData && (
          <>
            {/* Overall Status */}
            <div className="mb-4">
              <div className="d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center">
                  <i className={`bi ${getStatusIcon(healthData.status)} text-${getStatusVariant(healthData.status)} me-2 fs-4`}></i>
                  <div>
                    <h5 className="mb-0">
                      Overall Status: 
                      <Badge bg={getStatusVariant(healthData.status)} className="ms-2">
                        {healthData.status?.toUpperCase() || 'UNKNOWN'}
                      </Badge>
                    </h5>
                    <small className="text-muted">
                      Version {healthData.version} • 
                      {lastUpdated && (
                        <span> Last updated: {lastUpdated.toLocaleTimeString()}</span>
                      )}
                    </small>
                  </div>
                </div>
                <Button 
                  variant="outline-secondary" 
                  size="sm" 
                  onClick={handleRefresh}
                  disabled={loading}
                  className="d-flex align-items-center"
                >
                  <i className={`bi bi-arrow-clockwise me-1 ${loading ? 'spinner-border spinner-border-sm' : ''}`}></i>
                  Refresh
                </Button>
              </div>
            </div>

            {/* Service Details */}
            {healthData.services && Object.keys(healthData.services).length > 0 && (
              <div>
                <h6 className="mb-3">Service Details</h6>
                <ListGroup>
                  {Object.entries(healthData.services).map(([serviceName, serviceData]) => (
                    <div key={serviceName}>
                      <ListGroup.Item className="d-flex align-items-center justify-content-between">
                        <div className="d-flex align-items-center flex-grow-1">
                          <i className={`bi ${getStatusIcon(serviceData.status)} text-${getStatusVariant(serviceData.status)} me-2`}></i>
                          <div className="flex-grow-1">
                            <div className="fw-medium">
                              {serviceName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </div>
                            {serviceData.details && (
                              <small className="text-muted">
                                {serviceData.details}
                              </small>
                            )}
                          </div>
                          {serviceName === 'event_consumers' && serviceData.consumer_groups && (
                            <Button 
                              variant="outline-secondary" 
                              size="sm" 
                              onClick={() => setExpandedConsumers(!expandedConsumers)}
                              className="me-2"
                            >
                              <i className={`bi ${expandedConsumers ? 'bi-chevron-up' : 'bi-chevron-down'} me-1`}></i>
                              Details
                            </Button>
                          )}
                        </div>
                        <Badge bg={getStatusVariant(serviceData.status)}>
                          {serviceData.status?.toUpperCase() || 'UNKNOWN'}
                        </Badge>
                      </ListGroup.Item>
                      
                      {/* Consumer Groups Details */}
                      {serviceName === 'event_consumers' && serviceData.consumer_groups && (
                        <Collapse in={expandedConsumers}>
                          <div>
                            <Card className="mt-2 border consumer-details-card">
                              <Card.Body className="py-2">
                                <h6 className="mb-2 text-muted">Consumer Groups</h6>
                                {serviceData.consumer_groups.map((group, idx) => (
                                  <div key={idx} className="mb-3">
                                    <div className="d-flex align-items-center justify-content-between mb-1">
                                      <span className="fw-medium">{group.group}</span>
                                      <Badge bg={group.healthy ? 'success' : 'danger'} className="small">
                                        {group.active_consumers}/{group.total_consumers} healthy
                                      </Badge>
                                    </div>
                                    <div className="small text-muted mb-2">Stream: {group.stream}</div>
                                    
                                    {/* Individual Consumers */}
                                    {group.consumers && group.consumers.length > 0 && (
                                      <div className="ms-3">
                                        {group.consumers.map((consumer, consumerIdx) => (
                                          <div key={consumerIdx} className="d-flex align-items-center justify-content-between py-1 small consumer-status">
                                            <div className="d-flex align-items-center">
                                              <i className={`bi ${consumer.healthy ? 'bi-check-circle-fill text-success' : 'bi-x-circle-fill text-danger'} me-1`}></i>
                                              <span className={consumer.healthy ? '' : 'text-muted'}>{consumer.name}</span>
                                            </div>
                                            <div className="text-muted">
                                              {consumer.idle_minutes > 0 ? `${consumer.idle_minutes}m idle` : 'active'} •{' '}
                                              {consumer.pending} pending
                                            </div>
                                          </div>
                                        ))}</div>
                                    )}
                                  </div>
                                ))}
                              </Card.Body>
                            </Card>
                          </div>
                        </Collapse>
                      )}
                    </div>
                  ))}
                </ListGroup>
              </div>
            )}

            {/* Status Legend */}
            <div className="mt-4 pt-3 border-top">
              <small className="text-muted">
                <strong>Status Legend:</strong>
                <span className="ms-2">
                  <Badge bg="success" className="me-2">HEALTHY</Badge>
                  All services operational
                </span>
                <span className="ms-2">
                  <Badge bg="warning" className="me-2">DEGRADED</Badge>
                  Some services have issues
                </span>
                <span className="ms-2">
                  <Badge bg="danger" className="me-2">UNHEALTHY</Badge>
                  Service failures detected
                </span>
              </small>
            </div>
          </>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default SystemHealthModal;