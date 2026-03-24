import { useState, useEffect } from 'react';

const BREAKPOINT_SM = 576;
const BREAKPOINT_MD = 768;

function getViewport() {
  const width = window.innerWidth;
  return {
    isMobile: width <= BREAKPOINT_SM,
    isTablet: width > BREAKPOINT_SM && width <= BREAKPOINT_MD,
    isDesktop: width > BREAKPOINT_MD,
    width,
  };
}

/**
 * useViewport - Provides responsive breakpoint state via matchMedia listeners.
 * Returns { isMobile, isTablet, isDesktop, width }
 */
export function useViewport() {
  const [viewport, setViewport] = useState(getViewport);

  useEffect(() => {
    const mqlMobile = window.matchMedia(`(max-width: ${BREAKPOINT_SM}px)`);
    const mqlTablet = window.matchMedia(`(min-width: ${BREAKPOINT_SM + 1}px) and (max-width: ${BREAKPOINT_MD}px)`);

    const update = () => setViewport(getViewport());

    mqlMobile.addEventListener('change', update);
    mqlTablet.addEventListener('change', update);

    return () => {
      mqlMobile.removeEventListener('change', update);
      mqlTablet.removeEventListener('change', update);
    };
  }, []);

  return viewport;
}

export default useViewport;
