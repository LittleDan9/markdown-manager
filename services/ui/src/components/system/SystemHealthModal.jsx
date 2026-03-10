import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Alert, Badge, ListGroup, Spinner, Button, Collapse, Card } from 'react-bootstrap';
import systemHealthApi from '@/api/systemHealthApi';
import './SystemHealthModal.css';

// Helper component to display detailed health information in a structured way
const DetailedHealthDisplay = ({ data, serviceName }) => {
  const formatValue = (value) => {
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }
    return String(value);
  };

  const formatKey = (key) => {
    return key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, str => str.toUpperCase());
  };

  const renderSection = (title, data, icon = null) => {
    if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) return null;

    return (
      <div className="mb-3">
        <div className="d-flex align-items-center mb-2">
          {icon && <i className={`bi ${icon} me-2 text-muted`}></i>}
          <strong className="small text-muted">{title}</strong>
        </div>
        <div className="detailed-health-section">
          {typeof data === 'object' ? (
            Object.entries(data).map(([key, value]) => (
              <div key={key} className="d-flex justify-content-between align-items-center py-1 px-2 detailed-health-row">
                <span className="detailed-health-key">{formatKey(key)}</span>
                <span className="detailed-health-value">
                  {typeof value === 'object' && value !== null && value.status ? (
                    <Badge bg={getStatusVariant(value.status)} className="small">
                      {value.status}
                    </Badge>
                  ) : (
                    <code className="detailed-health-code">{formatValue(value)}</code>
                  )}
                </span>
              </div>
            ))
          ) : (
            <code className="detailed-health-code">{formatValue(data)}</code>
          )}
        </div>
      </div>
    );
  };

  const getStatusVariant = (status) => {
    switch (status?.toLowerCase()) {
      case 'healthy': return 'success';
      case 'unhealthy': return 'danger';
      case 'degraded': return 'warning';
      case 'loading': return 'info';
      default: return 'secondary';
    }
  };

  return (
    <div className="detailed-health-display">
      {/* Service Information */}
      {(data.service || data.version) && (
        <div className="mb-3 p-2 detailed-health-header">
          <div className="d-flex justify-content-between align-items-center">
            <span className="fw-bold">{data.service || serviceName}</span>
            {data.version && <Badge bg="info" className="small">v{data.version}</Badge>}
          </div>
          {data.uptime && (
            <small className="text-muted">
              Uptime: {typeof data.uptime === 'object' ? 
                `${data.uptime.hours || 0}h ${data.uptime.minutes || 0}m` : 
                data.uptime}
            </small>
          )}
        </div>
      )}

      {/* Statistics */}
      {renderSection('Performance Statistics', data.statistics, 'bi-graph-up')}
      
      {/* Export breakdown for export service */}
      {renderSection('Export Breakdown', data.export_breakdown, 'bi-file-earmark-bar-graph')}
      
      {/* Rules information for linting service */}
      {renderSection('Rules Configuration', data.rules, 'bi-list-check')}
      
      {/* Memory usage */}
      {renderSection('Memory Usage', data.memory, 'bi-memory')}
      
      {/* System resources */}
      {renderSection('System Resources', data.system_resources, 'bi-cpu')}
      
      {/* Internal Services */}
      {renderSection('Internal Services', data.services, 'bi-diagram-3')}
      
      {/* Metrics */}
      {renderSection('Service Metrics', data.metrics, 'bi-speedometer2')}
      
      {/* Capabilities for export service */}
      {renderSection('Service Capabilities', data.capabilities, 'bi-tools')}
      
      {/* Configuration */}
      {renderSection('Configuration', data.configuration, 'bi-gear')}
      
      {/* System Information */}
      {renderSection('System Information', data.system, 'bi-pc-display')}

      {/* Endpoints for spell-check service */}
      {data.endpoints && (
        <div className="mb-3">
          <div className="d-flex align-items-center mb-2">
            <i className="bi bi-link-45deg me-2 text-muted"></i>
            <strong className="small text-muted">Available Endpoints</strong>
          </div>
          <div className="detailed-health-section">
            {data.endpoints.available && data.endpoints.available.map((endpoint, index) => (
              <div key={index} className="py-1 px-2 detailed-health-row">
                <code className="detailed-health-code">{endpoint}</code>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fallback for any unhandled data */}
      {Object.keys(data).filter(key => 
        !['service', 'version', 'uptime', 'statistics', 'export_breakdown', 'rules', 
          'memory', 'system_resources', 'services', 'metrics', 'capabilities', 
          'configuration', 'system', 'endpoints'].includes(key)
      ).length > 0 && (
        <div className="mb-3">
          <div className="d-flex align-items-center mb-2">
            <i className="bi bi-info-circle me-2 text-muted"></i>
            <strong className="small text-muted">Additional Information</strong>
          </div>
          <div className="detailed-health-section">
            <pre className="detailed-health-json">
              {JSON.stringify(
                Object.fromEntries(
                  Object.entries(data).filter(([key]) => 
                    !['service', 'version', 'uptime', 'statistics', 'export_breakdown', 'rules', 
                      'memory', 'system_resources', 'services', 'metrics', 'capabilities', 
                      'configuration', 'system', 'endpoints'].includes(key)
                  )
                ), 
                null, 
                2
              )}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

const SystemHealthModal = ({ show, onHide, isAdmin = false }) => {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [expandedConsumers, setExpandedConsumers] = useState(false);
  const [expandedDetails, setExpandedDetails] = useState({});
  const [detailedData, setDetailedData] = useState({});
  const [servicesWithDetails, setServicesWithDetails] = useState([]);

  const fetchHealthData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await systemHealthApi.getHealthStatus();
      setHealthData(data);
      setServicesWithDetails(data.services_with_details || []);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || 'Failed to fetch health data');
      console.error('Health check error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDetailedHealthData = useCallback(async (serviceName) => {
    if (!isAdmin) return; // Only admins can access detailed data
    
    try {
      setDetailedData(prev => ({
        ...prev,
        [serviceName]: { loading: true, data: null, error: null }
      }));

      // Use the systemHealthApi to fetch detailed health data through nginx proxy
      const detailedHealth = await systemHealthApi.getServiceDetailedHealth(serviceName);
      
      setDetailedData(prev => ({
        ...prev,
        [serviceName]: { loading: false, data: detailedHealth, error: null }
      }));
    } catch (error) {
      console.error(`Failed to fetch detailed health for ${serviceName}:`, error);
      setDetailedData(prev => ({
        ...prev,
        [serviceName]: { loading: false, data: null, error: error.message }
      }));
    }
  }, [isAdmin]);

  const toggleDetailedView = useCallback((serviceName) => {
    if (!isAdmin) return;
    
    const isCurrentlyExpanded = expandedDetails[serviceName];
    
    setExpandedDetails(prev => ({
      ...prev,
      [serviceName]: !isCurrentlyExpanded
    }));

    // Fetch detailed data when expanding (if not already loaded)
    if (!isCurrentlyExpanded && !detailedData[serviceName]) {
      fetchDetailedHealthData(serviceName);
    }
  }, [isAdmin, expandedDetails, detailedData, fetchDetailedHealthData]);

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
                              <small className={`${serviceData.status === 'healthy' ? 'text-muted' : 'text-danger'} d-block`}>
                                {serviceData.details}
                              </small>
                            )}
                            {/* Show error context for unhealthy services - Admin only */}
                            {isAdmin && (serviceData.status === 'unhealthy' || serviceData.status === 'degraded') && serviceData.details && (
                              <div className="mt-1">
                                <small className="text-danger">
                                  <i className="bi bi-exclamation-triangle me-1"></i>
                                  <strong>Issue:</strong> {serviceData.details}
                                </small>
                              </div>
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
                          {/* Detailed health button for admin users only */}
                          {isAdmin && servicesWithDetails.includes(serviceName) && (
                            <Button 
                              variant="outline-info" 
                              size="sm" 
                              onClick={() => toggleDetailedView(serviceName)}
                              disabled={detailedData[serviceName]?.loading}
                              className="me-2"
                            >
                              {detailedData[serviceName]?.loading ? (
                                <Spinner size="sm" className="me-1" />
                              ) : (
                                <i className={`bi ${expandedDetails[serviceName] ? 'bi-chevron-up' : 'bi-chevron-down'} me-1`}></i>
                              )}
                              Detailed
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

                      {/* Detailed Health Information for Admin Users */}
                      {isAdmin && servicesWithDetails.includes(serviceName) && (
                        <Collapse in={expandedDetails[serviceName]}>
                          <div>
                            <Card className="mt-2 border detailed-health-card">
                              <Card.Body className="py-2">
                                <h6 className="mb-2 text-muted">
                                  <i className="bi bi-gear me-1"></i>
                                  Detailed Service Health
                                </h6>
                                
                                {detailedData[serviceName]?.error && (
                                  <Alert variant="warning" className="py-2 small">
                                    <i className="bi bi-exclamation-triangle me-1"></i>
                                    {detailedData[serviceName].error}
                                  </Alert>
                                )}

                                {detailedData[serviceName]?.data && (
                                  <DetailedHealthDisplay 
                                    data={detailedData[serviceName].data} 
                                    serviceName={serviceName}
                                  />
                                )}

                                {detailedData[serviceName]?.loading && (
                                  <div className="text-center py-2">
                                    <Spinner size="sm" className="me-2" />
                                    <small>Loading detailed information...</small>
                                  </div>
                                )}
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

              {/* Show troubleshooting info if there are unhealthy services - Admin only */}
              {isAdmin && healthData && healthData.services && Object.values(healthData.services).some(service => 
                service.status === 'unhealthy' || service.status === 'degraded'
              ) && (
                <div className="mt-3 p-2 bg-light border rounded">
                  <small>
                    <strong><i className="bi bi-info-circle me-1"></i>Troubleshooting:</strong>
                    <ul className="mb-0 mt-1 ps-3">
                      <li>Check service logs: <code>docker logs [service-name]</code></li>
                      <li>Verify container status: <code>docker ps | grep markdown-manager</code></li>
                      <li>Check network connectivity between services</li>
                      <li>Ensure environment variables are correctly configured</li>
                    </ul>
                  </small>
                </div>
              )}

              {/* Admin indicator */}
              {isAdmin && (
                <div className="mt-2">
                  <small className="text-info">
                    <i className="bi bi-shield-check me-1"></i>
                    Admin mode: Enhanced diagnostics available
                  </small>
                </div>
              )}
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