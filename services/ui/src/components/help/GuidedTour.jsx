import React, { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Joyride, STATUS, EVENTS } from 'react-joyride';
import tourSteps from './tourSteps';

const TOUR_COMPLETED_KEY = 'mm-tour-completed';

/**
 * GuidedTour — interactive walkthrough using react-joyride.
 *
 * Props:
 *  - run: boolean, when true the tour starts
 *  - onFinish: callback when tour ends (completed or skipped)
 */
function GuidedTour({ run, onFinish }) {
  const [stepIndex, setStepIndex] = useState(0);

  // Reset step when tour restarts
  useEffect(() => {
    if (run) setStepIndex(0);
  }, [run]);

  const handleCallback = useCallback((data) => {
    const { status, type, index } = data;

    if (type === EVENTS.STEP_AFTER) {
      setStepIndex(index + 1);
    }

    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
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
      disableOverlayClose
      callback={handleCallback}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Finish',
        next: 'Next',
        skip: 'Skip tour',
      }}
      styles={{
        options: {
          zIndex: 1070,
          primaryColor: 'var(--bs-primary)',
        },
        tooltip: {
          borderRadius: '10px',
          fontSize: '0.9rem',
        },
        buttonNext: {
          borderRadius: '6px',
          fontSize: '0.85rem',
        },
        buttonBack: {
          borderRadius: '6px',
          fontSize: '0.85rem',
        },
        buttonSkip: {
          fontSize: '0.8rem',
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
