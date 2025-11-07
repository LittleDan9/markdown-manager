import React from 'react';
import { Button } from 'react-bootstrap';
import PropTypes from 'prop-types';

/**
 * ActionButton - Standardized action button component
 * Provides consistent button styling and behavior across the application
 */
function ActionButton({
  variant = 'primary',
  size = 'sm',
  disabled = false,
  loading = false,
  icon,
  children,
  onClick,
  type = 'button',
  className = '',
  ...props
}) {
  return (
    <Button
      variant={variant}
      size={size}
      disabled={disabled || loading}
      onClick={onClick}
      type={type}
      className={className}
      {...props}
    >
      {loading && (
        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
      )}
      {icon && !loading && (
        <span className={`me-1 ${typeof icon === 'string' ? icon : ''}`}>
          {typeof icon === 'string' ? '' : icon}
        </span>
      )}
      {children}
    </Button>
  );
}

ActionButton.propTypes = {
  variant: PropTypes.oneOf(['primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark', 'outline-primary', 'outline-secondary', 'outline-success', 'outline-danger', 'outline-warning', 'outline-info', 'outline-light', 'outline-dark']),
  size: PropTypes.oneOf(['sm', 'lg']),
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  icon: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
  children: PropTypes.node,
  onClick: PropTypes.func,
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
  className: PropTypes.string
};

export default ActionButton;