import React from 'react';
import { Card } from 'react-bootstrap';
import PropTypes from 'prop-types';

/**
 * AppCard - Standardized card component
 * Provides consistent card styling and behavior across the application
 */
function AppCard({
  title,
  subtitle,
  headerActions,
  footer,
  children,
  className = '',
  bodyClassName = '',
  loading = false,
  ...props
}) {
  return (
    <Card className={className} {...props}>
      {(title || subtitle || headerActions) && (
        <Card.Header className="d-flex justify-content-between align-items-center">
          <div>
            {title && <Card.Title className="mb-0">{title}</Card.Title>}
            {subtitle && <Card.Subtitle className="text-muted mb-0">{subtitle}</Card.Subtitle>}
          </div>
          {headerActions && (
            <div className="d-flex gap-2">
              {headerActions}
            </div>
          )}
        </Card.Header>
      )}
      <Card.Body className={bodyClassName}>
        {loading ? (
          <div className="text-center py-4">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : (
          children
        )}
      </Card.Body>
      {footer && <Card.Footer>{footer}</Card.Footer>}
    </Card>
  );
}

AppCard.propTypes = {
  title: PropTypes.string,
  subtitle: PropTypes.string,
  headerActions: PropTypes.node,
  footer: PropTypes.node,
  children: PropTypes.node,
  className: PropTypes.string,
  bodyClassName: PropTypes.string,
  loading: PropTypes.bool
};

export default AppCard;