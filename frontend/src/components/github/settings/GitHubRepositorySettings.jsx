import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, InputGroup, Badge, Alert, Modal } from 'react-bootstrap';
import { useNotification } from '../../NotificationProvider';
import gitHubRepositorySelectionApi from '../../../api/gitHubRepositorySelectionApi';

export default function GitHubRepositorySettings({ account, onBack }) {
  const [selectedRepos, setSelectedRepos] = useState([]);
  const [availableRepos, setAvailableRepos] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [availableOrganizations, setAvailableOrganizations] = useState(new Set());
  const [searchFilters, setSearchFilters] = useState({
    organization: '',
    language: '',
    include_private: true,
    sort_by: 'updated'
  });
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 20,
    total_pages: 1,
    total_count: 0
  });
  const [statistics, setStatistics] = useState(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkSelection, setBulkSelection] = useState(new Set());
  const [autoSyncPublicRepos, setAutoSyncPublicRepos] = useState(false);
  const [autoSyncLoading, setAutoSyncLoading] = useState(false);
  const [organizationsLoading, setOrganizationsLoading] = useState(false);
  const [selectedReposCollapsed, setSelectedReposCollapsed] = useState(false);
  const [availableReposCollapsed, setAvailableReposCollapsed] = useState(false);
  const [statisticsCollapsed, setStatisticsCollapsed] = useState(false);

  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    loadSelectedRepositories();
    loadStatistics();
    loadOrganizations();
  }, [account.id]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      searchRepositories();
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, searchFilters, pagination.page]);

  const loadSelectedRepositories = async () => {
    try {
      setLoading(true);
      const response = await gitHubRepositorySelectionApi.getSelectedRepositories(account.id);
      setSelectedRepos(response.selections || []);
    } catch (error) {
      console.error('Failed to load selected repositories:', error);
      showError('Failed to load selected repositories');
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const stats = await gitHubRepositorySelectionApi.getRepositoryStatistics(account.id);
      setStatistics(stats);
    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  };

  const loadOrganizations = async () => {
    try {
      setOrganizationsLoading(true);
      const response = await gitHubRepositorySelectionApi.getOrganizations(account.id);
      const orgs = response.organizations || [];

      // Create a set of organization names for the dropdown
      const orgNames = new Set();
      if (orgs.length > 0) {
        orgNames.add(''); // Add empty option only if there are organizations
        orgs.forEach(org => orgNames.add(org.login));
      }

      setAvailableOrganizations(orgNames);
    } catch (error) {
      console.error('Failed to load organizations:', error);
      // Gracefully handle the case where we don't have org permissions
      // This will result in hiding the organization field entirely
      setAvailableOrganizations(new Set());
    } finally {
      setOrganizationsLoading(false);
    }
  };

  const searchRepositories = async () => {
    try {
      setSearchLoading(true);
      const params = {
        search_query: searchQuery || '',
        page: pagination.page,
        per_page: pagination.per_page,
        ...searchFilters
      };

      const response = await gitHubRepositorySelectionApi.searchRepositories(account.id, params);
      setAvailableRepos(response.repositories || []);
      setPagination({
        page: response.page,
        per_page: response.per_page,
        total_pages: response.total_pages,
        total_count: response.total_count
      });
    } catch (error) {
      console.error('Failed to search repositories:', error);
      showError('Failed to search repositories');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAddRepository = async (repo) => {
    try {
      const result = await gitHubRepositorySelectionApi.addRepositorySelection(account.id, repo.id);

      // Show different messages based on clone success
      if (result.clone_success) {
        showSuccess(`${repo.full_name} added to workspace and cloned successfully`);
      } else {
        showSuccess(`${repo.full_name} added to workspace. ${result.clone_message || 'Clone may still be in progress.'}`);
      }

      // Update local state
      setAvailableRepos(repos =>
        repos.map(r => r.id === repo.id ? { ...r, is_selected: true } : r)
      );
      await loadSelectedRepositories();
      await loadStatistics();
    } catch (error) {
      console.error('Failed to add repository:', error);
      showError('Failed to add repository to workspace');
    }
  };

  const handleRemoveRepository = async (repo) => {
    try {
      await gitHubRepositorySelectionApi.removeRepositorySelection(account.id, repo.github_repo_id);
            showSuccess(`Removed ${repo.full_name} from workspace`);

      // Update local state
      setSelectedRepos(repos => repos.filter(r => r.github_repo_id !== repo.github_repo_id));
      setAvailableRepos(repos =>
        repos.map(r => r.id === repo.github_repo_id ? { ...r, is_selected: false } : r)
      );
      await loadStatistics();
    } catch (error) {
      console.error('Failed to remove repository:', error);
      showError('Failed to remove repository from selections');
    }
  };

  const handleToggleSync = async (repo) => {
    try {
      await gitHubRepositorySelectionApi.toggleRepositorySync(
        account.id,
        repo.github_repo_id,
        !repo.sync_enabled
      );

      const action = repo.sync_enabled ? 'disabled' : 'enabled';
      showSuccess(`Sync ${action} for ${repo.repo_full_name}`);

      // Update local state
      setSelectedRepos(repos =>
        repos.map(r =>
          r.github_repo_id === repo.github_repo_id
            ? { ...r, sync_enabled: !r.sync_enabled }
            : r
        )
      );
      await loadStatistics();
    } catch (error) {
      console.error('Failed to toggle sync:', error);
      showError('Failed to toggle repository sync');
    }
  };

  const handleBulkAdd = async () => {
    if (bulkSelection.size === 0) {
      showError('Please select repositories to add');
      return;
    }

    try {
      const repoIds = Array.from(bulkSelection);
      await gitHubRepositorySelectionApi.bulkAddRepositorySelections(account.id, repoIds);
      showSuccess(`Added ${repoIds.length} repositories to workspace`);

      setShowBulkModal(false);
      setBulkSelection(new Set());
      await loadSelectedRepositories();
      await loadStatistics();
      await searchRepositories(); // Refresh to update is_selected status
    } catch (error) {
      console.error('Failed to bulk add repositories:', error);
      showError('Failed to add repositories in bulk');
    }
  };

  const handleBulkSelectionToggle = (repoId) => {
    const newSelection = new Set(bulkSelection);
    if (newSelection.has(repoId)) {
      newSelection.delete(repoId);
    } else {
      newSelection.add(repoId);
    }
    setBulkSelection(newSelection);
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const getLanguageColor = (language) => {
    if (!language) return 'secondary';

    const colors = {
      JavaScript: 'warning',
      TypeScript: 'info',
      Python: 'success',
      Java: 'danger',
      'C#': 'primary',
      Go: 'secondary',
      HTML: 'danger',
      CSS: 'info',
      SCSS: 'info',
      PHP: 'primary',
      Ruby: 'danger',
      Swift: 'warning',
      Kotlin: 'primary',
      Rust: 'dark',
      'C++': 'primary',
      C: 'secondary',
      Shell: 'secondary',
      PowerShell: 'info',
      Vue: 'success',
      React: 'info',
      Svelte: 'warning',
      Dart: 'info',
      Elixir: 'primary',
      Clojure: 'success',
      Haskell: 'primary',
      Lua: 'primary',
      Perl: 'info',
      R: 'info',
      Scala: 'danger',
      MATLAB: 'warning',
      Julia: 'primary',
      'Objective-C': 'info',
      'Objective-C++': 'primary',
      Assembly: 'warning',
      HCL: 'info',
      PLpgSQL: 'primary'
    };
    return colors[language] || 'secondary';
  };

  const handleAutoSyncAllRepos = async (enabled) => {
    setAutoSyncLoading(true);
    setAutoSyncPublicRepos(enabled); // Keep the state variable name for now

    try {
      if (enabled) {
        // Get all repositories (both public and private) and add them to selections
        const params = {
          search_query: '',
          page: 1,
          per_page: 100, // Get more repos per request
          include_private: true, // Include all repos (public and private)
          organization: '',
          language: '',
          sort_by: 'updated'
        };

        let allRepos = [];
        let currentPage = 1;
        let hasMorePages = true;

        // Fetch all repositories (handle pagination)
        while (hasMorePages) {
          const response = await gitHubRepositorySelectionApi.searchRepositories(account.id, {
            ...params,
            page: currentPage
          });

          const unselectedRepos = response.repositories.filter(repo => !repo.is_selected);
          allRepos = [...allRepos, ...unselectedRepos];

          hasMorePages = currentPage < response.total_pages;
          currentPage++;
        }

        if (allRepos.length > 0) {
          // Bulk add all unselected repositories
          const repoIds = allRepos.map(repo => repo.id);
          await gitHubRepositorySelectionApi.bulkAddRepositorySelections(account.id, repoIds);
          showSuccess(`Auto-sync enabled: Added ${allRepos.length} repositories to workspace`);

          // Refresh the data
          await loadSelectedRepositories();
          await loadStatistics();
          await searchRepositories();
        } else {
          showSuccess('Auto-sync enabled: All repositories are already in workspace');
        }
      } else {
        showSuccess('Auto-sync disabled: Manual repository selection active');
      }
    } catch (error) {
      console.error('Failed to toggle auto-sync:', error);
      showError('Failed to update auto-sync setting');
      setAutoSyncPublicRepos(!enabled); // Revert on error
    } finally {
      setAutoSyncLoading(false);
    }
  };

  return (
    <Container fluid className="github-repository-settings" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
      {/* Header */}
      <Row className="mb-4">
        <Col>
          <div className="d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center">
              <Button variant="outline-secondary" onClick={onBack} className="me-3">
                <i className="bi bi-arrow-left"></i> Back
              </Button>
              <div>
                <h4 className="mb-1">Repository Settings</h4>
                <p className="text-muted mb-0">
                  Manage which repositories to sync for <strong>{account.username}</strong>
                </p>
              </div>
            </div>
          </div>
        </Col>
      </Row>

      {/* Statistics */}
      {statistics && (
        <Row className="mb-3">
          <Col>
            <Card className="statistics-card">
              <Card.Header
                className="d-flex justify-content-between align-items-center py-2 collapsible-header"
                onClick={() => setStatisticsCollapsed(!statisticsCollapsed)}
              >
                <div className="d-flex align-items-center">
                  <i className={`bi bi-chevron-${statisticsCollapsed ? 'right' : 'down'} me-2 chevron-icon ${statisticsCollapsed ? 'collapsed' : ''}`}></i>
                  <h6 className="mb-0">Repository Statistics</h6>
                </div>
                <Badge bg="info" className="ms-2">{statistics.total_selected} selected</Badge>
              </Card.Header>
              {!statisticsCollapsed && (
                <Card.Body className="py-2">
                  <Row>
                    <Col md={3}>
                      <div className="text-center">
                        <h6 className="text-primary mb-1">{statistics.total_selected}</h6>
                        <small className="text-muted">Selected Repositories</small>
                      </div>
                    </Col>
                    <Col md={3}>
                      <div className="text-center">
                        <h6 className="text-success mb-1">{statistics.sync_enabled}</h6>
                        <small className="text-muted">Sync Enabled</small>
                      </div>
                    </Col>
                    <Col md={3}>
                      <div className="text-center">
                        <h6 className="text-warning mb-1">{statistics.sync_disabled}</h6>
                        <small className="text-muted">Sync Disabled</small>
                      </div>
                    </Col>
                    <Col md={3}>
                      <div className="text-center">
                        <h6 className="text-info mb-1">{Object.keys(statistics.language_breakdown).length}</h6>
                        <small className="text-muted">Languages</small>
                      </div>
                    </Col>
                  </Row>
                </Card.Body>
              )}
            </Card>
          </Col>
        </Row>
      )}

      <Row>
        {/* Selected Repositories */}
        <Col lg={6}>
          <Card className="selected-repos-section">
            <Card.Header
              className="d-flex justify-content-between align-items-center collapsible-header"
              onClick={() => setSelectedReposCollapsed(!selectedReposCollapsed)}
            >
              <div className="d-flex align-items-center">
                <i className={`bi bi-chevron-${selectedReposCollapsed ? 'right' : 'down'} me-2 chevron-icon ${selectedReposCollapsed ? 'collapsed' : ''}`}></i>
                <h5 className="mb-0">Selected Repositories</h5>
              </div>
              <Badge bg="primary">{selectedRepos.length}</Badge>
            </Card.Header>
            {!selectedReposCollapsed && (
              <Card.Body className="repo-list-container" style={{ maxHeight: '50vh', overflowY: 'auto', paddingBottom: '1.5rem' }}>
              {loading ? (
                <div className="loading-spinner d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              ) : selectedRepos.length === 0 ? (
                <Alert variant="info">
                  <i className="bi bi-info-circle me-2"></i>
                  No repositories selected. Use the search on the right to add repositories.
                </Alert>
              ) : (
                selectedRepos.map(repo => (
                  <Card key={repo.id} className="repo-card">
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-center">
                        <div className="flex-grow-1">
                          <div className="d-flex align-items-center mb-1">
                            <strong className="me-2">{repo.repo_full_name}</strong>
                            {repo.is_private && (
                              <Badge bg="warning" className="me-2">Private</Badge>
                            )}
                            {repo.language && (
                              <Badge bg={getLanguageColor(repo.language)} className="language-badge">
                                {repo.language}
                              </Badge>
                            )}
                          </div>
                          {repo.description && (
                            <small className="text-muted d-block">{repo.description}</small>
                          )}
                        </div>
                        <div className="d-flex align-items-center">
                          <Form.Check
                            type="switch"
                            checked={repo.sync_enabled}
                            onChange={() => handleToggleSync(repo)}
                            label="Sync"
                            className="me-2"
                          />
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => handleRemoveRepository(repo)}
                          >
                            <i className="bi bi-trash"></i>
                          </Button>
                        </div>
                      </div>
                    </Card.Body>
                  </Card>
                ))
              )}
            </Card.Body>
            )}
          </Card>
        </Col>

        {/* Available Repositories Search */}
        <Col lg={6}>
          <Card className="available-repos-section">
            <Card.Header
              className="d-flex justify-content-between align-items-center collapsible-header"
              onClick={() => setAvailableReposCollapsed(!availableReposCollapsed)}
            >
              <div className="d-flex align-items-center">
                <i className={`bi bi-chevron-${availableReposCollapsed ? 'right' : 'down'} me-2 chevron-icon ${availableReposCollapsed ? 'collapsed' : ''}`}></i>
                <h5 className="mb-0">Add Repositories</h5>
                <Badge bg="secondary" className="ms-2">{availableRepos.length}</Badge>
              </div>
              <Button
                variant="outline-primary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation(); // Prevent header collapse
                  setShowBulkModal(true);
                }}
                disabled={availableRepos.filter(r => !r.is_selected).length === 0}
              >
                <i className="bi bi-plus-circle me-1"></i>
                Bulk Add
              </Button>
            </Card.Header>
            {!availableReposCollapsed && (
            <Card.Body style={{ maxHeight: '50vh', overflowY: 'auto' }}>
              {/* Auto-Sync Toggle - Compact Version */}
              <Row className="mb-2">
                <Col>
                  <div className="d-flex justify-content-between align-items-center p-2 border rounded bg-info-subtle">
                    <div className="d-flex align-items-center">
                      <i className="bi bi-magic text-info me-2"></i>
                      <div>
                        <small className="fw-bold text-info mb-0">Auto-Sync All Repos</small>
                        {autoSyncLoading && (
                          <div className="d-inline-block ms-2">
                            <div className="spinner-border spinner-border-sm text-info" role="status">
                              <span className="visually-hidden">Processing...</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <Form.Check
                      type="switch"
                      checked={autoSyncPublicRepos}
                      onChange={(e) => handleAutoSyncAllRepos(e.target.checked)}
                      disabled={autoSyncLoading}
                    />
                  </div>
                </Col>
              </Row>

              {/* Search Filters */}
              <Row className="mb-3">
                <Col>
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
              </Row>

              <Row className="mb-3">
                {availableOrganizations.size > 0 && (
                  <Col md={6}>
                    {availableOrganizations.size > 1 ? (
                      <Form.Select
                        value={searchFilters.organization}
                        onChange={(e) => setSearchFilters(prev => ({ ...prev, organization: e.target.value }))}
                        disabled={organizationsLoading}
                      >
                        <option value="">All Organizations</option>
                        {Array.from(availableOrganizations).filter(org => org !== '').map(org => (
                          <option key={org} value={org}>{org}</option>
                        ))}
                      </Form.Select>
                    ) : (
                      <Form.Control
                        type="text"
                        placeholder="Organization (optional)"
                        value={searchFilters.organization}
                        onChange={(e) => setSearchFilters(prev => ({ ...prev, organization: e.target.value }))}
                        disabled={organizationsLoading}
                      />
                    )}
                    {organizationsLoading && (
                      <Form.Text className="text-muted">
                        <div className="spinner-border spinner-border-sm me-1" role="status"></div>
                        Loading organizations...
                      </Form.Text>
                    )}
                  </Col>
                )}
                <Col md={availableOrganizations.size > 0 ? 6 : 12}>
                  <Form.Select
                    value={searchFilters.sort_by}
                    onChange={(e) => setSearchFilters(prev => ({ ...prev, sort_by: e.target.value }))}
                  >
                    <option value="updated">Recently Updated</option>
                    <option value="name">Name</option>
                    <option value="stars">Stars</option>
                  </Form.Select>
                </Col>
              </Row>

              {/* Repository List */}
              <div className="repo-search-list" style={{ maxHeight: '30vh', overflowY: 'auto', paddingBottom: '1rem' }}>
                {searchLoading ? (
                  <div className="loading-spinner d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Searching...</span>
                    </div>
                  </div>
                ) : availableRepos.length === 0 ? (
                  <Alert variant="secondary">
                    <i className="bi bi-search me-2"></i>
                    No repositories found. Try adjusting your search criteria.
                  </Alert>
                ) : (
                  availableRepos.map(repo => (
                    <Card key={repo.id} className="repo-card">
                      <Card.Body>
                        <div className="d-flex justify-content-between align-items-center">
                          <div className="flex-grow-1">
                            <div className="d-flex align-items-center mb-1">
                              <strong className="me-2">{repo.full_name}</strong>
                              {repo.private && (
                                <Badge bg="warning" className="me-2">Private</Badge>
                              )}
                              {repo.language && (
                                <Badge bg={getLanguageColor(repo.language)} className="language-badge">
                                  {repo.language}
                                </Badge>
                              )}
                            </div>
                            {repo.description && (
                              <small className="text-muted d-block">{repo.description}</small>
                            )}
                          </div>
                          <div>
                            {repo.is_selected ? (
                              <Badge bg="success">
                                <i className="bi bi-check-circle me-1"></i>
                                Selected
                              </Badge>
                            ) : (
                              <Button
                                variant="outline-primary"
                                size="sm"
                                onClick={() => handleAddRepository(repo)}
                              >
                                <i className="bi bi-plus"></i>
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card.Body>
                    </Card>
                  ))
                )}
              </div>

              {/* Pagination */}
              {pagination.total_pages > 1 && (
                <div className="pagination-controls d-flex justify-content-center">
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    disabled={pagination.page === 1}
                    onClick={() => handlePageChange(pagination.page - 1)}
                    className="me-2"
                  >
                    Previous
                  </Button>
                  <span className="align-self-center mx-2">
                    Page {pagination.page} of {pagination.total_pages}
                  </span>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    disabled={pagination.page === pagination.total_pages}
                    onClick={() => handlePageChange(pagination.page + 1)}
                    className="ms-2"
                  >
                    Next
                  </Button>
                </div>
              )}
            </Card.Body>
            )}
          </Card>
        </Col>
      </Row>

      {/* Bulk Selection Modal */}
      <Modal show={showBulkModal} onHide={() => setShowBulkModal(false)} size="lg" className="bulk-modal">
        <Modal.Header closeButton>
          <Modal.Title>Bulk Add Repositories</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          <p>Select repositories to add to your selections:</p>
          <div className="bulk-repo-list" style={{ maxHeight: '50vh', overflowY: 'auto', paddingBottom: '1rem' }}>
            {availableRepos.filter(r => !r.is_selected).map(repo => (
              <Card key={repo.id} className="repo-card">
                <Card.Body>
                  <Form.Check
                    type="checkbox"
                    checked={bulkSelection.has(repo.id)}
                    onChange={() => handleBulkSelectionToggle(repo.id)}
                    label={
                      <div>
                        <strong>{repo.full_name}</strong>
                        {repo.description && (
                          <small className="text-muted d-block">{repo.description}</small>
                        )}
                      </div>
                    }
                  />
                </Card.Body>
              </Card>
            ))}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowBulkModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleBulkAdd}>
            Add {bulkSelection.size} Repositories
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}