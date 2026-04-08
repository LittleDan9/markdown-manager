/**
 * Spell Check Tab
 * Inline tab version of SpellCheckSettingsModal for use inside UserSettingsModal.
 * The standalone modal version remains for the editor toolbar (SpellCheckGroup).
 */

import React from 'react';
import { Tab, Tabs, Form, Row, Col, Badge, Alert, Card } from 'react-bootstrap';
import ReadabilityMetricsDisplay from './ReadabilityMetricsDisplay';
import GrammarRulesPanel from './GrammarRulesPanel';
import StyleSettingsPanel from './StyleSettingsPanel';
import { useTheme } from '@/providers/ThemeProvider';
import { useSpellCheckSettings } from '@/hooks/editor/useSpellCheckSettings';

function SpellCheckTab() {
  const { theme } = useTheme();

  const {
    analysisTypes,
    grammarRules,
    styleSettings,
    codeSpellSettings,
    selectedStyleGuide,
    selectedLanguage,
    autoDetectLanguage,
    detectedLanguage,
    availableLanguages,
    supportedCodeLanguages,
    loading,
    STYLE_GUIDES,
    handleAnalysisTypeToggle,
    handleCodeSpellToggle,
    handleStyleGuideChange,
    handleLanguageChange,
    handleAutoDetectToggle,
    handleGrammarRuleToggle,
    handleGrammarThresholdChange,
    handleStyleSettingToggle,
    getLanguageDisplayName
  } = useSpellCheckSettings({
    show: true,
    settings: {},
    onSettingsChange: () => {},
    currentUser: null
  });

  return (
    <div className="spell-check-tab mt-3">
      <Tabs defaultActiveKey="analysis-settings" className="mb-3">

        <Tab eventKey="analysis-settings" title={
          <span><i className="bi bi-toggles me-2"></i>Analysis Types</span>
        }>
          <div className="mb-4">
            <h6 className="mb-3">Enable/Disable Analysis Types</h6>
            <Row>
              <Col md={6}>
                <Form.Check
                  type="switch"
                  id="spelling-toggle-tab"
                  label={
                    <span>
                      <i className="bi bi-spellcheck me-2"></i>Spelling Analysis
                      <Badge bg="danger" className="ms-2">Error</Badge>
                    </span>
                  }
                  checked={analysisTypes.spelling}
                  onChange={() => handleAnalysisTypeToggle('spelling')}
                  className="mb-3"
                />
                <Form.Check
                  type="switch"
                  id="grammar-toggle-tab"
                  label={
                    <span>
                      <i className="bi bi-book me-2"></i>Grammar Analysis
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
                  id="style-toggle-tab"
                  label={
                    <span>
                      <i className="bi bi-palette me-2"></i>Style Analysis
                      <Badge bg="info" className="ms-2">Info</Badge>
                    </span>
                  }
                  checked={analysisTypes.style}
                  onChange={() => handleAnalysisTypeToggle('style')}
                  className="mb-3"
                />
                <Form.Check
                  type="switch"
                  id="readability-toggle-tab"
                  label={
                    <span>
                      <i className="bi bi-bar-chart me-2"></i>Readability Analysis
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

        {analysisTypes.grammar && (
          <Tab eventKey="grammar-rules" title={
            <span><i className="bi bi-book me-2"></i>Grammar Rules</span>
          }>
            <GrammarRulesPanel
              grammarRules={grammarRules}
              onRuleToggle={handleGrammarRuleToggle}
              onThresholdChange={handleGrammarThresholdChange}
            />
          </Tab>
        )}

        {analysisTypes.style && (
          <Tab eventKey="style-rules" title={
            <span><i className="bi bi-palette me-2"></i>Style Rules</span>
          }>
            <StyleSettingsPanel
              styleSettings={styleSettings}
              onSettingToggle={handleStyleSettingToggle}
            />
          </Tab>
        )}

        <Tab eventKey="code-spell" title={
          <span><i className="bi bi-code-slash me-2"></i>Code Spell Check</span>
        }>
          <div className="mb-4">
            <h6 className="mb-3">Code Fence Spell Checking</h6>
            <div className="mb-4">
              <Form.Check
                type="switch"
                id="code-spell-toggle-tab"
                label={
                  <span>
                    <i className="bi bi-code-square me-2"></i>Enable Code Spell Check
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
            {codeSpellSettings.enabled && (
              <div>
                <h6 className="mb-3">What to Check in Code</h6>
                <Row>
                  <Col md={4}>
                    <Form.Check
                      type="switch"
                      id="check-comments-toggle-tab"
                      label={<span><i className="bi bi-chat-text me-2"></i>Comments</span>}
                      checked={codeSpellSettings.checkComments}
                      onChange={() => handleCodeSpellToggle('checkComments')}
                      className="mb-3"
                    />
                  </Col>
                  <Col md={4}>
                    <Form.Check
                      type="switch"
                      id="check-strings-toggle-tab"
                      label={<span><i className="bi bi-quote me-2"></i>Strings</span>}
                      checked={codeSpellSettings.checkStrings}
                      onChange={() => handleCodeSpellToggle('checkStrings')}
                      className="mb-3"
                    />
                  </Col>
                  <Col md={4}>
                    <Form.Check
                      type="switch"
                      id="check-identifiers-toggle-tab"
                      label={<span><i className="bi bi-tag me-2"></i>Identifiers</span>}
                      checked={codeSpellSettings.checkIdentifiers}
                      onChange={() => handleCodeSpellToggle('checkIdentifiers')}
                      className="mb-3"
                    />
                  </Col>
                </Row>
                <div className="mt-4">
                  <h6 className="mb-3">Supported Languages</h6>
                  <div className="small text-muted">
                    <Row>
                      {supportedCodeLanguages.length > 0 ? (
                        supportedCodeLanguages.map((lang, index) => (
                          <Col md={3} key={index} className="mb-2">
                            <Badge variant="outline-secondary" className="w-100">{lang}</Badge>
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
              </div>
            )}
          </div>
        </Tab>

        <Tab eventKey="style-guide" title={
          <span><i className="bi bi-file-text me-2"></i>Style Guide</span>
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

        <Tab eventKey="language-settings" title={
          <span><i className="bi bi-globe me-2"></i>Language</span>
        }>
          <div className="mb-4">
            <h6 className="mb-3">Language Configuration</h6>
            <Form.Check
              type="switch"
              id="auto-detect-language-toggle"
              label={
                <span>
                  <i className="bi bi-translate me-2"></i>Auto-detect Language
                </span>
              }
              checked={autoDetectLanguage}
              onChange={handleAutoDetectToggle}
              className="mb-3"
            />
            {autoDetectLanguage && detectedLanguage && (
              <Alert variant="success" className="small mb-3">
                <i className="bi bi-check-circle me-2"></i>
                Detected: <strong>{getLanguageDisplayName(detectedLanguage.language)}</strong>
                <Badge bg={detectedLanguage.confidence > 0.8 ? 'success' : detectedLanguage.confidence > 0.5 ? 'warning' : 'secondary'} className="ms-2">
                  {Math.round(detectedLanguage.confidence * 100)}% confidence
                </Badge>
              </Alert>
            )}
            <Row>
              <Col md={6}>
                <Form.Label className="fw-bold">Analysis Language</Form.Label>
                <Form.Select
                  value={selectedLanguage}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  disabled={loading || autoDetectLanguage}
                >
                  {availableLanguages.map(lang => (
                    <option key={lang} value={lang}>
                      {getLanguageDisplayName(lang)}
                    </option>
                  ))}
                </Form.Select>
                <Form.Text className="text-muted">
                  {autoDetectLanguage
                    ? 'Language is determined automatically from document content'
                    : 'Select the primary language for spell check analysis'}
                </Form.Text>
              </Col>
            </Row>
          </div>
        </Tab>

        {analysisTypes.readability && (
          <Tab eventKey="readability" title={
            <span><i className="bi bi-bar-chart me-2"></i>Readability</span>
          }>
            <ReadabilityMetricsDisplay readabilityData={null} isVisible={true} />
          </Tab>
        )}

      </Tabs>
    </div>
  );
}

export default SpellCheckTab;
