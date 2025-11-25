import React, { useState, useEffect, useRef } from 'react';
import { Button, ButtonGroup } from 'react-bootstrap';
import SpellCheckSettingsModal from '../spell-check/SpellCheckSettingsModal';

/**
 * Analysis Tools toolbar group with spell check and markdown lint buttons
 * Phase 5: Enhanced with modal-based settings following UserMenu pattern
 * Now with fluid responsive design based on container width
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
  const [availableWidth, setAvailableWidth] = useState(1000); // Start with generous width
  const containerRef = useRef(null);

  // Phase 5: Settings modal visibility
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Monitor parent toolbar width for responsive behavior
  useEffect(() => {
    // Find the parent toolbar container
    const findToolbar = (element) => {
      let current = element?.parentElement;
      while (current && !current.classList.contains('markdown-toolbar')) {
        current = current.parentElement;
      }
      return current;
    };

    const container = containerRef.current;
    if (!container) return;

    const toolbar = findToolbar(container);
    if (!toolbar) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setAvailableWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(toolbar);

    // Initial measurement
    setAvailableWidth(toolbar.offsetWidth);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Determine which buttons to show based on available toolbar width
  // Hide entire group on very small screens to prevent wrapping
  const showSettingsButton = availableWidth > 300; // Show settings unless very cramped
  const showLintButton = availableWidth > 200; // Show lint unless extremely cramped
  const showSpellCheckButton = availableWidth > 100; // Hide spell check on tiny screens (< 100px)

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
      <div className="analysis-tools" ref={containerRef}>
        <ButtonGroup size="sm">
          {/* Spell Check Button - Show on most screen sizes */}
          {showSpellCheckButton && (
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
          )}

          {/* Markdown Lint Button - Show on medium+ screens */}
          {showLintButton && (
            <Button
              variant={buttonVariant}
              style={buttonStyle}
              onClick={handleMarkdownLintClick}
              title={isMarkdownLintRunning ? "Running Markdown Lint..." : "Run Markdown Lint"}
              disabled={isSpellCheckRunning || isMarkdownLintRunning}
            >
              <i className={isMarkdownLintRunning ? "bi bi-arrow-repeat spin" : "bi bi-file-text-fill"}></i>
            </Button>
          )}

          {/* Settings Button - Show only on wide screens */}
          {showSettingsButton && (
            <Button
              variant={buttonVariant}
              style={buttonStyle}
              onClick={() => setShowSettingsModal(true)}
              title="Spell Check Settings"
              disabled={isSpellCheckRunning || isMarkdownLintRunning}
            >
              <i className="bi bi-gear"></i>
            </Button>
          )}
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
