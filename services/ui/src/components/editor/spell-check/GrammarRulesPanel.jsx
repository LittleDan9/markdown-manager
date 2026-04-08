/**
 * GrammarRulesPanel
 * Per-rule grammar toggles and threshold configuration.
 */

import React from 'react';
import { Form, Row, Col, Alert } from 'react-bootstrap';

const GRAMMAR_RULES = [
  {
    key: 'sentenceLength',
    label: 'Sentence Length',
    icon: 'bi-text-paragraph',
    description: 'Flag sentences that exceed a maximum word count',
    hasThreshold: true,
    thresholdKey: 'maxSentenceWords',
    thresholdLabel: 'Max words per sentence',
    thresholdMin: 10,
    thresholdMax: 80,
    thresholdStep: 5,
  },
  {
    key: 'passiveVoice',
    label: 'Passive Voice',
    icon: 'bi-arrow-repeat',
    description: 'Detect passive voice constructions',
  },
  {
    key: 'repeatedWords',
    label: 'Repeated Words',
    icon: 'bi-files',
    description: 'Flag consecutive repeated words (e.g. "the the")',
  },
  {
    key: 'capitalization',
    label: 'Capitalization',
    icon: 'bi-type-bold',
    description: 'Check for capitalization errors at sentence starts',
  },
  {
    key: 'punctuation',
    label: 'Punctuation',
    icon: 'bi-three-dots',
    description: 'Detect missing or incorrect punctuation',
  },
];

function GrammarRulesPanel({ grammarRules, onRuleToggle, onThresholdChange }) {
  return (
    <div className="mb-4">
      <h6 className="mb-3">Grammar Rules</h6>
      {GRAMMAR_RULES.map((rule) => (
        <div key={rule.key} className="mb-3">
          <Form.Check
            type="switch"
            id={`grammar-rule-${rule.key}`}
            label={
              <span>
                <i className={`bi ${rule.icon} me-2`}></i>
                {rule.label}
              </span>
            }
            checked={!!grammarRules[rule.key]}
            onChange={() => onRuleToggle(rule.key)}
          />
          <Form.Text className="text-muted ms-4 d-block">{rule.description}</Form.Text>

          {rule.hasThreshold && grammarRules[rule.key] && (
            <Row className="mt-2 ms-4">
              <Col md={6}>
                <Form.Label className="small">{rule.thresholdLabel}: <strong>{grammarRules[rule.thresholdKey]}</strong></Form.Label>
                <Form.Range
                  min={rule.thresholdMin}
                  max={rule.thresholdMax}
                  step={rule.thresholdStep}
                  value={grammarRules[rule.thresholdKey]}
                  onChange={(e) => onThresholdChange(rule.thresholdKey, Number(e.target.value))}
                />
              </Col>
            </Row>
          )}
        </div>
      ))}

      <Alert variant="light" className="small mt-3">
        <strong>Grammar Rules</strong> run custom checks on your text beyond simple spelling.
        Disable individual rules to reduce noise for your writing style.
      </Alert>
    </div>
  );
}

export default GrammarRulesPanel;
