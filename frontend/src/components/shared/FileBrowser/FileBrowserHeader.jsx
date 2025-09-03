/**
 * File Browser Header Component - Navigation and controls
 * Abstracted from GitHub browser header for universal use with existing styling
 */

import React from 'react';
import { Row, Col } from 'react-bootstrap';

export default function FileBrowserHeader({
  selectedFiles,
  config
}) {
  return (
    <div className="file-browser-header p-2 border-bottom">
      <Row className="align-items-center">
        <Col xs="auto" className="ms-auto">
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
