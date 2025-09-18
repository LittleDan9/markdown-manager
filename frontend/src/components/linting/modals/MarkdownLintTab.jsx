/**
 * MarkdownLintTab - Settings interface for markdown linting configuration
 * 
 * Provides UI for managing markdown linting rules at different scopes:
 * - User defaults
 * - Category-specific rules
 * - Folder-specific rules
 */

import React, { useState, useEffect } from 'react';
import { Card, Form, Button, Alert, Spinner, Row, Col, Badge, Accordion } from 'react-bootstrap';
import { MarkdownLintRulesService } from '../../../services/linting';
import { useNotification } from '../../NotificationProvider';

const MarkdownLintTab = () => {
  // State management
  const [rules, setRules] = useState({});
  const [ruleDefinitions, setRuleDefinitions] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [rulesFilter, setRulesFilter] = useState('all'); // 'all', 'enabled', 'disabled'
  const [searchTerm, setSearchTerm] = useState('');

  const { showSuccess, showError } = useNotification();

  // Load rules and definitions on mount
  useEffect(() => {
    loadData();
  }, []);

  /**
   * Load user default rules and rule definitions
   */
  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load in parallel
      const [userRules, definitions] = await Promise.all([
        MarkdownLintRulesService.getUserDefaults(),
        MarkdownLintRulesService.getRuleDefinitions()
      ]);

      setRules(userRules);
      setRuleDefinitions(definitions);
    } catch (err) {
      setError('Failed to load markdown linting configuration');
      console.error('MarkdownLintTab: Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Save user default rules
   */
  const saveRules = async () => {
    setSaving(true);
    setError(null);

    try {
      await MarkdownLintRulesService.saveUserDefaults(rules);
      showSuccess('Markdown linting rules saved successfully');
    } catch (err) {
      setError('Failed to save markdown linting rules');
      showError('Failed to save markdown linting rules');
      console.error('MarkdownLintTab: Failed to save rules:', err);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Handle rule toggle
   */
  const handleRuleToggle = (ruleId, enabled) => {
    setRules(prev => ({
      ...prev,
      [ruleId]: enabled
    }));
  };

  /**
   * Reset to system defaults
   */
  const resetToDefaults = () => {
    const defaultRules = {
      'MD001': true,  // Heading levels should only increment by one level at a time
      'MD003': true,  // Heading style should be consistent
      'MD009': true,  // Trailing spaces
      'MD010': true,  // Hard tabs
      'MD012': true,  // Multiple consecutive blank lines
      'MD018': true,  // No space after hash on atx style heading
      'MD019': true,  // Multiple spaces after hash on atx style heading
      'MD023': true,  // Headings must start at the beginning of the line
      'MD025': true,  // Multiple top level headings in the same document
      'MD041': true,  // First line in file should be a top level heading
      'MD047': true,  // File should end with a single newline character
    };

    setRules(defaultRules);
  };

  /**
   * Enable all rules
   */
  const enableAllRules = () => {
    const allEnabled = {};
    Object.keys(ruleDefinitions).forEach(ruleId => {
      allEnabled[ruleId] = true;
    });
    setRules(allEnabled);
  };

  /**
   * Disable all rules
   */
  const disableAllRules = () => {
    const allDisabled = {};
    Object.keys(ruleDefinitions).forEach(ruleId => {
      allDisabled[ruleId] = false;
    });
    setRules(allDisabled);
  };

  /**
   * Filter rules based on current filter and search
   */
  const getFilteredRules = () => {
    const ruleIds = Object.keys(ruleDefinitions);
    
    return ruleIds.filter(ruleId => {
      const definition = ruleDefinitions[ruleId];
      const isEnabled = rules[ruleId] === true;

      // Apply filter
      if (rulesFilter === 'enabled' && !isEnabled) return false;
      if (rulesFilter === 'disabled' && isEnabled) return false;

      // Apply search
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesRule = ruleId.toLowerCase().includes(searchLower);
        const matchesName = definition.name?.toLowerCase().includes(searchLower);
        const matchesDesc = definition.description?.toLowerCase().includes(searchLower);
        return matchesRule || matchesName || matchesDesc;
      }

      return true;
    });
  };

  /**
   * Group rules by category
   */
  const getRulesByCategory = () => {
    const filtered = getFilteredRules();
    const grouped = {};

    filtered.forEach(ruleId => {
      const definition = ruleDefinitions[ruleId];
      const category = definition.category || 'general';
      
      if (!grouped[category]) {
        grouped[category] = [];
      }
      
      grouped[category].push(ruleId);
    });

    return grouped;
  };

  /**
   * Render rule item
   */
  const renderRuleItem = (ruleId) => {
    const definition = ruleDefinitions[ruleId];
    const isEnabled = rules[ruleId] === true;

    return (
      <div key={ruleId} className="d-flex align-items-center justify-content-between py-2 border-bottom">
        <div className="flex-grow-1">
          <div className="d-flex align-items-center gap-2">
            <code className="text-primary">{ruleId}</code>
            {definition.fixable && (
              <Badge bg="success" text="light" className="small">
                Auto-fixable
              </Badge>
            )}
          </div>
          <div className="text-muted small">
            <strong>{definition.name}</strong> - {definition.description}
          </div>
        </div>
        <Form.Check
          type="switch"
          checked={isEnabled}
          onChange={(e) => handleRuleToggle(ruleId, e.target.checked)}
          className="ms-2"
        />
      </div>
    );
  };

  if (loading) {
    return (
      <div className="text-center py-4">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
        <div className="mt-2">Loading markdown linting configuration...</div>
      </div>
    );
  }

  const rulesByCategory = getRulesByCategory();
  const enabledCount = Object.values(rules).filter(Boolean).length;
  const totalCount = Object.keys(ruleDefinitions).length;

  return (
    <div>
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h5 className="mb-1">Markdown Linting Rules</h5>
          <small className="text-muted">
            Configure which markdown linting rules are enabled by default.
            These settings apply to all documents unless overridden at the category or folder level.
          </small>
        </div>
        <Badge bg="primary" className="fs-6">
          {enabledCount} / {totalCount} enabled
        </Badge>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Controls */}
      <Card className="mb-3">
        <Card.Body>
          <Row className="align-items-center">
            <Col md={4}>
              <Form.Group>
                <Form.Label className="small fw-bold">Filter Rules</Form.Label>
                <Form.Select
                  size="sm"
                  value={rulesFilter}
                  onChange={(e) => setRulesFilter(e.target.value)}
                >
                  <option value="all">All Rules</option>
                  <option value="enabled">Enabled Only</option>
                  <option value="disabled">Disabled Only</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label className="small fw-bold">Search</Form.Label>
                <Form.Control
                  size="sm"
                  type="text"
                  placeholder="Search rules..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Label className="small fw-bold">Quick Actions</Form.Label>
              <div className="d-flex gap-1">
                <Button size="sm" variant="outline-success" onClick={enableAllRules}>
                  All On
                </Button>
                <Button size="sm" variant="outline-danger" onClick={disableAllRules}>
                  All Off
                </Button>
                <Button size="sm" variant="outline-secondary" onClick={resetToDefaults}>
                  Defaults
                </Button>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Rules List */}
      <Card>
        <Card.Body>
          {Object.keys(rulesByCategory).length === 0 ? (
            <div className="text-center text-muted py-4">
              <i className="bi bi-search fs-1 mb-2"></i>
              <div>No rules match your current filter criteria.</div>
            </div>
          ) : (
            <Accordion>
              {Object.entries(rulesByCategory).map(([category, ruleIds]) => (
                <Accordion.Item key={category} eventKey={category}>
                  <Accordion.Header>
                    <div className="d-flex align-items-center justify-content-between w-100 me-3">
                      <span className="text-capitalize fw-bold">{category}</span>
                      <Badge bg="secondary">{ruleIds.length}</Badge>
                    </div>
                  </Accordion.Header>
                  <Accordion.Body>
                    {ruleIds.map(renderRuleItem)}
                  </Accordion.Body>
                </Accordion.Item>
              ))}
            </Accordion>
          )}
        </Card.Body>
      </Card>

      {/* Save Controls */}
      <div className="d-flex justify-content-end gap-2 mt-3">
        <Button variant="outline-secondary" onClick={loadData} disabled={saving}>
          <i className="bi bi-arrow-clockwise me-1"></i>
          Reload
        </Button>
        <Button variant="primary" onClick={saveRules} disabled={saving}>
          {saving ? (
            <>
              <Spinner animation="border" size="sm" className="me-1" />
              Saving...
            </>
          ) : (
            <>
              <i className="bi bi-check2 me-1"></i>
              Save Rules
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default MarkdownLintTab;