/**
 * Unified GitHub Repository Settings - Simplified approach
 *
 * Key differences from complex GitHubRepositorySettings:
 * 1. Document ID-centric repository management
 * 2. Unified backend API calls
 * 3. Simplified selection flow (no complex bulk modal)
 * 4. Direct integration with UnifiedFileBrowserProvider
 * 5. Streamlined UI with essential features only
 */

import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, InputGroup, Badge, Alert, Spinner } from 'react-bootstrap';
import { useNotification } from '../../NotificationProvider';
import config from '../../../config';
import documentsApi from '../../../api/documentsApi';

export default function UnifiedGitHubRepositorySettings({ account, onBack, onRepositorySelect }) {
  const [repositories, setRepositories] = useState([]);
  const [selectedRepos, setSelectedRepos] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    loadRepositories();
  }, [account.id]);

  // UNIFIED APPROACH: Use documents API to get GitHub repositories
  const loadRepositories = async () => {
    try {
      setLoading(true);

      // Use unified documents API to get GitHub repositories for this account
      const response = await documentsApi.getGitHubRepositories(account.id);

      setRepositories(response.repositories || []);
      setSelectedRepos(response.repositories.filter(repo => repo.is_selected) || []);

    } catch (error) {
      console.error('Failed to load repositories:', error);
      showError('Failed to load repositories');
    } finally {
      setLoading(false);
    }
  };

  // UNIFIED APPROACH: Simple repository selection
  const handleRepositoryToggle = async (repository) => {
    try {
      if (repository.is_selected) {
        // Remove repository
        await documentsApi.removeGitHubRepository(account.id, repository.id);
        showSuccess(`Removed ${repository.full_name} from sync`);

        // Update local state
        setRepositories(repos =>
          repos.map(r => r.id === repository.id ? { ...r, is_selected: false } : r)
        );
        setSelectedRepos(repos => repos.filter(r => r.id !== repository.id));

      } else {
        // Add repository
        await documentsApi.addGitHubRepository(account.id, repository.id);
        showSuccess(`Added ${repository.full_name} to sync`);

        // Update local state
        const updatedRepo = { ...repository, is_selected: true };
        setRepositories(repos =>
          repos.map(r => r.id === repository.id ? updatedRepo : r)
        );
        setSelectedRepos(repos => [...repos, updatedRepo]);
      }

    } catch (error) {
      console.error('Failed to toggle repository:', error);
      showError(`Failed to update ${repository.full_name}`);
    }
  };

  // UNIFIED APPROACH: Select repository for browsing (integrates with UnifiedGitHubTab)
  const handleBrowseRepository = (repository) => {
    if (onRepositorySelect) {
      onRepositorySelect(repository, account);
    }
  };

  // Filter repositories based on search
  const filteredRepositories = repositories.filter(repo =>
    repo.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (repo.description && repo.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const selectedCount = selectedRepos.length;
  const availableCount = repositories.length - selectedCount;

  return (
    <Container fluid className="unified-github-repository-settings">
      {/* Header */}
      <Row className="mb-4">
        <Col>
          <div className="d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center">
              <Button variant="outline-secondary" onClick={onBack} className="me-3">
                <i className="bi bi-arrow-left"></i> Back
              </Button>
              <div>
                <h4 className="mb-1">
                  Repository Settings
                  {config.features.unifiedArchitecture && (
                    <small className="badge bg-success ms-2">Unified</small>
                  )}
                </h4>
                <p className="text-muted mb-0">
                  Select repositories to sync for <strong>{account.username}</strong>
                </p>
              </div>
            </div>

            {/* Simple Statistics */}
            <div className="text-end">
              <div className="d-flex gap-3">
                <div>
                  <Badge bg="primary" className="fs-6">{selectedCount}</Badge>
                  <small className="text-muted d-block">Selected</small>
                </div>
                <div>
                  <Badge bg="secondary" className="fs-6">{availableCount}</Badge>
                  <small className="text-muted d-block">Available</small>
                </div>
              </div>
            </div>
          </div>
        </Col>
      </Row>

      {/* Search */}
      <Row className="mb-3">
        <Col md={6}>
          <InputGroup>
            <InputGroup.Text>
              <i className="bi bi-search"></i>
            </InputGroup.Text>
            <Form.Control
              type="text"
              placeholder="Search repositories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </InputGroup>
        </Col>
        <Col md={6}>
          <Alert variant="info" className="mb-0 py-2">
            <small>
              <i className="bi bi-lightbulb me-1"></i>
              <strong>Unified Approach:</strong> Repository selection now integrates directly with document management.
            </small>
          </Alert>
        </Col>
      </Row>

      {/* Repository List */}
      <Row>
        <Col>
          <Card>
            <Card.Header>
              <h5 className="mb-0">
                <i className="bi bi-github me-2"></i>
                Repositories ({filteredRepositories.length})
              </h5>
            </Card.Header>
            <Card.Body style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="primary" />
                  <p className="mt-2 text-muted">Loading repositories...</p>
                </div>
              ) : filteredRepositories.length === 0 ? (
                <Alert variant="secondary">
                  <i className="bi bi-search me-2"></i>
                  {searchQuery ? 'No repositories match your search.' : 'No repositories found.'}
                </Alert>
              ) : (
                <div className="repository-grid">
                  {filteredRepositories.map(repository => (
                    <Card key={repository.id} className="mb-3 repository-card">
                      <Card.Body>
                        <div className="d-flex justify-content-between align-items-start">
                          <div className="flex-grow-1">
                            <div className="d-flex align-items-center mb-2">
                              <strong className="me-2">{repository.full_name}</strong>

                              {repository.private && (
                                <Badge bg="warning" className="me-2">
                                  <i className="bi bi-lock me-1"></i>Private
                                </Badge>
                              )}

                              {repository.language && (
                                <Badge bg="info" className="me-2">
                                  {repository.language}
                                </Badge>
                              )}

                              {repository.is_selected && (
                                <Badge bg="success">
                                  <i className="bi bi-check-circle me-1"></i>Syncing
                                </Badge>
                              )}
                            </div>

                            {repository.description && (
                              <p className="text-muted mb-2 small">{repository.description}</p>
                            )}

                            <div className="d-flex align-items-center text-muted small">
                              {repository.stargazers_count > 0 && (
                                <span className="me-3">
                                  <i className="bi bi-star me-1"></i>
                                  {repository.stargazers_count}
                                </span>
                              )}
                              <span>
                                Updated {new Date(repository.updated_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          <div className="d-flex flex-column align-items-end gap-2">
                            {/* Toggle sync */}
                            <Form.Check
                              type="switch"
                              checked={repository.is_selected}
                              onChange={() => handleRepositoryToggle(repository)}
                              label="Sync"
                              className="mb-0"
                            />

                            {/* Browse repository (if selected) */}
                            {repository.is_selected && (
                              <Button
                                variant="outline-primary"
                                size="sm"
                                onClick={() => handleBrowseRepository(repository)}
                              >
                                <i className="bi bi-folder2-open me-1"></i>
                                Browse
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card.Body>
                    </Card>
                  ))}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Footer Info */}
      <Row className="mt-3">
        <Col>
          <Alert variant="light" className="mb-0">
            <small className="text-muted">
              <strong>Unified Architecture Benefits:</strong>
              <ul className="mb-0 mt-1">
                <li>Repository selection directly integrates with document management</li>
                <li>Simplified UI focuses on essential functionality</li>
                <li>Uses unified backend APIs for consistency</li>
                <li>Browse button opens repositories in unified file browser</li>
              </ul>
            </small>
          </Alert>
        </Col>
      </Row>
    </Container>
  );
}