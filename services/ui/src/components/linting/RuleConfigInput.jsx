import React from 'react';
import { Form, Row, Col } from 'react-bootstrap';
import PropTypes from 'prop-types';

/**
 * Generic rule configuration input component
 * Handles different types of rule configuration options
 */
function RuleConfigInput({ ruleId: _ruleId, definition, value, onChange }) {
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
              {option}
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
                min="1"
                max="100"
                value={value[key] || 1}
                onChange={(e) => handleChange(key, parseInt(e.target.value))}
                style={{ width: '80px' }}
              />
            ) : type === 'boolean' ? (
              <Form.Check
                type="checkbox"
                checked={value[key] || false}
                onChange={(e) => handleChange(key, e.target.checked)}
                label={key}
              />
            ) : (
              <Form.Control
                type="text"
                size="sm"
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

RuleConfigInput.propTypes = {
  ruleId: PropTypes.string.isRequired,
  definition: PropTypes.object,
  value: PropTypes.oneOfType([PropTypes.bool, PropTypes.object]),
  onChange: PropTypes.func.isRequired
};

export default RuleConfigInput;