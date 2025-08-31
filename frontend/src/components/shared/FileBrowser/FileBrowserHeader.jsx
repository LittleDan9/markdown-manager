/**
 * File Browser Header Component - Navigation and controls
 * Abstracted from GitHub browser header for universal use with existing styling
 */

import React from 'react';
import { Row, Col, Breadcrumb } from 'react-bootstrap';

export default function FileBrowserHeader({
  currentPath,
  onPathChange,
  selectedFiles,
  config
}) {
  const renderBreadcrumb = () => {
    if (!currentPath || currentPath === '/') {
      return (
        <Breadcrumb className="mb-0">
          <Breadcrumb.Item active>
            <i className="bi bi-house-door me-1"></i>
            Root
          </Breadcrumb.Item>
        </Breadcrumb>
      );
    }

    const pathParts = currentPath.split('/').filter(p => p);
    
    return (
      <Breadcrumb className="mb-0">
        <Breadcrumb.Item onClick={() => onPathChange('/')}>
          <i className="bi bi-house-door me-1"></i>
          Root
        </Breadcrumb.Item>
        {pathParts.map((part, index) => {
          const isLast = index === pathParts.length - 1;
          const pathToHere = '/' + pathParts.slice(0, index + 1).join('/');
          
          return (
            <Breadcrumb.Item 
              key={pathToHere}
              active={isLast}
              onClick={!isLast ? () => onPathChange(pathToHere) : undefined}
            >
              {part}
            </Breadcrumb.Item>
          );
        })}
      </Breadcrumb>
    );
  };

  return (
    <div className="file-browser-header p-2 border-bottom">
      <Row className="align-items-center">
        <Col>
          {renderBreadcrumb()}
        </Col>
        <Col xs="auto">
          {selectedFiles && selectedFiles.length > 0 && (
            <small className="text-muted">
              {selectedFiles.length} selected
            </small>
          )}
        </Col>
      </Row>
    </div>
  );
}
