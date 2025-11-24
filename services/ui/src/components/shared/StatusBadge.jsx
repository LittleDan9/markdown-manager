import React from 'react';
import { Badge } from 'react-bootstrap';
import PropTypes from 'prop-types';

/**
 * StatusBadge - Standardized status indicator component
 * Provides consistent status display across the application
 */
function StatusBadge({
  status,
  variant,
  size = 'normal',
  animated = false,
  children,
  className = '',
  ...props
}) {
  // Auto-determine variant based on status if not provided
  const getVariant = () => {
    if (variant) return variant;

    switch (status?.toLowerCase()) {
      case 'success':
      case 'completed':
      case 'active':
      case 'healthy':
        return 'success';
      case 'error':
      case 'failed':
      case 'danger':
        return 'danger';
      case 'warning':
      case 'pending':
        return 'warning';
      case 'info':
      case 'loading':
        return 'info';
      case 'secondary':
      case 'inactive':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const sizeClasses = {
    small: 'small',
    normal: '',
    large: 'fs-6'
  };

  return (
    <Badge
      bg={getVariant()}
      className={`${sizeClasses[size]} ${animated ? 'pulse' : ''} ${className}`}
      {...props}
    >
      {animated && status === 'loading' && (
        <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
      )}
      {children || status}
    </Badge>
  );
}

StatusBadge.propTypes = {
  status: PropTypes.string,
  variant: PropTypes.string,
  size: PropTypes.oneOf(['small', 'normal', 'large']),
  animated: PropTypes.bool,
  children: PropTypes.node,
  className: PropTypes.string
};

export default StatusBadge;