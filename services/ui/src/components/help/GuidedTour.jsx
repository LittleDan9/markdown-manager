import React, { useState, useCallback, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Joyride, STATUS, EVENTS } from 'react-joyride';
import tourSteps from './tourSteps';

const TOUR_COMPLETED_KEY = 'mm-tour-completed';

/**
 * Read the current Bootstrap theme and return Joyride-compatible colors.
 */
function getThemeColors() {
  const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
  if (isDark) {
    return {
      backgroundColor: '#1e293b',
      textColor: '#e2e8f0',
      arrowColor: '#1e293b',
      primaryColor: '#6366f1',
      overlayColor: 'rgba(0, 0, 0, 0.65)',
    };
  }
  return {
    backgroundColor: '#ffffff',
    textColor: '#1f2937',
    arrowColor: '#ffffff',
    primaryColor: '#4f6df5',
    overlayColor: 'rgba(0, 0, 0, 0.45)',
  };
}

/**
 * GuidedTour — interactive walkthrough using react-joyride.
 *
 * Props:
 *  - run: boolean, when true the tour starts
 *  - onFinish: callback when tour ends (completed or skipped)
 */
function GuidedTour({ run, onFinish }) {
  const [stepIndex, setStepIndex] = useState(0);

  // Snapshot theme colors when tour starts so they stay consistent
  const colors = useMemo(() => {
    if (!run) return getThemeColors();
    return getThemeColors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  // Reset step when tour restarts
  useEffect(() => {
    if (run) setStepIndex(0);
  }, [run]);

  const handleCallback = useCallback((data) => {
    const { status, type, index, action } = data;

    if (type === EVENTS.STEP_AFTER) {
      setStepIndex(index + 1);
    }

    // Close on skip, finish, or explicit close action
    if (
      [STATUS.FINISHED, STATUS.SKIPPED].includes(status) ||
      action === 'close'
    ) {
      localStorage.setItem(TOUR_COMPLETED_KEY, 'true');
      onFinish?.();
    }
  }, [onFinish]);

  return (
    <Joyride
      steps={tourSteps}
      run={run}
      stepIndex={stepIndex}
      continuous
      showSkipButton
      showProgress
      scrollToFirstStep
      callback={handleCallback}
      locale={{
        back: 'Back',
        close: 'Got it',
        last: 'Finish',
        next: 'Next',
        skip: 'Skip tour',
      }}
      options={{
        arrowColor: colors.arrowColor,
        backgroundColor: colors.backgroundColor,
        primaryColor: colors.primaryColor,
        textColor: colors.textColor,
        overlayColor: colors.overlayColor,
        spotlightPadding: 8,
        zIndex: 1070,
      }}
      styles={{
        tooltip: {
          borderRadius: '10px',
          fontSize: '0.9rem',
          padding: '1.25rem',
        },
        tooltipTitle: {
          fontSize: '1rem',
          fontWeight: 600,
          marginBottom: '0.5rem',
        },
        tooltipContent: {
          lineHeight: 1.6,
          padding: '0.25rem 0',
        },
        buttonNext: {
          borderRadius: '6px',
          fontSize: '0.85rem',
          padding: '0.4rem 1rem',
        },
        buttonBack: {
          borderRadius: '6px',
          fontSize: '0.85rem',
          color: colors.textColor,
          marginRight: '0.5rem',
        },
        buttonSkip: {
          fontSize: '0.8rem',
          color: colors.textColor,
          opacity: 0.7,
        },
        buttonClose: {
          top: '8px',
          right: '8px',
          width: '14px',
          height: '14px',
        },
        overlay: {
          mixBlendMode: 'normal',
        },
      }}
    />
  );
}

GuidedTour.propTypes = {
  run: PropTypes.bool.isRequired,
  onFinish: PropTypes.func,
};

GuidedTour.TOUR_COMPLETED_KEY = TOUR_COMPLETED_KEY;

export default GuidedTour;
