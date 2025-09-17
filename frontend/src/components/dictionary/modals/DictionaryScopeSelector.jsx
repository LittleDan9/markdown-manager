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
  isAuthenticated,
  wordCount,
  localWordCount
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
    <div className="scope-selector-compact">
      <div className="d-flex align-items-center justify-content-between mb-2">
        <label className="form-label mb-0 fw-medium">
          Scope
        </label>
        <small className="text-muted">
          <strong>{isAuthenticated ? wordCount : localWordCount}</strong> words
        </small>
      </div>

      <Form.Select
        value={selectedValue}
        onChange={handleScopeChange}
        disabled={loading}
        size="sm"
        className="scope-select"
      >
        {currentScope && (
          <option value="current">
            📍 Current ({currentScope.displayName})
          </option>
        )}

        {availableScopes.map(scope => {
          const value = getScopeValue(scope);
          let icon = '👤';
          let description = scope.displayName;

          if (scope.type === 'folder') {
            icon = '📁';
          } else if (scope.type === 'github') {
            icon = '🔀'; // Git branch/merge icon - more appropriate for repositories
          }

          return (
            <option key={value} value={value}>
              {icon} {description}
            </option>
          );
        })}
      </Form.Select>

      {!isAuthenticated && (
        <small className="text-muted mt-1 d-block">
          Login for folder and repository scopes
        </small>
      )}
    </div>
  );
}
