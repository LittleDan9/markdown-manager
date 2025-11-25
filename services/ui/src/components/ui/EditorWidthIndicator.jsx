import React from 'react';
import { Badge, Button, ButtonGroup, Alert } from 'react-bootstrap';
import { useUserSettings } from '@/providers/UserSettingsProvider';
import { useAuth } from '@/providers/AuthProvider';

/**
 * EditorWidthIndicator - Shows current editor width setting and storage source
 * Useful for debugging and showing users where their settings are stored
 */
function EditorWidthIndicator() {
  const {
    editorWidthPercentage,
    previewWidthPercentage,
    storageSource,
    isCustomized,
    updateEditorWidth,
    resetSettings,
    isLoading,
    error
  } = useUserSettings();

  const { isAuthenticated } = useAuth();

  const handlePresetWidth = (width) => {
    updateEditorWidth(width);
  };

  if (isLoading) {
    return (
      <div className="d-flex align-items-center gap-2">
        <span className="text-muted">Loading editor settings...</span>
      </div>
    );
  }

  return (
    <div className="d-flex align-items-center gap-2 flex-wrap">
      {/* Current width display */}
      <div className="d-flex align-items-center gap-1">
        <span className="text-muted small">Editor:</span>
        <Badge bg="primary">{editorWidthPercentage}%</Badge>
        <span className="text-muted small">Preview:</span>
        <Badge bg="secondary">{previewWidthPercentage}%</Badge>
      </div>

      {/* Storage source indicator */}
      <Badge
        bg={storageSource === 'backend' ? 'success' : 'info'}
        title={`Settings stored in ${storageSource}`}
      >
        {storageSource === 'backend' ? '☁️ Synced' : '💾 Local'}
      </Badge>

      {/* Authentication status */}
      {!isAuthenticated && (
        <Badge bg="warning" className="small">
          Guest Mode
        </Badge>
      )}

      {/* Quick preset buttons */}
      <ButtonGroup size="sm">
        <Button
          variant="outline-secondary"
          size="sm"
          onClick={() => handlePresetWidth(30)}
          active={editorWidthPercentage === 30}
        >
          30%
        </Button>
        <Button
          variant="outline-secondary"
          size="sm"
          onClick={() => handlePresetWidth(40)}
          active={editorWidthPercentage === 40}
        >
          40%
        </Button>
        <Button
          variant="outline-secondary"
          size="sm"
          onClick={() => handlePresetWidth(50)}
          active={editorWidthPercentage === 50}
        >
          50%
        </Button>
        <Button
          variant="outline-secondary"
          size="sm"
          onClick={() => handlePresetWidth(60)}
          active={editorWidthPercentage === 60}
        >
          60%
        </Button>
      </ButtonGroup>

      {/* Reset button (only show if customized) */}
      {isCustomized && (
        <Button
          variant="outline-secondary"
          size="sm"
          onClick={resetSettings}
          title="Reset to default (40%)"
        >
          Reset
        </Button>
      )}

      {/* Error display */}
      {error && (
        <Alert variant="warning" className="small mb-0 p-1">
          {error}
        </Alert>
      )}
    </div>
  );
}

export default EditorWidthIndicator;