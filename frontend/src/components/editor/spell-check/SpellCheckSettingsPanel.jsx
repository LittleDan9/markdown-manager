/**
 * Advanced Spell Check Settings Panel
 * Phase 5: Advanced UI Enhancements
 *
 * Provides user controls for:
 * - Analysis type toggles (spelling, grammar, style)
 * - Style guide selection
 * - Readability metrics display
 * - Advanced configuration options
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Row,
  Col,
  Button,
  Badge,
  Collapse,
  Alert
} from 'react-bootstrap';
import spellCheckApi from '@/api/spellCheckApi';

const STYLE_GUIDES = [
  { id: 'none', name: 'None', description: 'No specific style guide' },
  { id: 'ap', name: 'AP Style', description: 'Associated Press Stylebook' },
  { id: 'chicago', name: 'Chicago Manual', description: 'Chicago Manual of Style' },
  { id: 'mla', name: 'MLA', description: 'Modern Language Association' },
  { id: 'apa', name: 'APA', description: 'American Psychological Association' },
  { id: 'academic', name: 'Academic', description: 'General academic writing' },
  { id: 'technical', name: 'Technical', description: 'Technical documentation' }
];

const READABILITY_METRICS = [
  { key: 'fleschKincaid', name: 'Flesch-Kincaid Grade Level', format: 'grade' },
  { key: 'fleschReadingEase', name: 'Flesch Reading Ease', format: 'score' },
  { key: 'gunningFog', name: 'Gunning Fog Index', format: 'grade' },
  { key: 'smog', name: 'SMOG Index', format: 'grade' },
  { key: 'averageWordsPerSentence', name: 'Avg Words/Sentence', format: 'number' },
  { key: 'averageSyllablesPerWord', name: 'Avg Syllables/Word', format: 'decimal' }
];

export function SpellCheckSettingsPanel({
  settings = {},
  onSettingsChange = () => {},
  readabilityData = null,
  isVisible = false,
  onToggleVisibility = () => {},
  serviceInfo = null
}) {
  // Analysis type toggles
  const [analysisTypes, setAnalysisTypes] = useState({
    spelling: settings.spelling ?? true,
    grammar: settings.grammar ?? true,
    style: settings.style ?? true,
    readability: settings.readability ?? true
  });

  // Style guide selection
  const [selectedStyleGuide, setSelectedStyleGuide] = useState(
    settings.styleGuide || 'none'
  );

  // Language selection
  const [selectedLanguage, setSelectedLanguage] = useState(
    settings.language || 'en-US'
  );

  // Available languages from service
  const [availableLanguages, setAvailableLanguages] = useState(['en-US']);

  // UI state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [_loading, _setLoading] = useState(false);

  // Load available languages on mount
  useEffect(() => {
    loadAvailableLanguages();
  }, []);

  // Notify parent of settings changes
  useEffect(() => {
    const newSettings = {
      ...analysisTypes,
      styleGuide: selectedStyleGuide,
      language: selectedLanguage
    };
    onSettingsChange(newSettings);
  }, [analysisTypes, selectedStyleGuide, selectedLanguage, onSettingsChange]);

  const loadAvailableLanguages = async () => {
    try {
      const languages = await spellCheckApi.getAvailableLanguages();
      setAvailableLanguages(languages.length > 0 ? languages : ['en-US']);
    } catch (error) {
      console.error('Failed to load available languages:', error);
      setAvailableLanguages(['en-US']);
    }
  };

  const handleAnalysisTypeToggle = (type) => {
    setAnalysisTypes(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  const formatReadabilityValue = (value, format) => {
    if (value === null || value === undefined) return 'N/A';

    switch (format) {
      case 'grade':
        return `Grade ${Math.round(value * 10) / 10}`;
      case 'score':
        return `${Math.round(value)}`;
      case 'decimal':
        return `${Math.round(value * 100) / 100}`;
      case 'number':
        return `${Math.round(value)}`;
      default:
        return String(value);
    }
  };

  const getReadabilityInterpretation = (fleschScore) => {
    if (!fleschScore) return null;

    if (fleschScore >= 90) return { level: 'Very Easy', color: 'success' };
    if (fleschScore >= 80) return { level: 'Easy', color: 'success' };
    if (fleschScore >= 70) return { level: 'Fairly Easy', color: 'info' };
    if (fleschScore >= 60) return { level: 'Standard', color: 'primary' };
    if (fleschScore >= 50) return { level: 'Fairly Difficult', color: 'warning' };
    if (fleschScore >= 30) return { level: 'Difficult', color: 'warning' };
    return { level: 'Very Difficult', color: 'danger' };
  };

  const interpretation = getReadabilityInterpretation(
    readabilityData?.fleschReadingEase
  );

  return (
    <Collapse in={isVisible}>
      <div className="mt-3">
        <Card>
          <Card.Header className="d-flex justify-content-between align-items-center">
            <div>
              <i className="bi bi-gear me-2"></i>
              <strong>Analysis Settings</strong>
            </div>
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={onToggleVisibility}
            >
              <i className="bi bi-x"></i>
            </Button>
          </Card.Header>

          <Card.Body>
            {/* Analysis Type Toggles */}
            <div className="mb-4">
              <h6 className="mb-3">
                <i className="bi bi-check-square me-2"></i>
                Analysis Types
              </h6>
              <Row>
                <Col md={6}>
                  <Form.Check
                    type="switch"
                    id="spelling-toggle"
                    label={
                      <span>
                        <i className="bi bi-spellcheck me-2"></i>
                        Spelling
                        <Badge bg="danger" className="ms-2">Error</Badge>
                      </span>
                    }
                    checked={analysisTypes.spelling}
                    onChange={() => handleAnalysisTypeToggle('spelling')}
                    className="mb-2"
                  />
                  <Form.Check
                    type="switch"
                    id="grammar-toggle"
                    label={
                      <span>
                        <i className="bi bi-book me-2"></i>
                        Grammar
                        <Badge bg="warning" className="ms-2">Warning</Badge>
                      </span>
                    }
                    checked={analysisTypes.grammar}
                    onChange={() => handleAnalysisTypeToggle('grammar')}
                    className="mb-2"
                  />
                </Col>
                <Col md={6}>
                  <Form.Check
                    type="switch"
                    id="style-toggle"
                    label={
                      <span>
                        <i className="bi bi-palette me-2"></i>
                        Style
                        <Badge bg="info" className="ms-2">Info</Badge>
                      </span>
                    }
                    checked={analysisTypes.style}
                    onChange={() => handleAnalysisTypeToggle('style')}
                    className="mb-2"
                  />
                  <Form.Check
                    type="switch"
                    id="readability-toggle"
                    label={
                      <span>
                        <i className="bi bi-bar-chart me-2"></i>
                        Readability
                      </span>
                    }
                    checked={analysisTypes.readability}
                    onChange={() => handleAnalysisTypeToggle('readability')}
                    className="mb-2"
                  />
                </Col>
              </Row>
            </div>

            {/* Style Guide Selection */}
            <div className="mb-4">
              <h6 className="mb-3">
                <i className="bi bi-file-text me-2"></i>
                Writing Style Guide
              </h6>
              <Row>
                {STYLE_GUIDES.map(guide => (
                  <Col md={4} key={guide.id} className="mb-2">
                    <div className="d-grid">
                      <Button
                        variant={selectedStyleGuide === guide.id ? 'primary' : 'outline-secondary'}
                        size="sm"
                        onClick={() => setSelectedStyleGuide(guide.id)}
                        title={guide.description}
                      >
                        {guide.name}
                      </Button>
                    </div>
                  </Col>
                ))}
              </Row>
              {selectedStyleGuide !== 'none' && (
                <div className="mt-2">
                  <small className="text-muted">
                    <i className="bi bi-info-circle me-1"></i>
                    {STYLE_GUIDES.find(g => g.id === selectedStyleGuide)?.description}
                  </small>
                </div>
              )}
            </div>

            {/* Readability Metrics Display */}
            {analysisTypes.readability && readabilityData && (
              <div className="mb-4">
                <h6 className="mb-3">
                  <i className="bi bi-bar-chart me-2"></i>
                  Readability Analysis
                </h6>

                {interpretation && (
                  <Alert variant={interpretation.color} className="py-2">
                    <strong>Reading Level:</strong> {interpretation.level}
                    {readabilityData.fleschReadingEase && (
                      <span className="ms-2">
                        (Score: {Math.round(readabilityData.fleschReadingEase)})
                      </span>
                    )}
                  </Alert>
                )}

                <Row>
                  {READABILITY_METRICS.map(metric => (
                    <Col md={6} key={metric.key} className="mb-2">
                      <div className="d-flex justify-content-between align-items-center">
                        <small className="text-muted">{metric.name}:</small>
                        <Badge bg="light" text="dark">
                          {formatReadabilityValue(readabilityData[metric.key], metric.format)}
                        </Badge>
                      </div>
                    </Col>
                  ))}
                </Row>
              </div>
            )}

            {/* Advanced Settings */}
            <div>
              <Button
                variant="link"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="p-0 text-decoration-none"
              >
                <i className={`bi bi-chevron-${showAdvanced ? 'up' : 'down'} me-1`}></i>
                Advanced Settings
              </Button>

              <Collapse in={showAdvanced}>
                <div className="mt-3">
                  {/* Language Selection */}
                  <Row className="mb-3">
                    <Col md={6}>
                      <Form.Label className="fw-bold">Language</Form.Label>
                      <Form.Select
                        value={selectedLanguage}
                        onChange={(e) => setSelectedLanguage(e.target.value)}
                        size="sm"
                      >
                        {availableLanguages.map(lang => (
                          <option key={lang} value={lang}>
                            {lang === 'en-US' ? 'English (US)' :
                             lang === 'en-GB' ? 'English (UK)' :
                             lang === 'es-ES' ? 'Spanish' :
                             lang === 'fr-FR' ? 'French' :
                             lang === 'de-DE' ? 'German' :
                             lang}
                          </option>
                        ))}
                      </Form.Select>
                    </Col>
                  </Row>

                  {/* Service Information */}
                  {serviceInfo && (
                    <div className="mb-3">
                      <Form.Label className="fw-bold">Service Status</Form.Label>
                      <div className="small text-muted">
                        <div>Version: {serviceInfo.version || 'N/A'}</div>
                        <div>Features: {serviceInfo.integration?.features?.join(', ') || 'Basic'}</div>
                        <div>
                          Backend:
                          <Badge
                            bg={serviceInfo.integration?.custom_dictionary ? 'success' : 'warning'}
                            className="ms-1"
                          >
                            {serviceInfo.integration?.custom_dictionary ? 'Connected' : 'Limited'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Collapse>
            </div>
          </Card.Body>
        </Card>
      </div>
    </Collapse>
  );
}

export default SpellCheckSettingsPanel;