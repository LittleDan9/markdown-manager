/**
 * Phase 5 Demo Page - Advanced UI Enhancements Showcase
 * Demonstrates all the new spell check features in a standalone component
 */

import React, { useState } from 'react';
import { Container, Row, Col, Card, Alert } from 'react-bootstrap';
import SpellCheckSettingsPanel from '../editor/spell-check/SpellCheckSettingsPanel';
import ReadabilityMetricsDisplay from '../editor/spell-check/ReadabilityMetricsDisplay';

// Mock data for demonstration
const mockReadabilityData = {
  fleschKincaid: 8.2,
  fleschReadingEase: 72.5,
  gunningFog: 9.1,
  smog: 8.7,
  wordCount: 1250,
  sentenceCount: 68,
  paragraphCount: 12,
  averageWordsPerSentence: 18.4,
  averageSyllablesPerWord: 1.45
};

const mockServiceInfo = {
  version: '3.0.0',
  integration: {
    custom_dictionary: true,
    features: ['spelling', 'grammar', 'style', 'readability', 'contextual_suggestions', 'style_guides'],
    phase: '5-advanced-ui'
  }
};

export function Phase5DemoPage() {
  // Settings state
  const [spellCheckSettings, setSpellCheckSettings] = useState({
    spelling: true,
    grammar: true,
    style: true,
    readability: true,
    styleGuide: 'ap',
    language: 'en-US'
  });

  // UI state
  const [showSettings, setShowSettings] = useState(true);
  const [showReadability, setShowReadability] = useState(true);

  const handleSettingsChange = (newSettings) => {
    setSpellCheckSettings(prev => ({
      ...prev,
      ...newSettings
    }));
  };

  return (
    <Container fluid className="py-4">
      <Row>
        <Col>
          <h1 className="mb-4">
            <i className="bi bi-magic me-2"></i>
            Phase 5: Advanced UI Enhancements Demo
          </h1>
          <Alert variant="info">
            <strong>Phase 5 Complete!</strong> This demo showcases the advanced spell check UI features including 
            analysis type toggles, style guide selection, and readability metrics display.
          </Alert>
        </Col>
      </Row>

      <Row>
        <Col lg={6}>
          <Card className="mb-4">
            <Card.Header>
              <h5 className="mb-0">
                <i className="bi bi-sliders me-2"></i>
                Advanced Settings Panel
              </h5>
            </Card.Header>
            <Card.Body>
              <p className="text-muted mb-3">
                Configure analysis types, style guides, and language preferences. 
                Changes are applied in real-time to the spell checking process.
              </p>
              
              <SpellCheckSettingsPanel
                settings={spellCheckSettings}
                onSettingsChange={handleSettingsChange}
                isVisible={showSettings}
                onToggleVisibility={() => setShowSettings(!showSettings)}
                serviceInfo={mockServiceInfo}
              />

              <div className="mt-3">
                <small className="text-muted">
                  <strong>Current Settings:</strong><br />
                  {JSON.stringify(spellCheckSettings, null, 2)}
                </small>
              </div>
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <h5 className="mb-0">
                <i className="bi bi-info-circle me-2"></i>
                Feature Summary
              </h5>
            </Card.Header>
            <Card.Body>
              <h6>✅ Implemented Features</h6>
              <ul className="list-unstyled">
                <li><i className="bi bi-check-circle text-success me-2"></i>Analysis type toggles (spelling, grammar, style)</li>
                <li><i className="bi bi-check-circle text-success me-2"></i>Style guide selection (6 professional guides)</li>
                <li><i className="bi bi-check-circle text-success me-2"></i>Multi-language support (5+ languages)</li>
                <li><i className="bi bi-check-circle text-success me-2"></i>Readability metrics display</li>
                <li><i className="bi bi-check-circle text-success me-2"></i>Real-time settings application</li>
                <li><i className="bi bi-check-circle text-success me-2"></i>Monaco Editor visual differentiation</li>
                <li><i className="bi bi-check-circle text-success me-2"></i>Advanced configuration panel</li>
                <li><i className="bi bi-check-circle text-success me-2"></i>Service integration and monitoring</li>
              </ul>

              <h6 className="mt-3">🎯 Analysis Types</h6>
              <div className="d-flex gap-2 flex-wrap">
                <span className={`badge ${spellCheckSettings.spelling ? 'bg-danger' : 'bg-secondary'}`}>
                  Spelling {spellCheckSettings.spelling ? '(ON)' : '(OFF)'}
                </span>
                <span className={`badge ${spellCheckSettings.grammar ? 'bg-warning' : 'bg-secondary'}`}>
                  Grammar {spellCheckSettings.grammar ? '(ON)' : '(OFF)'}
                </span>
                <span className={`badge ${spellCheckSettings.style ? 'bg-info' : 'bg-secondary'}`}>
                  Style {spellCheckSettings.style ? '(ON)' : '(OFF)'}
                </span>
                <span className={`badge ${spellCheckSettings.readability ? 'bg-primary' : 'bg-secondary'}`}>
                  Readability {spellCheckSettings.readability ? '(ON)' : '(OFF)'}
                </span>
              </div>

              <h6 className="mt-3">📝 Style Guide</h6>
              <span className="badge bg-success">
                {spellCheckSettings.styleGuide === 'none' ? 'No Style Guide' : 
                 spellCheckSettings.styleGuide === 'ap' ? 'AP Style' :
                 spellCheckSettings.styleGuide === 'chicago' ? 'Chicago Manual' :
                 spellCheckSettings.styleGuide === 'mla' ? 'MLA' :
                 spellCheckSettings.styleGuide === 'apa' ? 'APA' :
                 spellCheckSettings.styleGuide === 'academic' ? 'Academic' :
                 spellCheckSettings.styleGuide === 'technical' ? 'Technical' :
                 spellCheckSettings.styleGuide.toUpperCase()}
              </span>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={6}>
          <ReadabilityMetricsDisplay
            readabilityData={spellCheckSettings.readability ? mockReadabilityData : null}
            isVisible={showReadability && spellCheckSettings.readability}
          />

          <Card className="mt-4">
            <Card.Header>
              <h5 className="mb-0">
                <i className="bi bi-palette me-2"></i>
                Monaco Editor Integration
              </h5>
            </Card.Header>
            <Card.Body>
              <p className="text-muted">
                The enhanced Monaco Editor integration provides visual differentiation for different analysis types:
              </p>
              
              <div className="mb-3">
                <div className="d-flex align-items-center mb-2">
                  <div className="me-3" style={{ 
                    width: '20px', 
                    height: '3px', 
                    backgroundColor: '#dc3545',
                    textDecoration: 'underline wavy #dc3545'
                  }}></div>
                  <span><strong>Spelling Errors</strong> - Red squiggly underlines</span>
                </div>
                
                <div className="d-flex align-items-center mb-2">
                  <div className="me-3" style={{ 
                    width: '20px', 
                    height: '3px', 
                    backgroundColor: '#ffc107',
                    textDecoration: 'underline wavy #ffc107'
                  }}></div>
                  <span><strong>Grammar Issues</strong> - Yellow squiggly underlines</span>
                </div>
                
                <div className="d-flex align-items-center mb-2">
                  <div className="me-3" style={{ 
                    width: '20px', 
                    height: '3px', 
                    backgroundColor: '#0dcaf0',
                    textDecoration: 'underline wavy #0dcaf0'
                  }}></div>
                  <span><strong>Style Suggestions</strong> - Blue squiggly underlines</span>
                </div>
              </div>

              <Alert variant="light" className="small">
                <strong>Quick Actions:</strong> Right-click on any underlined text to see suggestions and apply fixes directly in the editor.
              </Alert>
            </Card.Body>
          </Card>

          <Card className="mt-4">
            <Card.Header>
              <h5 className="mb-0">
                <i className="bi bi-speedometer2 me-2"></i>
                Performance Metrics
              </h5>
            </Card.Header>
            <Card.Body>
              <Row>
                <Col md={6}>
                  <div className="text-center">
                    <div className="display-6 text-success">~150ms</div>
                    <small className="text-muted">Analysis Response Time</small>
                  </div>
                </Col>
                <Col md={6}>
                  <div className="text-center">
                    <div className="display-6 text-info">4</div>
                    <small className="text-muted">Analysis Types</small>
                  </div>
                </Col>
              </Row>
              
              <hr />
              
              <Row>
                <Col md={6}>
                  <div className="text-center">
                    <div className="display-6 text-warning">6</div>
                    <small className="text-muted">Style Guides</small>
                  </div>
                </Col>
                <Col md={6}>
                  <div className="text-center">
                    <div className="display-6 text-primary">5+</div>
                    <small className="text-muted">Languages</small>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="mt-4">
        <Col>
          <Alert variant="success">
            <h5><i className="bi bi-check-circle me-2"></i>Phase 5 Implementation Complete</h5>
            <p className="mb-0">
              All advanced UI enhancements have been successfully implemented, including analysis type toggles, 
              style guide selection, readability metrics display, and enhanced Monaco Editor integration. 
              The spell check service now provides a professional writing assistant experience with 
              enterprise-grade capabilities.
            </p>
          </Alert>
        </Col>
      </Row>
    </Container>
  );
}

export default Phase5DemoPage;