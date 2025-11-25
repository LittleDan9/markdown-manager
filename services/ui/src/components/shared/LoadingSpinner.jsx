import React from 'react';
import PropTypes from 'prop-types';

/**
 * LoadingSpinner - Reusable loading spinner component
 * Provides consistent loading UI across the application
 */
function LoadingSpinner({
  size = 'md',
  variant = 'primary',
  text = 'Loading...',
  showText = true,
  className = '',
  ...props
}) {
  const sizeClasses = {
    sm: 'spinner-border-sm',
    md: '',
    lg: 'spinner-border-lg'
  };

  return (
    <div className={`d-flex align-items-center justify-content-center ${className}`} {...props}>
      <div className={`spinner-border text-${variant} ${sizeClasses[size]}`} role="status">
        <span className="visually-hidden">Loading...</span>
      </div>
      {showText && <span className="ms-2">{text}</span>}
    </div>
  );
}

LoadingSpinner.propTypes = {
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  variant: PropTypes.string,
  text: PropTypes.string,
  showText: PropTypes.bool,
  className: PropTypes.string
};

export default LoadingSpinner;