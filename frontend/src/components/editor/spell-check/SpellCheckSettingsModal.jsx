/**
 * Spell Check Settings Modal
 * Phase 5: Advanced UI Enhancements - Modal Implementation
 *
 * Follows the established pattern from UserSettingsModal for consistency
 * Available to both authenticated and non-authenticated users
 */

import React from 'react';
import { Modal, Tab, Tabs, Form, Row, Col, Button, Badge, Alert, Card } from 'react-bootstrap';
import ReadabilityMetricsDisplay from './ReadabilityMetricsDisplay';
import { useTheme } from '@/providers/ThemeProvider';
import { useSpellCheckSettings } from '@/hooks/editor/useSpellCheckSettings';

export function SpellCheckSettingsModal({
  show,
  onHide,
  settings = {},
  onSettingsChange = () => {},
  readabilityData = null,
  serviceInfo = null,
  defaultActiveKey = "analysis-settings",
  currentUser = null
}) {
  const { theme } = useTheme();

  const {
    analysisTypes,
    codeSpellSettings,
    selectedStyleGuide,
    selectedLanguage,
    availableLanguages,
    supportedCodeLanguages,
    loading,
    STYLE_GUIDES,
    handleAnalysisTypeToggle,
    handleCodeSpellToggle,
    handleStyleGuideChange,
    handleLanguageChange,
    getLanguageDisplayName
  } = useSpellCheckSettings({
    show,
    settings,
    onSettingsChange,
    currentUser
  });

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="bi bi-spellcheck me-2"></i>
          Spell Check Settings
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Tabs defaultActiveKey={defaultActiveKey} className="mb-3">

          {/* Analysis Settings Tab */}
          <Tab eventKey="analysis-settings" title={
            <span>
              <i className="bi bi-toggles me-2"></i>
              Analysis Types
            </span>
          }>
            <div className="mb-4">
              <h6 className="mb-3">Enable/Disable Analysis Types</h6>
              <Row>
                <Col md={6}>
                  <Form.Check
                    type="switch"
                    id="spelling-toggle-modal"
                    label={
                      <span>
                        <i className="bi bi-spellcheck me-2"></i>
                        Spelling Analysis
                        <Badge bg="danger" className="ms-2">Error</Badge>
                      </span>
                    }
                    checked={analysisTypes.spelling}
                    onChange={() => handleAnalysisTypeToggle('spelling')}
                    className="mb-3"
                  />
                  <Form.Check
                    type="switch"
                    id="grammar-toggle-modal"
                    label={
                      <span>
                        <i className="bi bi-book me-2"></i>
                        Grammar Analysis
                        <Badge bg="warning" className="ms-2">Warning</Badge>
                      </span>
                    }
                    checked={analysisTypes.grammar}
                    onChange={() => handleAnalysisTypeToggle('grammar')}
                    className="mb-3"
                  />
                </Col>
                <Col md={6}>
                  <Form.Check
                    type="switch"
                    id="style-toggle-modal"
                    label={
                      <span>
                        <i className="bi bi-palette me-2"></i>
                        Style Analysis
                        <Badge bg="info" className="ms-2">Info</Badge>
                      </span>
                    }
                    checked={analysisTypes.style}
                    onChange={() => handleAnalysisTypeToggle('style')}
                    className="mb-3"
                  />
                  <Form.Check
                    type="switch"
                    id="readability-toggle-modal"
                    label={
                      <span>
                        <i className="bi bi-bar-chart me-2"></i>
                        Readability Analysis
                      </span>
                    }
                    checked={analysisTypes.readability}
                    onChange={() => handleAnalysisTypeToggle('readability')}
                    className="mb-3"
                  />
                </Col>
              </Row>

              <Alert variant="light" className="small">
                <strong>Analysis Types:</strong>
                <ul className="mb-0 mt-2">
                  <li><strong>Spelling:</strong> Detects misspelled words with suggestions</li>
                  <li><strong>Grammar:</strong> Identifies grammar issues like repeated words</li>
                  <li><strong>Style:</strong> Suggests improvements for clarity and readability</li>
                  <li><strong>Readability:</strong> Calculates reading level and complexity metrics</li>
                </ul>
              </Alert>
            </div>
          </Tab>

          {/* Code Spell Check Tab */}
          <Tab eventKey="code-spell" title={
            <span>
              <i className="bi bi-code-slash me-2"></i>
              Code Spell Check
            </span>
          }>
            <div className="mb-4">
              <h6 className="mb-3">Code Fence Spell Checking</h6>

              {/* Main toggle for code spell checking */}
              <div className="mb-4">
                <Form.Check
                  type="switch"
                  id="code-spell-toggle"
                  label={
                    <span>
                      <i className="bi bi-code-square me-2"></i>
                      Enable Code Spell Check
                      <Badge bg="primary" className="ms-2">Code</Badge>
                    </span>
                  }
                  checked={codeSpellSettings.enabled}
                  onChange={() => handleCodeSpellToggle('enabled')}
                  className="mb-3"
                />

                <Alert variant="light" className="small">
                  <strong>Code Spell Check:</strong> Enables spell checking within code fences in your markdown documents.
                  This feature analyzes comments, strings, and identifiers in supported programming languages.
                </Alert>
              </div>

              {/* Code spell checking options - only show when enabled */}
              {codeSpellSettings.enabled && (
                <div>
                  <h6 className="mb-3">What to Check in Code</h6>
                  <Row>
                    <Col md={4}>
                      <Form.Check
                        type="switch"
                        id="check-comments-toggle"
                        label={
                          <span>
                            <i className="bi bi-chat-text me-2"></i>
                            Comments
                          </span>
                        }
                        checked={codeSpellSettings.checkComments}
                        onChange={() => handleCodeSpellToggle('checkComments')}
                        className="mb-3"
                      />
                    </Col>
                    <Col md={4}>
                      <Form.Check
                        type="switch"
                        id="check-strings-toggle"
                        label={
                          <span>
                            <i className="bi bi-quote me-2"></i>
                            Strings
                          </span>
                        }
                        checked={codeSpellSettings.checkStrings}
                        onChange={() => handleCodeSpellToggle('checkStrings')}
                        className="mb-3"
                      />
                    </Col>
                    <Col md={4}>
                      <Form.Check
                        type="switch"
                        id="check-identifiers-toggle"
                        label={
                          <span>
                            <i className="bi bi-tag me-2"></i>
                            Identifiers
                          </span>
                        }
                        checked={codeSpellSettings.checkIdentifiers}
                        onChange={() => handleCodeSpellToggle('checkIdentifiers')}
                        className="mb-3"
                      />
                    </Col>
                  </Row>

                  {/* Supported languages display */}
                  <div className="mt-4">
                    <h6 className="mb-3">Supported Languages</h6>
                    <div className="small text-muted">
                      <Row>
                        {supportedCodeLanguages.length > 0 ? (
                          supportedCodeLanguages.map((lang, index) => (
                            <Col md={3} key={index} className="mb-2">
                              <Badge variant="outline-secondary" className="w-100">
                                {lang}
                              </Badge>
                            </Col>
                          ))
                        ) : (
                          <Col>
                            <div className="text-center">
                              <div className="spinner-border spinner-border-sm me-2" role="status">
                                <span className="visually-hidden">Loading...</span>
                              </div>
                              Loading supported languages...
                            </div>
                          </Col>
                        )}
                      </Row>
                    </div>
                  </div>

                  <Alert variant="info" className="small mt-3">
                    <strong>Code Checking Options:</strong>
                    <ul className="mb-0 mt-2">
                      <li><strong>Comments:</strong> Check spelling in code comments (// /* */)</li>
                      <li><strong>Strings:</strong> Check spelling in string literals (&quot;text&quot; &apos;text&apos;)</li>
                      <li><strong>Identifiers:</strong> Check spelling in variable/function names (camelCase, snake_case)</li>
                    </ul>
                  </Alert>
                </div>
              )}
            </div>
          </Tab>

          {/* Style Guide Tab */}
          <Tab eventKey="style-guide" title={
            <span>
              <i className="bi bi-file-text me-2"></i>
              Style Guide
            </span>
          }>
            <div className="mb-4">
              <h6 className="mb-3">Professional Writing Standards</h6>
              <Row>
                {STYLE_GUIDES.map(guide => (
                  <Col md={4} key={guide.id} className="mb-3">
                    <Card
                      className={`h-100 cursor-pointer ${
                        selectedStyleGuide === guide.id
                          ? 'border-primary' + (theme === 'dark' ? ' bg-dark' : ' bg-light')
                          : theme === 'dark' ? 'bg-dark border-secondary' : 'bg-light border-light'
                      }`}
                      onClick={() => handleStyleGuideChange(guide.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <Card.Body className="text-center">
                        <div className="mb-2">
                          {selectedStyleGuide === guide.id ? (
                            <i className="bi bi-check-circle-fill text-primary fs-4"></i>
                          ) : (
                            <i className={`bi bi-circle fs-4 ${theme === 'dark' ? 'text-light' : 'text-muted'}`}></i>
                          )}
                        </div>
                        <Card.Title className="h6">{guide.name}</Card.Title>
                        <Card.Text className={`small ${theme === 'dark' ? 'text-light-emphasis' : 'text-muted'}`}>
                          {guide.description}
                        </Card.Text>
                      </Card.Body>
                    </Card>
                  </Col>
                ))}
              </Row>

              <Alert variant="info" className="small">
                <strong>Style Guides</strong> help ensure your writing follows professional standards for specific industries or publications.
              </Alert>
            </div>
          </Tab>

          {/* Language Settings Tab */}
          <Tab eventKey="language-settings" title={
            <span>
              <i className="bi bi-globe me-2"></i>
              Language
            </span>
          }>
            <div className="mb-4">
              <h6 className="mb-3">Language Configuration</h6>

              <Row>
                <Col md={6}>
                  <Form.Label className="fw-bold">Analysis Language</Form.Label>
                  <Form.Select
                    value={selectedLanguage}
                    onChange={(e) => handleLanguageChange(e.target.value)}
                    disabled={loading}
                  >
                    {availableLanguages.map(lang => (
                      <option key={lang} value={lang}>
                        {getLanguageDisplayName(lang)}
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Text className="text-muted">
                    Select the primary language for spell check analysis
                  </Form.Text>
                </Col>
              </Row>

              <Alert variant="info" className="mt-3 small">
                <strong>Multi-language Support:</strong> The spell check service supports multiple languages with automatic detection capabilities.
              </Alert>
            </div>
          </Tab>

          {/* Readability Tab */}
          {analysisTypes.readability && readabilityData && (
            <Tab eventKey="readability" title={
              <span>
                <i className="bi bi-bar-chart me-2"></i>
                Readability
              </span>
            }>
              <ReadabilityMetricsDisplay
                readabilityData={readabilityData}
                isVisible={true}
              />
            </Tab>
          )}

          {/* Service Info Tab */}
          <Tab eventKey="service-info" title={
            <span>
              <i className="bi bi-info-circle me-2"></i>
              Service Info
            </span>
          }>
            <div className="mb-4">
              <h6 className="mb-3">Service Status</h6>

              {serviceInfo ? (
                <Row>
                  <Col md={6}>
                    <div className="mb-3">
                      <strong>Version:</strong>
                      <Badge bg="primary" className="ms-2">
                        {serviceInfo.version || 'N/A'}
                      </Badge>
                    </div>

                    <div className="mb-3">
                      <strong>Backend Status:</strong>
                      <Badge
                        bg={serviceInfo.integration?.custom_dictionary ? 'success' : 'warning'}
                        className="ms-2"
                      >
                        {serviceInfo.integration?.custom_dictionary ? 'Connected' : 'Limited'}
                      </Badge>
                    </div>

                    <div className="mb-3">
                      <strong>Implementation Phase:</strong>
                      <Badge bg="info" className="ms-2">
                        {serviceInfo.integration?.phase || 'Unknown'}
                      </Badge>
                    </div>
                  </Col>

                  <Col md={6}>
                    <div className="mb-3">
                      <strong>Available Features:</strong>
                      <div className="mt-2">
                        {serviceInfo.integration?.features?.map(feature => (
                          <Badge key={feature} bg="secondary" className="me-1 mb-1">
                            {feature}
                          </Badge>
                        )) || <span className="text-muted">Basic features</span>}
                      </div>
                    </div>
                  </Col>
                </Row>
              ) : (
                <Alert variant="warning">
                  Service information not available. The spell check service may be offline or experiencing issues.
                </Alert>
              )}
            </div>
          </Tab>

        </Tabs>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default SpellCheckSettingsModal;