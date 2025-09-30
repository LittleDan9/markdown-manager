import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Card, Form, Row, Col, Alert, Badge, Button } from 'react-bootstrap';
import { useNotification } from '../../NotificationProvider';

/**
 * GitHub Integration Settings Component
 *
 * Provides user settings for automatic diagram conversion when saving to GitHub.
 * This component will be integrated into the main settings panel.
 */
function GitHubIntegrationSettings({ githubAccount, settings, onSettingsChange }) {
  const [localSettings, setLocalSettings] = useState({
    enableDiagramConversion: false,
    diagramFormat: 'svg',
    conversionQuality: 'high',
    fallbackToStandard: true,
    includeSourceCode: true,
    ...settings
  });

  const [isLoading, setIsLoading] = useState(false);
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    setLocalSettings(prev => ({ ...prev, ...settings }));
  }, [settings]);

  const handleSettingChange = async (key, value) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);

    try {
      setIsLoading(true);

      // Call parent callback to save settings
      if (onSettingsChange) {
        await onSettingsChange(newSettings);
      }

      showSuccess('GitHub integration settings updated');
    } catch (error) {
      console.error('Failed to update settings:', error);
      showError('Failed to update settings');

      // Revert local state on error
      setLocalSettings(localSettings);
    } finally {
      setIsLoading(false);
    }
  };

  const getFeatureDescription = () => {
    if (!localSettings.enableDiagramConversion) {
      return "Automatic diagram conversion is disabled. Advanced Mermaid diagrams will be saved as-is.";
    }

    const features = [];
    if (localSettings.fallbackToStandard) {
      features.push("Convert architecture-beta to standard flowcharts");
    }
    if (localSettings.includeSourceCode) {
      features.push("Include original source code in collapsible sections");
    }

    return `Active: ${features.join(", ")} | Export format: ${localSettings.diagramFormat.toUpperCase()}`;
  };

  if (!githubAccount) {
    return (
      <Card>
        <Card.Header>
          <h6 className="mb-0">
            <i className="bi bi-github me-2"></i>
            GitHub Diagram Export
          </h6>
        </Card.Header>
        <Card.Body>
          <Alert variant="info">
            <i className="bi bi-info-circle me-2"></i>
            Connect a GitHub account to enable automatic diagram conversion features.
          </Alert>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Header className="d-flex justify-content-between align-items-center">
        <h6 className="mb-0">
          <i className="bi bi-github me-2"></i>
          GitHub Diagram Export
        </h6>
        <Badge bg={localSettings.enableDiagramConversion ? "success" : "secondary"}>
          {localSettings.enableDiagramConversion ? "Enabled" : "Disabled"}
        </Badge>
      </Card.Header>

      <Card.Body>
        {/* Main Toggle */}
        <Row className="mb-3">
          <Col>
            <Form.Check
              type="switch"
              id="enable-diagram-conversion"
              label="Auto-convert advanced diagrams for GitHub compatibility"
              checked={localSettings.enableDiagramConversion}
              onChange={(e) => handleSettingChange('enableDiagramConversion', e.target.checked)}
              disabled={isLoading}
            />
            <Form.Text className="text-muted">
              When enabled, advanced Mermaid diagrams (architecture-beta, custom icons) will be
              automatically converted to static images when saving to GitHub repositories.
            </Form.Text>
          </Col>
        </Row>

        {localSettings.enableDiagramConversion && (
          <>
            {/* Export Format */}
            <Row className="mb-3">
              <Col md={6}>
                <Form.Label>Export Format</Form.Label>
                <Form.Select
                  value={localSettings.diagramFormat}
                  onChange={(e) => handleSettingChange('diagramFormat', e.target.value)}
                  disabled={isLoading}
                >
                  <option value="svg">SVG (Vector, smaller files)</option>
                  <option value="png">PNG (Raster, better compatibility)</option>
                </Form.Select>
                <Form.Text className="text-muted">
                  SVG provides better quality and smaller files, PNG offers wider compatibility.
                </Form.Text>
              </Col>

              <Col md={6}>
                <Form.Label>Quality</Form.Label>
                <Form.Select
                  value={localSettings.conversionQuality}
                  onChange={(e) => handleSettingChange('conversionQuality', e.target.value)}
                  disabled={isLoading}
                >
                  <option value="standard">Standard (1200x800)</option>
                  <option value="high">High (1600x1200)</option>
                  <option value="ultra">Ultra (2400x1800)</option>
                </Form.Select>
                <Form.Text className="text-muted">
                  Higher quality produces larger files but better detail.
                </Form.Text>
              </Col>
            </Row>

            {/* Conversion Options */}
            <Row className="mb-3">
              <Col>
                <Form.Label>Conversion Options</Form.Label>

                <Form.Check
                  type="checkbox"
                  id="fallback-to-standard"
                  label="Convert architecture-beta diagrams to standard flowcharts"
                  checked={localSettings.fallbackToStandard}
                  onChange={(e) => handleSettingChange('fallbackToStandard', e.target.checked)}
                  disabled={isLoading}
                  className="mb-2"
                />
                <Form.Text className="text-muted d-block mb-2">
                  Automatically converts unsupported architecture-beta syntax to standard Mermaid flowcharts.
                </Form.Text>

                <Form.Check
                  type="checkbox"
                  id="include-source-code"
                  label="Include original source code in collapsible sections"
                  checked={localSettings.includeSourceCode}
                  onChange={(e) => handleSettingChange('includeSourceCode', e.target.checked)}
                  disabled={isLoading}
                />
                <Form.Text className="text-muted">
                  Adds a collapsible details section with the original Mermaid source code below each converted diagram.
                </Form.Text>
              </Col>
            </Row>

            {/* Status Summary */}
            <Alert variant="light" className="mb-0">
              <strong>Current Configuration:</strong><br />
              <small className="text-muted">{getFeatureDescription()}</small>
            </Alert>
          </>
        )}

        {/* Account Info */}
        <Row className="mt-3 pt-3 border-top">
          <Col>
            <small className="text-muted">
              <i className="bi bi-person-circle me-1"></i>
              Connected as: <strong>{githubAccount.username}</strong>
              {githubAccount.email && (
                <> • {githubAccount.email}</>
              )}
            </small>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
}

GitHubIntegrationSettings.propTypes = {
  githubAccount: PropTypes.shape({
    id: PropTypes.number.isRequired,
    username: PropTypes.string.isRequired,
    email: PropTypes.string
  }),
  settings: PropTypes.shape({
    enableDiagramConversion: PropTypes.bool,
    diagramFormat: PropTypes.string,
    conversionQuality: PropTypes.string,
    fallbackToStandard: PropTypes.bool,
    includeSourceCode: PropTypes.bool
  }),
  onSettingsChange: PropTypes.func.isRequired
};

GitHubIntegrationSettings.defaultProps = {
  githubAccount: null,
  settings: {}
};

export default GitHubIntegrationSettings;