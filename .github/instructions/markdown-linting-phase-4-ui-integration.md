---
applyTo: "frontend/src/components/linting/**/*"
description: "Phase 4: UserSettingsModal Integration - MarkdownLintTab UI component and settings interface"
---

# Phase 4: UserSettingsModal Integration

## 🎯 **Phase Objective**
Create the MarkdownLintTab component and integrate it into the UserSettingsModal, providing a comprehensive UI for managing markdown linting rules. This includes rule categorization, configuration options, and hierarchical rule management.

## 📋 **Requirements Analysis**

### **UI Requirements**
- **Rule Organization**: Group rules by category (Headings, Lists, Code, etc.)
- **Configuration Interface**: Enable/disable rules and configure options
- **Hierarchy Display**: Show rule sources (folder, category, user, system)
- **Validation Feedback**: Real-time validation of rule configurations
- **Import/Export**: Future support for rule configuration sharing

### **Integration Points**
- **UserSettingsModal**: Add new tab for markdown linting
- **Rule Management**: Use MarkdownLintRulesService from Phase 3
- **Context Awareness**: Show current category/folder context
- **Persistence**: Save changes via API integration

## 🔧 **Implementation Tasks**

### **Task 4.1: Create MarkdownLintTab Component**
**File**: `frontend/src/components/linting/modals/MarkdownLintTab.jsx`

```javascript
import React, { useState, useEffect } from 'react';
import { Card, Form, Button, Row, Col, Badge, Alert, Accordion, ButtonGroup } from 'react-bootstrap';
import { useAuth } from '../../../providers/AuthProvider';
import useMarkdownLintRules from '../../../hooks/useMarkdownLintRules';
import MarkdownLintRulesService from '../../../services/linting/MarkdownLintRulesService';

function MarkdownLintTab() {
  const { user } = useAuth();

  // Get current context (category/folder) - this would come from document context
  const [currentCategoryId] = useState(null); // TODO: Get from DocumentContext
  const [currentFolderPath] = useState(null); // TODO: Get from DocumentContext

  const {
    rules,
    loading,
    error,
    updateCategoryRules,
    updateFolderRules,
    updateUserDefaults,
    validateRules,
    getRuleDefinitions
  } = useMarkdownLintRules(currentCategoryId, currentFolderPath);

  const [localRules, setLocalRules] = useState({});
  const [activeRuleLevel, setActiveRuleLevel] = useState('user'); // 'user', 'category', 'folder'
  const [success, setSuccess] = useState('');
  const [validationErrors, setValidationErrors] = useState([]);

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
  const ruleDefinitions = getRuleDefinitions();

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
    const validation = validateRules(localRules);
    setValidationErrors(validation.errors);
    return validation.valid;
  };

  /**
   * Save rules based on current level
   */
  const handleSave = async () => {
    if (!validateCurrentRules()) {
      return;
    }

    setSuccess('');

    try {
      switch (activeRuleLevel) {
        case 'user':
          await updateUserDefaults(localRules);
          setSuccess('User default rules updated successfully');
          break;
        case 'category':
          if (!currentCategoryId) {
            throw new Error('No category selected');
          }
          await updateCategoryRules(localRules);
          setSuccess('Category rules updated successfully');
          break;
        case 'folder':
          if (!currentFolderPath) {
            throw new Error('No folder selected');
          }
          await updateFolderRules(localRules);
          setSuccess('Folder rules updated successfully');
          break;
        default:
          throw new Error('Invalid rule level');
      }
    } catch (err) {
      // Error handling is done by the hook
      console.error('Failed to save rules:', err);
    }
  };

  /**
   * Reset to defaults
   */
  const handleReset = () => {
    const defaults = MarkdownLintRulesService.DEFAULT_RULES;
    setLocalRules({ ...defaults });
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
    const definition = ruleDefinitions[ruleId];
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
          <Row>
            <Col>
              <Form.Control
                type="number"
                size="sm"
                placeholder="Line length"
                value={currentValue.line_length || 80}
                onChange={(e) => handleRuleConfig(ruleId, {
                  ...currentValue,
                  line_length: parseInt(e.target.value)
                })}
              />
            </Col>
            <Col>
              <Form.Check
                type="checkbox"
                label="Code blocks"
                checked={currentValue.code_blocks !== false}
                onChange={(e) => handleRuleConfig(ruleId, {
                  ...currentValue,
                  code_blocks: e.target.checked
                })}
              />
            </Col>
          </Row>
        );

      default:
        return (
          <small className="text-muted">
            Configurable (see documentation)
          </small>
        );
    }
  };

  return (
    <Card className="mt-3">
      <Card.Header>
        <Row className="align-items-center">
          <Col>
            <h5 className="mb-0">
              <i className="bi bi-check2-square me-2"></i>
              Markdown Linting Rules
            </h5>
          </Col>
          <Col xs="auto">
            <ButtonGroup size="sm">
              <Button
                variant={activeRuleLevel === 'user' ? 'primary' : 'outline-primary'}
                onClick={() => setActiveRuleLevel('user')}
              >
                User Defaults
              </Button>
              <Button
                variant={activeRuleLevel === 'category' ? 'primary' : 'outline-primary'}
                onClick={() => setActiveRuleLevel('category')}
                disabled={!currentCategoryId}
              >
                Category
              </Button>
              <Button
                variant={activeRuleLevel === 'folder' ? 'primary' : 'outline-primary'}
                onClick={() => setActiveRuleLevel('folder')}
                disabled={!currentFolderPath}
              >
                Folder
              </Button>
            </ButtonGroup>
          </Col>
        </Row>
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
            Configuring <strong>{activeRuleLevel}</strong> level rules.
            {currentCategoryId && activeRuleLevel === 'category' && (
              <> Current category: <Badge bg="info">Category {currentCategoryId}</Badge></>
            )}
            {currentFolderPath && activeRuleLevel === 'folder' && (
              <> Current folder: <Badge bg="info">{currentFolderPath}</Badge></>
            )}
          </small>
        </div>

        <Accordion defaultActiveKey={['0']} alwaysOpen>
          {Object.entries(ruleCategories).map(([category, ruleIds], categoryIndex) => (
            <Accordion.Item key={category} eventKey={categoryIndex.toString()}>
              <Accordion.Header>
                {category}
                <Badge bg="secondary" className="ms-2">
                  {ruleIds.length} rules
                </Badge>
              </Accordion.Header>
              <Accordion.Body>
                {ruleIds.map(ruleId => {
                  const definition = ruleDefinitions[ruleId];
                  const status = getRuleStatus(ruleId);

                  return (
                    <Row key={ruleId} className="mb-3 align-items-start">
                      <Col md={3}>
                        <div className="d-flex align-items-center">
                          <Form.Check
                            type="switch"
                            id={`rule-${ruleId}`}
                            checked={status !== 'disabled'}
                            onChange={(e) => handleRuleToggle(ruleId, e.target.checked)}
                          />
                          <strong className="ms-2">{ruleId}</strong>
                          {definition?.fixable && (
                            <Badge bg="success" className="ms-2">Auto-fix</Badge>
                          )}
                        </div>
                      </Col>

                      <Col md={5}>
                        <div>
                          <div className="fw-medium">{definition?.name || ruleId}</div>
                          <small className="text-muted">
                            {definition?.description || 'No description available'}
                          </small>
                        </div>
                      </Col>

                      <Col md={3}>
                        {status === 'configured' && (
                          <Badge bg="info" className="mb-2">Configured</Badge>
                        )}
                        {status !== 'disabled' && renderRuleConfig(ruleId)}
                      </Col>

                      <Col md={1}>
                        {definition && (
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            onClick={() => window.open(
                              `https://github.com/DavidAnson/markdownlint/blob/main/doc/${ruleId.toLowerCase()}.md`,
                              '_blank'
                            )}
                            title="View documentation"
                          >
                            <i className="bi bi-question-circle"></i>
                          </Button>
                        )}
                      </Col>
                    </Row>
                  );
                })}
              </Accordion.Body>
            </Accordion.Item>
          ))}
        </Accordion>

        <div className="d-flex justify-content-between mt-4">
          <Button
            variant="outline-secondary"
            onClick={handleReset}
            disabled={loading}
          >
            Reset to Defaults
          </Button>

          <div>
            <Button
              variant="outline-primary"
              className="me-2"
              onClick={validateCurrentRules}
              disabled={loading}
            >
              Validate
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={loading || validationErrors.length > 0}
            >
              {loading ? 'Saving...' : 'Save Rules'}
            </Button>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
}

export default MarkdownLintTab;
```

### **Task 4.2: Update UserSettingsModal Integration**
**File**: `frontend/src/components/user/modals/UserSettingsModal.jsx`

Add the markdown linting tab to the existing modal:

```javascript
// Add import
import MarkdownLintTab from "../../linting/modals/MarkdownLintTab";

// Add to Nav.Item section (around line 100)
<Nav.Item>
  <Nav.Link eventKey="markdown-linting">
    <i className="bi bi-check2-square me-1"></i>Markdown Linting
  </Nav.Link>
</Nav.Item>

// Add to Tab.Content section (around line 140)
<Tab.Pane eventKey="markdown-linting">
  <MarkdownLintTab />
</Tab.Pane>
```

### **Task 4.3: Create Rule Configuration Components**
**File**: `frontend/src/components/linting/RuleConfigInput.jsx`

```javascript
import React from 'react';
import { Form, Row, Col } from 'react-bootstrap';

/**
 * Generic rule configuration input component
 * Handles different types of rule configuration options
 */
function RuleConfigInput({ ruleId, definition, value, onChange }) {
  if (!definition?.configurable || typeof value !== 'object') {
    return null;
  }

  const handleChange = (key, newValue) => {
    onChange({
      ...value,
      [key]: newValue
    });
  };

  // Render configuration based on rule definition
  if (definition.options) {
    if (Array.isArray(definition.options)) {
      // Simple select from array
      return (
        <Form.Select
          size="sm"
          value={value[Object.keys(value)[0]] || definition.options[0]}
          onChange={(e) => handleChange(Object.keys(value)[0] || 'style', e.target.value)}
        >
          {definition.options.map(option => (
            <option key={option} value={option}>
              {option.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </option>
          ))}
        </Form.Select>
      );
    }

    // Object-based options with types
    return (
      <Row>
        {Object.entries(definition.options).map(([key, type]) => (
          <Col key={key}>
            {type === 'number' ? (
              <Form.Control
                type="number"
                size="sm"
                placeholder={key.replace(/_/g, ' ')}
                value={value[key] || ''}
                onChange={(e) => handleChange(key, parseInt(e.target.value) || 0)}
              />
            ) : type === 'boolean' ? (
              <Form.Check
                type="checkbox"
                label={key.replace(/_/g, ' ')}
                checked={value[key] !== false}
                onChange={(e) => handleChange(key, e.target.checked)}
              />
            ) : (
              <Form.Control
                type="text"
                size="sm"
                placeholder={key.replace(/_/g, ' ')}
                value={value[key] || ''}
                onChange={(e) => handleChange(key, e.target.value)}
              />
            )}
          </Col>
        ))}
      </Row>
    );
  }

  return (
    <small className="text-muted">
      Configurable (see documentation)
    </small>
  );
}

export default RuleConfigInput;
```

### **Task 4.4: Create Rule Import/Export Utility**
**File**: `frontend/src/components/linting/RuleImportExport.jsx`

```javascript
import React, { useState } from 'react';
import { Button, Modal, Form, Alert } from 'react-bootstrap';
import MarkdownLintRulesService from '../../services/linting/MarkdownLintRulesService';

/**
 * Component for importing and exporting rule configurations
 */
function RuleImportExport({ currentRules, onImport }) {
  const [showModal, setShowModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [error, setError] = useState('');

  const handleExport = () => {
    const exportData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      rules: currentRules
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'markdownlint-rules.json';
    link.click();

    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    setError('');

    try {
      const importData = JSON.parse(importText);

      if (!importData.rules) {
        throw new Error('Invalid format: missing rules object');
      }

      // Validate rules
      const validation = MarkdownLintRulesService.validateRules(importData.rules);
      if (!validation.valid) {
        throw new Error(`Invalid rules: ${validation.errors.join(', ')}`);
      }

      onImport(importData.rules);
      setShowModal(false);
      setImportText('');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <Button
        variant="outline-secondary"
        size="sm"
        onClick={() => setShowModal(true)}
        className="me-2"
      >
        <i className="bi bi-upload me-1"></i>
        Import/Export
      </Button>

      <Button
        variant="outline-secondary"
        size="sm"
        onClick={handleExport}
      >
        <i className="bi bi-download me-1"></i>
        Export
      </Button>

      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Import Rule Configuration</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <Form.Group>
            <Form.Label>Paste exported configuration JSON:</Form.Label>
            <Form.Control
              as="textarea"
              rows={10}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Paste JSON configuration here..."
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleImport}
            disabled={!importText.trim()}
          >
            Import
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default RuleImportExport;
```

### **Task 4.5: Create Linting Directory Structure**
Create the directory structure for linting components:

```bash
mkdir -p frontend/src/components/linting/modals
mkdir -p frontend/src/components/linting/inputs
mkdir -p frontend/src/components/linting/utils
```

### **Task 4.6: Update Component Index**
**File**: `frontend/src/components/linting/index.js`

```javascript
// Export linting components
export { default as MarkdownLintTab } from './modals/MarkdownLintTab';
export { default as RuleConfigInput } from './RuleConfigInput';
export { default as RuleImportExport } from './RuleImportExport';

// Future exports
// export { default as RulePresets } from './RulePresets';
// export { default as RulesDiff } from './RulesDiff';
```

## ✅ **Verification Steps**

1. **Tab Integration**: Verify new tab appears in UserSettingsModal
2. **Rule Display**: Confirm all rule categories display correctly
3. **Configuration**: Test rule enable/disable and configuration options
4. **Validation**: Verify rule validation works and shows errors
5. **Persistence**: Confirm rule changes save and load correctly
6. **Import/Export**: Test rule configuration export and import

## 🔗 **Integration Points**

- **Previous Phase**: Uses MarkdownLintRulesService from Phase 3
- **Next Phase**: Phase 5 will integrate with editor to apply these rules
- **UserSettingsModal**: Extends existing modal with new functionality
- **DocumentContext**: Future integration for category/folder awareness

## 🎨 **UI/UX Considerations**

- **Accordion Layout**: Organized rule categories for better navigation
- **Visual Feedback**: Status badges and icons for rule states
- **Context Awareness**: Clear indication of rule level being edited
- **Validation**: Real-time validation with clear error messages
- **Documentation**: Quick access to rule documentation

## 📱 **Responsive Design**

- **Mobile-friendly**: Accordion collapses for better mobile experience
- **Flexible Layout**: Responsive grid adapts to different screen sizes
- **Touch-friendly**: Adequate spacing for touch interactions

This phase provides a comprehensive UI for managing markdown linting rules, making it easy for users to customize their linting experience while maintaining a consistent interface with the existing application.