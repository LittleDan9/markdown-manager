import React, { useState, useEffect } from 'react';
import { Form, Row, Col, Alert, Spinner, Card, Button } from 'react-bootstrap';
import { useGitHubSettings } from '../../../contexts/GitHubSettingsProvider';
import { useNotification } from '../../NotificationProvider';

export default function GitHubSettingsTab() {
  const {
    settings,
    loading,
    error,
    updateSettings,
    getOrCreateSettings,
    DEFAULT_SETTINGS
  } = useGitHubSettings();

  const { addNotification } = useNotification();

  const [formData, setFormData] = useState(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Update form data when settings change
  useEffect(() => {
    setFormData(settings);
    setHasChanges(false);
  }, [settings]);

  // Handle form field changes
  const handleChange = (field, value) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);

    // Check if there are changes from original settings
    const changed = Object.keys(newFormData).some(
      key => newFormData[key] !== settings[key]
    );
    setHasChanges(changed);
  };

  // Save settings
  const handleSave = async () => {
    try {
      setSaving(true);

      // Only send changed fields
      const changes = {};
      Object.keys(formData).forEach(key => {
        if (formData[key] !== settings[key]) {
          changes[key] = formData[key];
        }
      });

      if (Object.keys(changes).length === 0) {
        addNotification('No changes to save', 'info');
        return;
      }

      await updateSettings(changes);
      addNotification('GitHub settings saved successfully', 'success');
      setHasChanges(false);
    } catch (err) {
      console.error('Failed to save GitHub settings:', err);
      addNotification('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Reset to defaults
  const handleReset = () => {
    setFormData(DEFAULT_SETTINGS);
    setHasChanges(true);
  };

  // Initialize settings if they don't exist
  const handleInitialize = async () => {
    try {
      setSaving(true);
      await getOrCreateSettings();
      addNotification('GitHub settings initialized', 'success');
    } catch (err) {
      console.error('Failed to initialize GitHub settings:', err);
      addNotification('Failed to initialize settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
        <Spinner animation="border" variant="primary" />
        <span className="ms-2">Loading GitHub settings...</span>
      </div>
    );
  }

  return (
    <div className="github-settings-tab">
      {error && (
        <Alert variant="danger" className="mb-3">
          <Alert.Heading>Error Loading Settings</Alert.Heading>
          <p>{error}</p>
          <Button variant="outline-danger" size="sm" onClick={handleInitialize}>
            Initialize Default Settings
          </Button>
        </Alert>
      )}

      <Card>
        <Card.Header>
          <div className="d-flex justify-content-between align-items-center">
            <h5 className="mb-0">
              <i className="bi bi-gear me-2"></i>
              GitHub Integration Settings
            </h5>
            {hasChanges && (
              <div>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={handleReset}
                  className="me-2"
                >
                  Reset to Defaults
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Spinner size="sm" animation="border" className="me-1" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            )}
          </div>
        </Card.Header>

        <Card.Body>
          <Form>
            {/* Diagram Export Settings */}
            <Row className="mb-4">
              <Col>
                <h6 className="border-bottom pb-2">
                  <i className="bi bi-diagram-3 me-2"></i>
                  Diagram Export Settings
                </h6>

                <Form.Group className="mb-3">
                  <Form.Check
                    type="switch"
                    id="auto-convert-diagrams"
                    label="Auto-convert advanced diagrams for GitHub compatibility"
                    checked={formData.auto_convert_diagrams}
                    onChange={(e) => handleChange('auto_convert_diagrams', e.target.checked)}
                  />
                  <Form.Text className="text-muted">
                    Automatically convert architecture-beta diagrams and custom icons to static images when saving to GitHub.
                    This ensures your diagrams display correctly on GitHub, which doesn't support all Mermaid features.
                  </Form.Text>
                </Form.Group>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Diagram Export Format</Form.Label>
                      <Form.Select
                        value={formData.diagram_format}
                        onChange={(e) => handleChange('diagram_format', e.target.value)}
                        disabled={!formData.auto_convert_diagrams}
                      >
                        <option value="svg">SVG (Vector, smaller file size)</option>
                        <option value="png">PNG (Raster, better compatibility)</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Check
                        type="switch"
                        id="fallback-to-standard"
                        label="Fallback to standard diagrams"
                        checked={formData.fallback_to_standard}
                        onChange={(e) => handleChange('fallback_to_standard', e.target.checked)}
                        disabled={!formData.auto_convert_diagrams}
                      />
                      <Form.Text className="text-muted">
                        Convert architecture-beta to standard flowcharts when possible instead of images.
                      </Form.Text>
                    </Form.Group>
                  </Col>
                </Row>
              </Col>
            </Row>

            {/* Sync Settings */}
            <Row className="mb-4">
              <Col>
                <h6 className="border-bottom pb-2">
                  <i className="bi bi-arrow-repeat me-2"></i>
                  Synchronization Settings
                </h6>

                <Form.Group className="mb-3">
                  <Form.Check
                    type="switch"
                    id="auto-sync-enabled"
                    label="Enable automatic synchronization"
                    checked={formData.auto_sync_enabled}
                    onChange={(e) => handleChange('auto_sync_enabled', e.target.checked)}
                  />
                  <Form.Text className="text-muted">
                    Automatically sync changes with GitHub repositories when enabled.
                  </Form.Text>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Check
                    type="switch"
                    id="auto-push-enabled"
                    label="Automatically push changes"
                    checked={formData.auto_push_enabled}
                    onChange={(e) => handleChange('auto_push_enabled', e.target.checked)}
                    disabled={!formData.auto_sync_enabled}
                  />
                  <Form.Text className="text-muted">
                    Automatically push changes to GitHub instead of requiring manual review.
                  </Form.Text>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Default Commit Message Template</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="e.g., Update documentation via Markdown Manager"
                    value={formData.default_commit_message || ''}
                    onChange={(e) => handleChange('default_commit_message', e.target.value || null)}
                    disabled={!formData.auto_sync_enabled}
                  />
                  <Form.Text className="text-muted">
                    Template for commit messages when auto-sync is enabled. Leave empty to use dynamic messages.
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>

            {/* Information Panel */}
            <Alert variant="info">
              <Alert.Heading as="h6">
                <i className="bi bi-info-circle me-2"></i>
                About GitHub Integration Settings
              </Alert.Heading>
              <ul className="mb-0">
                <li><strong>Diagram Conversion:</strong> Advanced Mermaid features like architecture-beta and custom icons aren't supported by GitHub's renderer. This feature converts them to static images with collapsible source code.</li>
                <li><strong>Export Formats:</strong> SVG files are smaller and scale better, while PNG files have broader compatibility across different platforms.</li>
                <li><strong>Auto-sync:</strong> When enabled, changes are automatically synchronized with your GitHub repositories based on your configured sync intervals.</li>
              </ul>
            </Alert>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
}