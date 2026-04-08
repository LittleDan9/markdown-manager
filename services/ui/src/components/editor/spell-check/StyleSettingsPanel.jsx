/**
 * StyleSettingsPanel
 * Per-rule style analyzer toggles (write-good integration).
 */

import React from 'react';
import { Form, Alert } from 'react-bootstrap';

const STYLE_RULES = [
  {
    key: 'passive',
    label: 'Passive Voice',
    icon: 'bi-arrow-left-right',
    description: 'Flag passive voice usage (e.g. "was written" → "wrote")',
  },
  {
    key: 'illusion',
    label: 'Lexical Illusions',
    icon: 'bi-eye',
    description: 'Detect repeated adjacent words like "the the"',
  },
  {
    key: 'so',
    label: '"So" at Start',
    icon: 'bi-chat-left-quote',
    description: 'Flag sentences starting with "so"',
  },
  {
    key: 'thereIs',
    label: '"There is/are"',
    icon: 'bi-signpost',
    description: 'Flag overuse of "there is" or "there are"',
  },
  {
    key: 'weasel',
    label: 'Weasel Words',
    icon: 'bi-shield-exclamation',
    description: 'Flag vague qualifiers (e.g. "many", "various", "very")',
  },
  {
    key: 'adverb',
    label: 'Adverbs',
    icon: 'bi-lightning',
    description: 'Flag unnecessary adverbs (e.g. "extremely", "really")',
  },
  {
    key: 'tooWordy',
    label: 'Wordy Phrases',
    icon: 'bi-scissors',
    description: 'Flag phrases that can be shortened (e.g. "in order to" → "to")',
  },
  {
    key: 'cliches',
    label: 'Clichés',
    icon: 'bi-recycle',
    description: 'Flag overused expressions and clichés',
  },
  {
    key: 'eprime',
    label: 'E-Prime',
    icon: 'bi-exclude',
    description: 'Flag all forms of "to be" (strict E-Prime writing)',
  },
];

function StyleSettingsPanel({ styleSettings, onSettingToggle }) {
  return (
    <div className="mb-4">
      <h6 className="mb-3">Style Analysis Rules</h6>
      {STYLE_RULES.map((rule) => (
        <div key={rule.key} className="mb-3">
          <Form.Check
            type="switch"
            id={`style-setting-${rule.key}`}
            label={
              <span>
                <i className={`bi ${rule.icon} me-2`}></i>
                {rule.label}
              </span>
            }
            checked={!!styleSettings[rule.key]}
            onChange={() => onSettingToggle(rule.key)}
          />
          <Form.Text className="text-muted ms-4 d-block">{rule.description}</Form.Text>
        </div>
      ))}

      <Alert variant="light" className="small mt-3">
        <strong>Style Rules</strong> are powered by the write-good library and help improve clarity, conciseness, and readability.
        Toggle individual rules to match your preferred writing style.
      </Alert>
    </div>
  );
}

export default StyleSettingsPanel;
