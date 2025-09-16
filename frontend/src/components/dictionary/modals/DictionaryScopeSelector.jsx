import React from 'react';
import { Form, Badge } from 'react-bootstrap';

/**
 * Scope selector component for dictionary scope selection
 * Supports user-level, folder-level, and repository-level dictionaries
 */
export function DictionaryScopeSelector({
  availableScopes,
  selectedScope,
  currentScope,
  onScopeChange,
  loading,
  isAuthenticated
}) {
  // Show when scopes are available
  if (!availableScopes || availableScopes.length === 0) {
    return null;
  }

  const handleScopeChange = (e) => {
    const selectedValue = e.target.value;
    if (selectedValue === 'current') {
      onScopeChange(currentScope);
    } else {
      const scope = availableScopes.find(s => 
        s.folderPath === selectedValue || 
        (selectedValue === 'user' && s.type === 'user')
      );
      onScopeChange(scope);
    }
  };

  const getScopeValue = (scope) => {
    if (!scope) return 'user';
    if (scope.type === 'user') return 'user';
    return scope.folderPath || 'user';
  };

  const selectedValue = selectedScope ? getScopeValue(selectedScope) : 'current';

  return (
    <div className="mb-3">
      <Form.Group>
        <Form.Label>
          Dictionary Scope
          {currentScope && currentScope.type !== 'user' && (
            <Badge bg="info" className="ms-2 small">
              Current: {currentScope.displayName}
            </Badge>
          )}
        </Form.Label>
        <Form.Select
          value={selectedValue}
          onChange={handleScopeChange}
          disabled={loading}
        >
          {currentScope && (
            <option value="current">
              📍 Current Document ({currentScope.displayName})
            </option>
          )}
          
          {availableScopes.map(scope => {
            const value = getScopeValue(scope);
            let icon = '👤';
            let description = scope.displayName;
            
            if (scope.type === 'folder') {
              icon = '📁';
            } else if (scope.type === 'github') {
              icon = '🐙';
            }
            
            return (
              <option key={value} value={value}>
                {icon} {description}
              </option>
            );
          })}
        </Form.Select>
        <Form.Text className="text-muted">
          {isAuthenticated ? (
            <>
              <strong>User Dictionary:</strong> Words available in all documents. <br/>
              <strong>Folder Dictionary:</strong> Words specific to documents in a folder. <br/>
              <strong>Repository Dictionary:</strong> Words specific to a GitHub repository.
            </>
          ) : (
            "Dictionary scopes available after login. Currently showing local storage only."
          )}
        </Form.Text>
      </Form.Group>
    </div>
  );
}
