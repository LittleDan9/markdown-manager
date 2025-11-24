import React from 'react';
import { Form, InputGroup } from 'react-bootstrap';
import PropTypes from 'prop-types';

/**
 * FormField - Standardized form input component
 * Provides consistent form field styling and validation display
 */
function FormField({
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  error,
  success,
  required = false,
  disabled = false,
  readOnly = false,
  size,
  as,
  rows,
  prepend,
  append,
  helpText,
  className = '',
  ...props
}) {
  const controlProps = {
    type,
    placeholder,
    value,
    onChange,
    disabled,
    readOnly,
    size,
    as,
    rows,
    isInvalid: !!error,
    isValid: !!success && !error,
    required,
    ...props
  };

  const inputElement = prepend || append ? (
    <InputGroup>
      {prepend && <InputGroup.Text>{prepend}</InputGroup.Text>}
      <Form.Control {...controlProps} />
      {append && <InputGroup.Text>{append}</InputGroup.Text>}
    </InputGroup>
  ) : (
    <Form.Control {...controlProps} />
  );

  return (
    <Form.Group className={`mb-3 ${className}`}>
      {label && (
        <Form.Label>
          {label}
          {required && <span className="text-danger ms-1">*</span>}
        </Form.Label>
      )}
      {inputElement}
      {error && <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>}
      {success && !error && <Form.Control.Feedback type="valid">{success}</Form.Control.Feedback>}
      {helpText && <Form.Text className="text-muted">{helpText}</Form.Text>}
    </Form.Group>
  );
}

FormField.propTypes = {
  label: PropTypes.string,
  type: PropTypes.string,
  placeholder: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
  error: PropTypes.string,
  success: PropTypes.string,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  readOnly: PropTypes.bool,
  size: PropTypes.oneOf(['sm', 'lg']),
  as: PropTypes.elementType,
  rows: PropTypes.number,
  prepend: PropTypes.node,
  append: PropTypes.node,
  helpText: PropTypes.string,
  className: PropTypes.string
};

export default FormField;