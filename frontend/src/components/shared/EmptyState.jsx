import React from 'react';
import { Alert } from 'react-bootstrap';
import PropTypes from 'prop-types';

/**
 * EmptyState - Standardized empty state component
 * Provides consistent display for empty data scenarios
 */
function EmptyState({
  icon,
  title,
  description,
  action,
  variant = 'secondary',
  className = '',
  ...props
}) {
  return (
    <Alert variant={variant} className={`text-center py-5 ${className}`} {...props}>
      {icon && (
        <div className="mb-3">
          {typeof icon === 'string' ? (
            <i className={`${icon} fa-3x text-muted`}></i>
          ) : (
            icon
          )}
        </div>
      )}
      {title && <h5 className="alert-heading mb-2">{title}</h5>}
      {description && <p className="mb-3 text-muted">{description}</p>}
      {action && (
        <div className="d-flex justify-content-center">
          {action}
        </div>
      )}
    </Alert>
  );
}

EmptyState.propTypes = {
  icon: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
  title: PropTypes.string,
  description: PropTypes.string,
  action: PropTypes.element,
  variant: PropTypes.oneOf(['primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark']),
  className: PropTypes.string
};

export default EmptyState;