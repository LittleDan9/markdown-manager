/**
 * MarkdownLintTab - Settings interface for markdown linting configuration
 *
 * Provides UI for managing user default markdown linting rules.
 */

import React, { useState, useEffect } from 'react';
import { Card, Form, Button, Alert, Spinner, Accordion } from 'react-bootstrap';
import { useAuth } from '../../../providers/AuthProvider';
import useMarkdownLintRules from '../../../hooks/useMarkdownLintRules';
import RuleImportExport from '../RuleImportExport';
import { useNotification } from '../../NotificationProvider';

// Fallback rule definitions if not available from the API
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

const MarkdownLintTab = () => {
  const { _user } = useAuth();
  const { showSuccess, showError } = useNotification();

  const {
    rules,
    enabled,
    loading,
    error,
    loadRules,
    saveRules,
    resetToDefaults,
    validateRules,
    getRuleDefinitions
  } = useMarkdownLintRules();

  const [localRules, setLocalRules] = useState({});
  const [localEnabled, setLocalEnabled] = useState(true);
  const [success, setSuccess] = useState('');
  const [validationErrors, setValidationErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [ruleDefinitions, setRuleDefinitions] = useState({});

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
    console.log('MarkdownLintTab: rules from hook changed, updating localRules:', rules);
    console.log('MarkdownLintTab: enabled from hook:', enabled);
    setLocalRules(rules ? { ...rules } : {});
    setLocalEnabled(enabled !== false); // Default to true if undefined
  }, [rules, enabled]);

  // Load rules when component mounts
  useEffect(() => {
    console.log('MarkdownLintTab: component mounted, loading rules and definitions');
    console.log('MarkdownLintTab: loadRules function available:', typeof loadRules);
    console.log('MarkdownLintTab: getRuleDefinitions function available:', typeof getRuleDefinitions);

    if (loadRules) {
      loadRules();
    } else {
      console.error('MarkdownLintTab: loadRules function not available!');
    }

    // Load rule definitions from API
    if (getRuleDefinitions) {
      getRuleDefinitions().then(definitions => {
        console.log('MarkdownLintTab: loaded rule definitions:', definitions);
        setRuleDefinitions(definitions);
      }).catch(error => {
        console.warn('MarkdownLintTab: failed to load rule definitions:', error);
        setRuleDefinitions({});
      });
    }
  }, [loadRules, getRuleDefinitions]);

  // Get rule definitions for descriptions and configuration options
  // Fallback rule definitions if not available from the API (moved outside component)

  // Compute effective definitions each render to ensure it updates when ruleDefinitions changes
  const effectiveDefinitions = React.useMemo(() => {
    const hasApiDefinitions = ruleDefinitions && Object.keys(ruleDefinitions).length > 0;

    if (hasApiDefinitions) {
      // Merge API definitions with fallback to ensure configurable field is preserved
      const merged = {};
      Object.keys(fallbackDefinitions).forEach(ruleId => {
        merged[ruleId] = {
          ...fallbackDefinitions[ruleId], // Start with fallback (has configurable field)
          ...(ruleDefinitions[ruleId] || {}) // Override with API data if available
        };
      });

      // Add any additional rules from API that aren't in fallback
      Object.keys(ruleDefinitions).forEach(ruleId => {
        if (!merged[ruleId]) {
          merged[ruleId] = ruleDefinitions[ruleId];
        }
      });

      console.log('Using merged definitions. MD003:', merged.MD003);
      return merged;
    }

    console.log('Using fallback definitions. MD003:', fallbackDefinitions.MD003);
    return fallbackDefinitions;
  }, [ruleDefinitions]);

  /**
   * Handle rule toggle (enable/disable)
   */
  const handleRuleToggle = (ruleId, enabled) => {
    setLocalRules(prev => ({
      ...(prev || {}),
      [ruleId]: enabled
    }));
    setValidationErrors([]);
  };

  /**
   * Handle rule configuration change
   */
  const handleRuleConfig = (ruleId, config) => {
    setLocalRules(prev => ({
      ...(prev || {}),
      [ruleId]: config
    }));
    setValidationErrors([]);
  };

  /**
   * Enable all rules in a category
   */
  const handleCategoryEnableAll = (categoryRuleIds) => {
    setLocalRules(prev => {
      const updated = { ...(prev || {}) };
      categoryRuleIds.forEach(ruleId => {
        updated[ruleId] = true;
      });
      return updated;
    });
    setValidationErrors([]);
  };

  /**
   * Disable all rules in a category
   */
  const handleCategoryDisableAll = (categoryRuleIds) => {
    setLocalRules(prev => {
      const updated = { ...(prev || {}) };
      categoryRuleIds.forEach(ruleId => {
        updated[ruleId] = false;
      });
      return updated;
    });
    setValidationErrors([]);
  };

  /**
   * Check if all rules in a category are enabled
   */
  const isCategoryAllEnabled = (categoryRuleIds) => {
    return categoryRuleIds.every(ruleId => {
      const value = localRules && localRules[ruleId];
      return value === true || (typeof value === 'object' && value !== null);
    });
  };

  /**
   * Check if all rules in a category are disabled
   */
  const isCategoryAllDisabled = (categoryRuleIds) => {
    return categoryRuleIds.every(ruleId => {
      const value = localRules && localRules[ruleId];
      return value === false || value === undefined;
    });
  };

  /**
   * Toggle all rules in a category - if mostly enabled, disable all; if mostly disabled, enable all
   */
  const handleCategoryToggle = (categoryRuleIds) => {
    const enabledCount = categoryRuleIds.filter(ruleId => {
      const value = localRules && localRules[ruleId];
      return value === true || (typeof value === 'object' && value !== null);
    }).length;

    // If more than half are enabled, disable all; otherwise enable all
    if (enabledCount > categoryRuleIds.length / 2) {
      handleCategoryDisableAll(categoryRuleIds);
    } else {
      handleCategoryEnableAll(categoryRuleIds);
    }
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
      if (localRules) {
        Object.entries(localRules).forEach(([ruleId, value]) => {
          if (value !== true && value !== false && typeof value !== 'object') {
            errors.push(`Invalid value for rule ${ruleId}: ${value}`);
          }
        });
      }
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
      await saveRules(localRules, localEnabled, 'User default markdown lint rules');
      setSuccess('User default rules updated successfully');
      showSuccess('User default rules updated successfully');

      console.log('Save completed, rules updated successfully');
    } catch (err) {
      // Error handling is done by the hook
      showError('Failed to save markdown linting rules');
      console.error('Failed to save rules:', err);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Reset to defaults (load recommended defaults)
   */
  const handleReset = async () => {
    try {
      console.log('MarkdownLintTab: resetting to defaults');
      await resetToDefaults();
      setSuccess('Rules reset to recommended defaults');
      showSuccess('Rules reset to recommended defaults');
    } catch (error) {
      console.error('MarkdownLintTab: error resetting to defaults:', error);
      showError('Failed to reset to defaults');
    }
    setValidationErrors([]);
  };

  /**
   * Handle import
   */
  const handleImport = (importedRules) => {
    setLocalRules(importedRules ? { ...importedRules } : {});
    setValidationErrors([]);
  };

  /**
   * Get rule status (enabled/disabled/configured)
   */
  const getRuleStatus = (ruleId) => {
    if (!localRules) return 'disabled';
    const value = localRules[ruleId];
    const definition = effectiveDefinitions[ruleId];

    if (value === false) return 'disabled';
    if (!value) return 'disabled'; // undefined or null

    // If the rule is configurable and enabled (true or object), show as configured
    if (definition?.configurable && value) return 'configured';

    // Otherwise, just enabled
    if (value === true) return 'enabled';
    if (typeof value === 'object' && value !== null) return 'configured';

    return 'disabled';
  };

  /**
   * Get rule configuration component
   */
  const renderRuleConfig = (ruleId) => {
    const definition = effectiveDefinitions[ruleId];
    const currentValue = localRules && Object.prototype.hasOwnProperty.call(localRules, ruleId) ? localRules[ruleId] : undefined;

    // Only show config for configurable rules that are enabled (true or object)
    if (!definition || !definition.configurable || !currentValue || currentValue === false) {
      return null;
    }

    // If rule is just enabled (true), use default configuration object
    const configValue = typeof currentValue === 'object' ? currentValue : {};

    // Render specific configuration UI based on rule
    switch (ruleId) {
      case 'MD003': // heading-style
        return (
          <Form.Select
            size="sm"
            value={configValue.style || 'atx'}
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
            value={configValue.style || 'dash'}
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
            value={configValue.indent || 2}
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
              value={(configValue && configValue.line_length) || 80}
              onChange={(e) => handleRuleConfig(ruleId, {
                ...(configValue || {}),
                line_length: parseInt(e.target.value)
              })}
              style={{ width: '80px' }}
            />
            <Form.Check
              type="checkbox"
              checked={(configValue && configValue.code_blocks) || false}
              onChange={(e) => handleRuleConfig(ruleId, {
                ...(configValue || {}),
                code_blocks: e.target.checked
              })}
              label="Code blocks"
            />
          </div>
        );

      case 'MD012': // multiple-blank-lines
        return (
          <Form.Control
            type="number"
            size="sm"
            min="1"
            max="10"
            value={configValue.maximum || 1}
            onChange={(e) => handleRuleConfig(ruleId, { maximum: parseInt(e.target.value) })}
            style={{ width: '80px' }}
          />
        );

      case 'MD029': // ol-prefix
        return (
          <Form.Select
            size="sm"
            value={configValue.style || 'one_or_ordered'}
            onChange={(e) => handleRuleConfig(ruleId, { style: e.target.value })}
          >
            <option value="one">One (1. 1. 1.)</option>
            <option value="ordered">Ordered (1. 2. 3.)</option>
            <option value="one_or_ordered">One or Ordered</option>
          </Form.Select>
        );

      case 'MD046': // code-block-style
        return (
          <Form.Select
            size="sm"
            value={configValue.style || 'consistent'}
            onChange={(e) => handleRuleConfig(ruleId, { style: e.target.value })}
          >
            <option value="indented">Indented (4 spaces)</option>
            <option value="fenced">Fenced (```)</option>
            <option value="consistent">Consistent</option>
          </Form.Select>
        );

      case 'MD048': // code-fence-style
        return (
          <Form.Select
            size="sm"
            value={configValue.style || 'backtick'}
            onChange={(e) => handleRuleConfig(ruleId, { style: e.target.value })}
          >
            <option value="backtick">Backtick (```)</option>
            <option value="tilde">Tilde (~~~)</option>
            <option value="consistent">Consistent</option>
          </Form.Select>
        );

      case 'MD049': // emphasis-style
        return (
          <Form.Select
            size="sm"
            value={configValue.style || 'asterisk'}
            onChange={(e) => handleRuleConfig(ruleId, { style: e.target.value })}
          >
            <option value="asterisk">Asterisk (*text*)</option>
            <option value="underscore">Underscore (_text_)</option>
            <option value="consistent">Consistent</option>
          </Form.Select>
        );

      case 'MD050': // strong-style
        return (
          <Form.Select
            size="sm"
            value={configValue.style || 'asterisk'}
            onChange={(e) => handleRuleConfig(ruleId, { style: e.target.value })}
          >
            <option value="asterisk">Asterisk (**text**)</option>
            <option value="underscore">Underscore (__text__)</option>
            <option value="consistent">Consistent</option>
          </Form.Select>
        );

      default:
        // For any other configurable rule, show a simple text input or message
        return (
          <small className="text-info">
            <i className="bi bi-gear me-1"></i>
            Configurable
          </small>
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

  // Debug info
  console.log('MarkdownLintTab: rendering with localRules:', localRules);
  console.log('MarkdownLintTab: localRules keys:', localRules ? Object.keys(localRules) : 'localRules is null/undefined');

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
          <div className="d-flex justify-content-between align-items-center mb-2">
            <div>
              <Form.Check
                type="switch"
                id="linting-enabled"
                checked={localEnabled}
                onChange={(e) => setLocalEnabled(e.target.checked)}
                label={
                  <span>
                    <strong>Enable Markdown Linting</strong>
                    <small className="text-muted d-block">
                      When enabled, your configured rules will be applied to all documents
                    </small>
                  </span>
                }
              />
            </div>
          </div>
          <small className="text-muted">
            Configure your default markdown linting rules below. These rules will be applied to all your documents when linting is enabled.
          </small>
        </div>

        <div
          className="accordion-scroll-container"
          style={{
            maxHeight: 'calc(70vh - 300px)',
            minHeight: '200px',
            overflowY: 'auto',
            paddingRight: '5px',
            marginRight: '-5px'
          }}
        >
          <Accordion defaultActiveKey={localEnabled ? ['0'] : []} alwaysOpen>
            {Object.entries(ruleCategories).map(([category, ruleIds], categoryIndex) => (
              <Accordion.Item key={category} eventKey={categoryIndex.toString()}>
                <Accordion.Header>
                  <div className="d-flex justify-content-between align-items-center w-100 me-3">
                    <span className={!localEnabled ? 'text-muted' : ''}>{category}</span>
                    <div className="d-flex align-items-center">
                      {localEnabled && (
                        <div
                          className="me-3"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <Form.Check
                            type="switch"
                            id={`category-toggle-${categoryIndex}`}
                            checked={isCategoryAllEnabled(ruleIds)}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleCategoryToggle(ruleIds);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            label={
                              <small style={{ fontSize: '0.8em', color: '#6c757d' }}>
                                {isCategoryAllEnabled(ruleIds) ? 'All enabled' :
                                 isCategoryAllDisabled(ruleIds) ? 'All disabled' : 'Mixed'}
                              </small>
                            }
                            style={{ fontSize: '0.8em' }}
                          />
                        </div>
                      )}
                      <div>
                        <span className={`badge ${localEnabled ? 'bg-secondary' : 'bg-light text-muted'} me-2`}>
                          {ruleIds.filter(id => getRuleStatus(id) === 'enabled').length} enabled
                        </span>
                        <span className={`badge ${localEnabled ? 'bg-info' : 'bg-light text-muted'}`}>
                          {ruleIds.filter(id => getRuleStatus(id) === 'configured').length} configured
                        </span>
                      </div>
                    </div>
                  </div>
                </Accordion.Header>
                <Accordion.Body>
                  {ruleIds.map(ruleId => {
                    const definition = effectiveDefinitions[ruleId];
                    const _status = getRuleStatus(ruleId);
                    const ruleValue = (localRules && localRules[ruleId]) || undefined;
                    // Only treat explicitly true or configured (object) rules as enabled
                    const isEnabled = ruleValue === true || (typeof ruleValue === 'object' && ruleValue !== null);

                    return (
                      <div key={ruleId} className="border-bottom py-2">
                        <div className="d-flex align-items-center">
                          <div className="flex-shrink-0" style={{ width: '200px' }}>
                            <Form.Check
                              type="switch"
                              id={`rule-${ruleId}`}
                              checked={isEnabled}
                              disabled={!localEnabled}
                              onChange={(e) => handleRuleToggle(ruleId, e.target.checked)}
                              label={
                                <span className={!localEnabled ? 'text-muted' : ''}>
                                  <code>{ruleId}</code>
                                  {definition?.configurable && (
                                    <span className="badge bg-info ms-1" style={{ fontSize: '0.7em', fontWeight: 'bold' }}>
                                      Configurable
                                    </span>
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
                            {isEnabled && localEnabled && definition?.configurable && (
                              <div className="d-flex align-items-center gap-2">
                                <small className="text-muted">Configure:</small>
                                {renderRuleConfig(ruleId)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </Accordion.Body>
              </Accordion.Item>
            ))}
          </Accordion>
        </div>

        <div className="d-flex justify-content-between mt-4">
          <div>
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={handleReset}
              disabled={loading || !localEnabled}
              className="me-2"
            >
              Reset to Defaults
            </Button>
            {localEnabled && (
              <RuleImportExport
                currentRules={localRules}
                onImport={handleImport}
                validateRules={validateRules}
              />
            )}
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
                'Save Configuration'
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