import React from 'react';
import { Card, Form, Badge, Spinner } from 'react-bootstrap';

export default function GitHubBrowserHeader({ 
  repository, 
  branches, 
  selectedBranch, 
  onBranchChange, 
  loading 
}) {
  return (
    <Card className="border-0 border-bottom rounded-0">
      <Card.Body className="py-2">
        <div className="d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center">
            <i className="bi bi-github me-2"></i>
            <strong>{repository.full_name}</strong>
            <Badge bg="secondary" className="ms-2">
              {repository.visibility || 'public'}
            </Badge>
          </div>
          
          <div className="d-flex align-items-center">
            {loading && (
              <Spinner size="sm" className="me-2" />
            )}
            
            <Form.Label className="me-2 mb-0 small text-muted">
              Branch:
            </Form.Label>
            <Form.Select
              size="sm"
              value={selectedBranch}
              onChange={(e) => onBranchChange(e.target.value)}
              disabled={loading}
              style={{ width: 'auto' }}
            >
              {branches.map(branch => (
                <option key={branch.name} value={branch.name}>
                  {branch.name}
                  {branch.name === repository.default_branch && ' (default)'}
                </option>
              ))}
            </Form.Select>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
}
