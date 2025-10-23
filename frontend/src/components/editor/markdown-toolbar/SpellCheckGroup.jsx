import React, { useState, useEffect } from 'react';
import { Button, ButtonGroup } from 'react-bootstrap';
import SpellCheckSettingsModal from '../spell-check/SpellCheckSettingsModal';

/**
 * Analysis Tools toolbar group with spell check and markdown lint buttons
 * Phase 5: Enhanced with modal-based settings following UserMenu pattern
 */
export function SpellCheckGroup({
  onSpellCheck,
  onMarkdownLint,
  buttonVariant,
  buttonStyle,
  spellCheckProgress,
  markdownLintProgress,
  // Phase 5 new props
  onSpellCheckSettings = () => {},
  spellCheckSettings = {},
  readabilityData = null,
  serviceInfo = null
}) {
  const [isSpellCheckVisible, setIsSpellCheckVisible] = useState(false);
  const [isMarkdownLintVisible, setIsMarkdownLintVisible] = useState(false);
  
  // Phase 5: Settings modal visibility
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Handle spell check progress with minimum visible duration
  useEffect(() => {
    if (spellCheckProgress && spellCheckProgress.percentComplete >= 0 && spellCheckProgress.percentComplete < 100) {
      setIsSpellCheckVisible(true);
    } else if (spellCheckProgress && spellCheckProgress.percentComplete >= 100) {
      // Keep spinner visible for at least 1000ms (1.25 full rotations at 0.6s each)
      setTimeout(() => setIsSpellCheckVisible(false), 1000);
    } else if (!spellCheckProgress) {
      // If no progress at all, clear immediately
      setIsSpellCheckVisible(false);
    }
  }, [spellCheckProgress]);

  // Handle markdown lint progress with minimum visible duration
  useEffect(() => {
    if (markdownLintProgress && markdownLintProgress.percentComplete >= 0 && markdownLintProgress.percentComplete < 100) {
      setIsMarkdownLintVisible(true);
    } else if (markdownLintProgress && markdownLintProgress.percentComplete >= 100) {
      // Keep spinner visible for at least 1000ms (1.25 full rotations at 0.6s each)
      setTimeout(() => setIsMarkdownLintVisible(false), 1000);
    } else if (!markdownLintProgress) {
      // If no progress at all, clear immediately
      setIsMarkdownLintVisible(false);
    }
  }, [markdownLintProgress]);

  const isSpellCheckRunning = isSpellCheckVisible;
  const isMarkdownLintRunning = isMarkdownLintVisible;

  const handleSpellCheckClick = () => {
    onSpellCheck(spellCheckSettings);
  };

  const handleMarkdownLintClick = () => {
    onMarkdownLint();
  };

  const handleSettingsChange = (newSettings) => {
    onSpellCheckSettings(newSettings);
  };

  return (
    <>
      <div className="analysis-tools">
        <ButtonGroup size="sm">
          {/* Spell Check Button */}
          <Button
            variant={buttonVariant}
            style={buttonStyle}
            onClick={handleSpellCheckClick}
            title={isSpellCheckRunning ? "Running Spell Check..." : "Run Spell Check"}
            disabled={isSpellCheckRunning || isMarkdownLintRunning}
          >
            <i
              className={isSpellCheckRunning ? "bi bi-arrow-repeat spin" : "bi bi-spellcheck"}
            ></i>
          </Button>

          {/* Markdown Lint Button */}
          <Button
            variant={buttonVariant}
            style={buttonStyle}
            onClick={handleMarkdownLintClick}
            title={isMarkdownLintRunning ? "Running Markdown Lint..." : "Run Markdown Lint"}
            disabled={isSpellCheckRunning || isMarkdownLintRunning}
          >
            <i className={isMarkdownLintRunning ? "bi bi-arrow-repeat spin" : "bi bi-file-text-fill"}></i>
          </Button>
        </ButtonGroup>
      </div>

      {/* Settings Modal */}
      <SpellCheckSettingsModal
        show={showSettingsModal}
        onHide={() => setShowSettingsModal(false)}
        settings={spellCheckSettings}
        onSettingsChange={handleSettingsChange}
        readabilityData={readabilityData}
        serviceInfo={serviceInfo}
      />
    </>
  );
}
