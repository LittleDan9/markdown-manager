import React from 'react';
import { Button, ButtonGroup } from 'react-bootstrap';
import { useTheme } from '@/providers/ThemeProvider';

/**
 * Spell Check toolbar group with mini progress indicator
 */
export function SpellCheckGroup({ onSpellCheck, buttonVariant, buttonStyle, progress }) {
  const { theme } = useTheme();
  
  const progressBarColor = theme === 'dark' ? '#fff' : '#000';
  const progressTextColor = theme === 'dark' ? '#adb5bd' : '#6c757d';
  
  return (
    <div className="d-flex align-items-center gap-2">
      <ButtonGroup size="sm">
        <Button
          variant={buttonVariant}
          style={buttonStyle}
          onClick={onSpellCheck}
          title="Run Spell Check"
          disabled={!!progress}
        >
          <i className="bi bi-spellcheck"></i>
        </Button>
      </ButtonGroup>
      
      {progress && (
        <div className="d-flex align-items-center" style={{ minWidth: '80px' }}>
          <div style={{ fontSize: '10px', minWidth: '80px' }}>
            <div 
              className="progress" 
              style={{ 
                height: '3px', 
                width: '60px',
                backgroundColor: theme === 'dark' ? '#495057' : '#e9ecef'
              }}
            >
              <div
                className="progress-bar"
                style={{ 
                  width: `${Math.min(progress.percentComplete || 0, 100)}%`,
                  backgroundColor: progressBarColor
                }}
              ></div>
            </div>
            <div style={{ color: progressTextColor, lineHeight: '1.2', marginTop: '1px' }}>
              {Math.round(progress.percentComplete || 0)}%
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
