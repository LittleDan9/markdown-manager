/**
 * MarkdownLintTab - Settings interface for markdown linting configuration
 *
 * Provides UI for managing user default markdown linting rules.
 */

import React, { useState, useEffect } from 'react';
import { Card, Form, Button, Alert, Spinner, Accordion } from 'react-bootstrap';
import PropTypes from 'prop-types';
import { useAuth } from '../../../providers/AuthProvider';
import useMarkdownLintRules from '../../../hooks/useMarkdownLintRules';
import MarkdownLintRulesService from '../../../services/linting/MarkdownLintRulesService';
import RuleConfigInput from '../RuleConfigInput';
import RuleImportExport from '../RuleImportExport';
import { useNotification } from '../../NotificationProvider';

const MarkdownLintTab = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();

  const {
    rules,
    loading,
    error,
    updateUserDefaults,
    validateRules,
    getRuleDefinitions
  } = useMarkdownLintRules();

  const [localRules, setLocalRules] = useState({});
  const [success, setSuccess] = useState('');
  const [validationErrors, setValidationErrors] = useState([]);
  const [saving, setSaving] = useState(false);

  // Rule categories for organization
  const ruleCategories = {
    'Headings': ['MD001', 'MD003', 'MD018', 'MD019', 'MD020', 'MD021', 'MD022', 'MD023', 'MD024', 'MD025', 'MD026'],
    'Lists': ['MD004', 'MD005', 'MD007', 'MD029', 'MD030', 'MD032'],
    'Spacing': ['MD009', 'MD010', 'MD012', 'MD027'],
    'Links & Images': ['MD011', 'MD034', 'MD039', 'MD042', 'MD045', 'MD051', 'MD052', 'MD053'],
    'Code': ['MD031', 'MD040', 'MD046', 'MD048'],
    'Style': ['MD013', 'MD033', 'MD035', 'MD036', 'MD037', 'MD038', 'MD047', 'MD049', 'MD050'],
    'Tables': ['MD054', 'MD055', 'MD056', 'MD058']
  };

  // Initialize local rules when component mounts or rules change
  useEffect(() => {
    setLocalRules({ ...rules });
  }, [rules]);

  // Get rule definitions for descriptions and configuration options
  const ruleDefinitions = getRuleDefinitions ? getRuleDefinitions() : {};

  // Fallback rule definitions if not available from the hook
  const fallbackDefinitions = {
    'MD001': { description: 'Heading levels should only increment by one level at a time', configurable: false },
    'MD003': { description: 'Heading style should be consistent', configurable: true },
    'MD004': { description: 'Unordered list style should be consistent', configurable: true },
    'MD005': { description: 'Inconsistent indentation for list items at the same level', configurable: false },
    'MD007': { description: 'Unordered list indentation should be consistent', configurable: true },
    'MD009': { description: 'Trailing spaces should not be present', configurable: false },
    'MD010': { description: 'Hard tabs should not be used', configurable: false },
    'MD012': { description: 'Multiple consecutive blank lines should not be present', configurable: true },
    'MD013': { description: 'Line length should not exceed configured limit', configurable: true },
    'MD018': { description: 'No space after hash on atx style heading', configurable: false },
    'MD019': { description: 'Multiple spaces after hash on atx style heading', configurable: false },
    'MD020': { description: 'No space inside hashes on closed atx style heading', configurable: false },
    'MD021': { description: 'Multiple spaces inside hashes on closed atx style heading', configurable: false },
    'MD022': { description: 'Headings should be surrounded by blank lines', configurable: false },
    'MD023': { description: 'Headings must start at the beginning of the line', configurable: false },
    'MD024': { description: 'Multiple headings with the same content', configurable: false },
    'MD025': { description: 'Multiple top level headings in the same document', configurable: false },
    'MD026': { description: 'Trailing punctuation in heading', configurable: false },
    'MD027': { description: 'Multiple spaces after blockquote symbol', configurable: false },
    'MD029': { description: 'Ordered list item prefix should be consistent', configurable: true },
    'MD030': { description: 'Spaces after list markers should be consistent', configurable: false },
    'MD031': { description: 'Fenced code blocks should be surrounded by blank lines', configurable: false },
    'MD032': { description: 'Lists should be surrounded by blank lines', configurable: false },
    'MD033': { description: 'Inline HTML should not be used', configurable: false },
    'MD034': { description: 'Bare URL used instead of link syntax', configurable: false },
    'MD035': { description: 'Horizontal rule style should be consistent', configurable: false },
    'MD036': { description: 'Emphasis used instead of a heading', configurable: false },
    'MD037': { description: 'Spaces inside emphasis markers', configurable: false },
    'MD038': { description: 'Spaces inside code span elements', configurable: false },
    'MD039': { description: 'Spaces inside link text', configurable: false },
    'MD040': { description: 'Fenced code blocks should have a language specified', configurable: false },
    'MD042': { description: 'No empty links', configurable: false },
    'MD045': { description: 'Images should have alternate text (alt text)', configurable: false },
    'MD046': { description: 'Code block style should be consistent', configurable: true },
    'MD047': { description: 'File should end with a single newline character', configurable: false },
    'MD048': { description: 'Code fence style should be consistent', configurable: true },
    'MD049': { description: 'Emphasis style should be consistent', configurable: true },
    'MD050': { description: 'Strong style should be consistent', configurable: true },
    'MD051': { description: 'Link fragments should be valid', configurable: false },
    'MD052': { description: 'Reference links and images should use a label that is defined', configurable: false },
    'MD053': { description: 'Link and image reference definitions should be needed', configurable: false },
    'MD054': { description: 'Link and image style should be consistent', configurable: false },
    'MD055': { description: 'Table row should have a pipe character at the beginning and end', configurable: false },
    'MD056': { description: 'Table column count should be consistent', configurable: false },
    'MD058': { description: 'Table rows should have the same number of cells', configurable: false }
  };

  const effectiveDefinitions = Object.keys(ruleDefinitions).length > 0 ? ruleDefinitions : fallbackDefinitions;

  /**
   * Handle rule toggle (enable/disable)
   */
  const handleRuleToggle = (ruleId, enabled) => {
    setLocalRules(prev => ({
      ...prev,
      [ruleId]: enabled
    }));
    setValidationErrors([]);
  };

  /**
   * Handle rule configuration change
   */
  const handleRuleConfig = (ruleId, config) => {
    setLocalRules(prev => ({
      ...prev,
      [ruleId]: config
    }));
    setValidationErrors([]);
  };

  /**
   * Validate current rule configuration
   */
  const validateCurrentRules = () => {
    if (validateRules) {
      const validation = validateRules(localRules);
      setValidationErrors(validation.errors || []);
      return validation.valid !== false;
    } else {
      // Fallback validation - just ensure rules are objects/booleans
      const errors = [];
      Object.entries(localRules).forEach(([ruleId, value]) => {
        if (value !== true && value !== false && typeof value !== 'object') {
          errors.push(`Invalid value for rule ${ruleId}: ${value}`);
        }
      });
      setValidationErrors(errors);
      return errors.length === 0;
    }
  };

  /**
   * Save rules based on current level
   */
  const handleSave = async () => {
    if (!validateCurrentRules()) {
      return;
    }

    setSaving(true);
    setSuccess('');

    try {
      await updateUserDefaults(localRules);
      setSuccess('User default rules updated successfully');
      showSuccess('User default rules updated successfully');
    } catch (err) {
      // Error handling is done by the hook
      showError('Failed to save markdown linting rules');
      console.error('Failed to save rules:', err);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Reset to defaults
   */
  const handleReset = () => {
    const defaults = MarkdownLintRulesService.getDefaultRules();
    setLocalRules({ ...defaults });
    setValidationErrors([]);
  };

  /**
   * Handle import
   */
  const handleImport = (importedRules) => {
    setLocalRules({ ...importedRules });
    setValidationErrors([]);
  };

  /**
   * Get rule status (enabled/disabled/configured)
   */
  const getRuleStatus = (ruleId) => {
    const value = localRules[ruleId];
    if (value === false) return 'disabled';
    if (value === true) return 'enabled';
    if (typeof value === 'object') return 'configured';
    return 'default';
  };

  /**
   * Get rule configuration component
   */
  const renderRuleConfig = (ruleId) => {
    const definition = effectiveDefinitions[ruleId];
    const currentValue = localRules[ruleId];

    if (!definition || !definition.configurable || typeof currentValue !== 'object') {
      return null;
    }

    // Render specific configuration UI based on rule
    switch (ruleId) {
      case 'MD003': // heading-style
        return (
          <Form.Select
            size="sm"
            value={currentValue.style || 'atx'}
            onChange={(e) => handleRuleConfig(ruleId, { style: e.target.value })}
          >
            <option value="atx">ATX (# ## ###)</option>
            <option value="atx_closed">ATX Closed (# ## # ### #)</option>
            <option value="setext">Setext (underlined)</option>
            <option value="setext_with_atx">Setext + ATX</option>
          </Form.Select>
        );

      case 'MD004': // ul-style
        return (
          <Form.Select
            size="sm"
            value={currentValue.style || 'dash'}
            onChange={(e) => handleRuleConfig(ruleId, { style: e.target.value })}
          >
            <option value="dash">Dash (-)</option>
            <option value="asterisk">Asterisk (*)</option>
            <option value="plus">Plus (+)</option>
            <option value="consistent">Consistent</option>
          </Form.Select>
        );

      case 'MD007': // ul-indent
        return (
          <Form.Control
            type="number"
            size="sm"
            min="1"
            max="8"
            value={currentValue.indent || 2}
            onChange={(e) => handleRuleConfig(ruleId, { indent: parseInt(e.target.value) })}
            style={{ width: '80px' }}
          />
        );

      case 'MD013': // line-length
        return (
          <div className="d-flex gap-2 align-items-center">
            <Form.Control
              type="number"
              size="sm"
              min="40"
              max="200"
              value={currentValue.line_length || 80}
              onChange={(e) => handleRuleConfig(ruleId, {
                ...currentValue,
                line_length: parseInt(e.target.value)
              })}
              style={{ width: '80px' }}
            />
            <Form.Check
              type="checkbox"
              checked={currentValue.code_blocks || false}
              onChange={(e) => handleRuleConfig(ruleId, {
                ...currentValue,
                code_blocks: e.target.checked
              })}
              label="Code blocks"
            />
          </div>
        );

      default:
        return (
          <RuleConfigInput
            ruleId={ruleId}
            definition={definition}
            value={currentValue}
            onChange={(config) => handleRuleConfig(ruleId, config)}
          />
        );
    }
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

  return (
    <Card className="mt-3">
      <Card.Header>
        <h5 className="mb-0">
          <i className="bi bi-check2-square me-2"></i>
          Markdown Linting Rules
        </h5>
      </Card.Header>

      <Card.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        {validationErrors.length > 0 && (
          <Alert variant="warning">
            <strong>Configuration Issues:</strong>
            <ul className="mb-0 mt-2">
              {validationErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </Alert>
        )}

        <div className="mb-3">
          <small className="text-muted">
            Configure your default markdown linting rules. These rules will be applied to all your documents.
          </small>
        </div>

        <Accordion defaultActiveKey={['0']} alwaysOpen>
          {Object.entries(ruleCategories).map(([category, ruleIds], categoryIndex) => (
            <Accordion.Item key={category} eventKey={categoryIndex.toString()}>
              <Accordion.Header>
                <div className="d-flex justify-content-between align-items-center w-100 me-3">
                  <span>{category}</span>
                  <div>
                    <span className="badge bg-secondary me-2">
                      {ruleIds.filter(id => getRuleStatus(id) === 'enabled').length} enabled
                    </span>
                    <span className="badge bg-info">
                      {ruleIds.filter(id => getRuleStatus(id) === 'configured').length} configured
                    </span>
                  </div>
                </div>
              </Accordion.Header>
              <Accordion.Body>
                {ruleIds.map(ruleId => {
                  const definition = effectiveDefinitions[ruleId];
                  const status = getRuleStatus(ruleId);
                  const isEnabled = localRules[ruleId] !== false;

                  return (
                    <div key={ruleId} className="border-bottom py-2">
                      <div className="d-flex align-items-center">
                        <div className="flex-shrink-0" style={{ width: '200px' }}>
                          <Form.Check
                            type="switch"
                            id={`rule-${ruleId}`}
                            checked={isEnabled}
                            onChange={(e) => handleRuleToggle(ruleId, e.target.checked)}
                            label={
                              <span>
                                <code>{ruleId}</code>
                                {status === 'configured' && (
                                  <span className="badge bg-info ms-1" style={{ fontSize: '0.6em' }}>Configured</span>
                                )}
                              </span>
                            }
                          />
                        </div>
                        <div className="flex-fill px-3">
                          <small className="text-muted">
                            {definition?.description || 'No description available'}
                          </small>
                        </div>
                        <div className="flex-shrink-0">
                          {isEnabled && renderRuleConfig(ruleId)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </Accordion.Body>
            </Accordion.Item>
          ))}
        </Accordion>

        <div className="d-flex justify-content-between mt-4">
          <div>
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={handleReset}
              disabled={loading}
              className="me-2"
            >
              Reset to Defaults
            </Button>
            <RuleImportExport
              currentRules={localRules}
              onImport={handleImport}
            />
          </div>

          <div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={loading || validationErrors.length > 0 || saving}
            >
              {saving ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Saving...
                </>
              ) : (
                'Save Rules'
              )}
            </Button>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
};

MarkdownLintTab.propTypes = {
  // Add any prop types if needed in the future
};

export default MarkdownLintTab;