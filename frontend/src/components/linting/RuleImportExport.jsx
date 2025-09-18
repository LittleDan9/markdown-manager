import React, { useState } from 'react';
import { Button, Modal, Form, Alert } from 'react-bootstrap';
import PropTypes from 'prop-types';

/**
 * Component for importing and exporting rule configurations
 */
function RuleImportExport({ currentRules, onImport, validateRules }) {
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

      // Validate rules if validation function provided
      if (validateRules) {
        const validation = validateRules(importData.rules);
        if (!validation.valid) {
          throw new Error(`Invalid rules: ${validation.errors.join(', ')}`);
        }
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
        Import
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
              placeholder='{"version": "1.0", "rules": {...}}'
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

RuleImportExport.propTypes = {
  currentRules: PropTypes.object.isRequired,
  onImport: PropTypes.func.isRequired,
  validateRules: PropTypes.func
};

export default RuleImportExport;