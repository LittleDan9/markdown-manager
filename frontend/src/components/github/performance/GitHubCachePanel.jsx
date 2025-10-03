import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Alert, Badge, Spinner, Button, Table } from 'react-bootstrap';
import { GitHubSyncPanel } from '../index';
import gitHubApi from '../../../api/gitHubApi';
import { useNotification } from '../../NotificationProvider';
import { useGitHubAccounts } from '../../../hooks/github/useGitHubAccounts';

export default function GitHubCachePanel({ isActive = false }) {
  const [cacheStats, setCacheStats] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { showSuccess, showError } = useNotification();
  const { accounts, loading: accountsLoading } = useGitHubAccounts();

  useEffect(() => {
    console.log('GitHubPerformancePanel mounted, checking GitHub accounts...');

    const fetchMetrics = async () => {
      try {
        setLoading(true);

        // Only fetch metrics if user has GitHub accounts
        if (accounts.length === 0) {
          console.log('No GitHub accounts found, skipping cache stats fetch');
          setCacheStats(null);
          setSyncStatus(null);
          setError(null);
          setLoading(false);
          return;
        }

        console.log('GitHub accounts found, calling getCacheStats()...');
        const [cacheData, syncData] = await Promise.all([
          gitHubApi.getCacheStats(),
          gitHubApi.getSyncStatus()
        ]);
        console.log('Cache stats received:', cacheData);
        console.log('Sync status received:', syncData);
        setCacheStats(cacheData);
        setSyncStatus(syncData);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch performance metrics:', err);
        setError('Failed to load metrics');
      } finally {
        setLoading(false);
      }
    };

    // Wait for accounts to load before fetching metrics
    if (!accountsLoading) {
      fetchMetrics();
    }

    // Only set up interval if tab is active and accounts exist
    let interval;
    if (!accountsLoading && accounts.length > 0 && isActive) {
      interval = setInterval(fetchMetrics, 30000);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [accounts, accountsLoading, isActive]); // Add isActive to dependencies

  const handleClearCache = async () => {
    if (accounts.length === 0) {
      showError("No GitHub accounts connected");
      return;
    }

    try {
      setLoading(true);
      await gitHubApi.clearCache();
      showSuccess("Cache cleared successfully");
      // Refresh metrics after clearing cache
      const [cacheData, syncData] = await Promise.all([
        gitHubApi.getCacheStats(),
        gitHubApi.getSyncStatus()
      ]);
      setCacheStats(cacheData);
      setSyncStatus(syncData);
    } catch (error) {
      showError("Failed to clear cache");
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshMetrics = async () => {
    if (accounts.length === 0) {
      showError("No GitHub accounts connected");
      return;
    }

    try {
      setLoading(true);
      const [cacheData, syncData] = await Promise.all([
        gitHubApi.getCacheStats(),
        gitHubApi.getSyncStatus()
      ]);
      setCacheStats(cacheData);
      setSyncStatus(syncData);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch performance metrics:', err);
      setError('Failed to load metrics');
    } finally {
      setLoading(false);
    }
  };

  const calculateHitRate = (stats) => {
    if (!stats) return 0; // Add null check first
    if (stats.hit_rate !== undefined && stats.hit_rate !== null) {
      return Math.round(stats.hit_rate);
    }
    // Fallback calculation if hit_rate not provided
    const hits = stats.hits || 0;
    const misses = stats.misses || 0;
    if ((hits + misses) === 0) return 0;
    return Math.round((hits / (hits + misses)) * 100);
  };

  const getSyncStatusBadge = () => {
    if (!syncStatus) return { variant: 'secondary', text: 'Unknown' };
    return syncStatus.running
      ? { variant: 'success', text: 'Running' }
      : { variant: 'secondary', text: 'Stopped' };
  };

  return (
    <div className="github-cache-sync-tab">
      <Row>
        {/* Cache Performance Section */}
        <Col md={6}>
          <Card className="mb-3">
            <Card.Header className="d-flex align-items-center">
              <i className="bi bi-speedometer2 me-2"></i>
              Cache Performance
              {loading && <Spinner size="sm" className="ms-auto" />}
            </Card.Header>
            <Card.Body>
              {error && (
                <Alert variant="warning" className="mb-3">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  {error}
                </Alert>
              )}

              {/* Performance Metrics Table */}
              {cacheStats ? (
                <Table size="sm">
                  <tbody>
                    <tr>
                      <td>
                        <i className="bi bi-bullseye me-2"></i>
                        <strong>Hit Rate</strong>
                      </td>
                      <td>
                        <Badge bg={calculateHitRate(cacheStats) > 80 ? "success" : calculateHitRate(cacheStats) > 50 ? "warning" : "danger"}>
                          {calculateHitRate(cacheStats)}%
                        </Badge>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <i className="bi bi-check-circle me-2"></i>
                        Cache Hits
                      </td>
                      <td><Badge bg="success">{cacheStats.hits ?? 0}</Badge></td>
                    </tr>
                    <tr>
                      <td>
                        <i className="bi bi-x-circle me-2"></i>
                        Cache Misses
                      </td>
                      <td><Badge bg="warning">{cacheStats.misses ?? 0}</Badge></td>
                    </tr>
                    <tr>
                      <td>
                        <i className="bi bi-database me-2"></i>
                        Cache Sets
                      </td>
                      <td><Badge bg="info">{cacheStats.sets ?? 0}</Badge></td>
                    </tr>
                    <tr>
                      <td>
                        <i className="bi bi-speedometer2 me-2"></i>
                        Total Keys
                      </td>
                      <td><Badge bg="primary">{cacheStats.total_keys ?? 0}</Badge></td>
                    </tr>
                    <tr>
                      <td>
                        <i className="bi bi-check2-circle me-2"></i>
                        Active Keys
                      </td>
                      <td><Badge bg="success">{cacheStats.active_keys ?? 0}</Badge></td>
                    </tr>
                    <tr>
                      <td>
                        <i className="bi bi-github me-2"></i>
                        GitHub Keys
                      </td>
                      <td><Badge bg="primary">{cacheStats.github_keys ?? 0}</Badge></td>
                    </tr>
                    <tr>
                      <td>
                        <i className="bi bi-gear me-2"></i>
                        Status
                      </td>
                      <td><Badge bg="success">{cacheStats.status ?? 'Unknown'}</Badge></td>
                    </tr>
                    <tr>
                      <td>
                        <i className="bi bi-cpu me-2"></i>
                        Backend
                      </td>
                      <td><Badge bg="secondary">{cacheStats.backend ?? 'Unknown'}</Badge></td>
                    </tr>
                  </tbody>
                </Table>
              ) : (
                <Alert variant="info">Loading cache stats...</Alert>
              )}

              {/* Cache Control Buttons */}
              <div className="d-flex gap-2 mb-3">
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={handleClearCache}
                  disabled={loading}
                >
                  <i className="bi bi-trash me-1"></i>
                  Clear Cache
                </Button>
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={handleRefreshMetrics}
                  disabled={loading}
                >
                  <i className="bi bi-arrow-clockwise me-1"></i>
                  Refresh
                </Button>
              </div>

              {/* Help Information */}
              <Alert variant="light" className="mb-0">
                <small>
                  <strong>Cache Performance:</strong> Stores GitHub API responses to improve speed and reduce API calls.
                  <ul className="mt-1 mb-1 ps-3">
                    <li><strong>Hit Rate:</strong> % of requests served from cache</li>
                    <li><strong>Total Keys:</strong> All cached items</li>
                    <li><strong>Active Keys:</strong> Currently valid cached responses</li>
                    <li><strong>GitHub Keys:</strong> Cached GitHub API data specifically</li>
                  </ul>
                </small>
              </Alert>
            </Card.Body>
          </Card>
        </Col>

        {/* Background Sync Section */}
        <Col md={6}>
          <GitHubSyncPanel isActive={isActive} />
        </Col>
      </Row>
    </div>
  );
}
