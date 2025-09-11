import React from 'react';
import { Card, Form, Badge, Spinner } from 'react-bootstrap';

export default function GitHubBrowserHeader({ 
  repository, 
  branches, 
  selectedBranch, 
  onBranchChange, 
  onBack,
  loading,
  showReturnButton = false
}) {
  const backTitle = showReturnButton ? "Return to GitHub Settings" : "Back to repositories";
  const backIcon = showReturnButton ? "bi-arrow-left-circle" : "bi-arrow-left";
  
  return (
    <Card className="border-0 border-bottom rounded-0">
      <Card.Body className="p-2">
        <div className="d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center">
            {onBack && (
              <i 
                className={`${backIcon} me-2 text-primary`}
                style={{ cursor: 'pointer', fontSize: '1rem' }}
                onClick={onBack}
                title={backTitle}
              ></i>
            )}
            <i className="bi bi-github text-primary me-2" style={{ fontSize: '1rem' }}></i>
            <div>
              <span className="fw-semibold">{repository.full_name}</span>
              <small className="text-muted ms-2">
                {repository.visibility || 'public'} • {branches.length} branch{branches.length !== 1 ? 'es' : ''}
              </small>
            </div>
          </div>
          
          <div className="d-flex align-items-center">
            {loading && (
              <Spinner size="sm" className="me-2" />
            )}
            
            <div className="d-flex align-items-center">
              <i className="bi bi-git me-2 text-muted" style={{ fontSize: '0.875rem' }}></i>
              <Form.Select
                size="sm"
                value={selectedBranch}
                onChange={(e) => onBranchChange(e.target.value)}
                disabled={loading}
                style={{ width: 'auto', minWidth: '120px' }}
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
        </div>
      </Card.Body>
    </Card>
  );
}
