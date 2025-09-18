import React from 'react';
import { Button, ButtonGroup } from 'react-bootstrap';
import { useTheme } from '@/providers/ThemeProvider';

/**
 * Analysis Tools toolbar group with spell check and markdown lint buttons
 */
export function SpellCheckGroup({
  onSpellCheck,
  onMarkdownLint,
  buttonVariant,
  buttonStyle,
  spellCheckProgress,
  markdownLintProgress
}) {
  const { theme } = useTheme();

  const progressBarColor = theme === 'dark' ? '#fff' : '#000';
  const progressTextColor = theme === 'dark' ? '#adb5bd' : '#6c757d';

  // Show progress for whichever tool is active
  const activeProgress = spellCheckProgress || markdownLintProgress;
  const progressLabel = spellCheckProgress ? 'Spell' : markdownLintProgress ? 'Lint' : '';

  return (
    <div className="d-flex align-items-center">
      <ButtonGroup size="sm">
        <Button
          variant={buttonVariant}
          style={buttonStyle}
          onClick={onSpellCheck}
          title="Run Spell Check"
          disabled={!!(spellCheckProgress || markdownLintProgress)}
        >
          <i className="bi bi-spellcheck"></i>
        </Button>
        <Button
          variant={buttonVariant}
          style={buttonStyle}
          onClick={onMarkdownLint}
          title="Run Markdown Lint"
          disabled={!!(spellCheckProgress || markdownLintProgress)}
        >
          <i className="bi bi-file-text-fill"></i>
        </Button>
      </ButtonGroup>

      {activeProgress && (
        <div className="ms-2 d-flex align-items-center">
          <div style={{ fontSize: '8px', width: '35px' }}>
            <div
              className="progress"
              style={{
                height: '2px',
                width: '30px',
                backgroundColor: theme === 'dark' ? '#495057' : '#e9ecef'
              }}
            >
              <div
                className="progress-bar"
                style={{
                  width: `${Math.min(activeProgress.percentComplete || activeProgress.progress || 0, 100)}%`,
                  backgroundColor: progressBarColor
                }}
              ></div>
            </div>
            <div style={{ color: progressTextColor, lineHeight: '1', marginTop: '1px' }}>
              {progressLabel} {Math.round(activeProgress.percentComplete || activeProgress.progress || 0)}%
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
