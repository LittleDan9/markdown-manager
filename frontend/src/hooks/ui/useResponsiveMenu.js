import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for managing responsive menu behavior
 * @param {Object} options Configuration options
 * @param {number} options.fullMenuHeight - Height threshold for showing full menu (default: 800)
 * @param {number} options.mediumMenuHeight - Height threshold for showing medium menu (default: 600)
 * @param {number} options.compactMenuHeight - Height threshold for showing compact menu (default: 400)
 * @returns {Object} Menu configuration and utilities
 */
export const useResponsiveMenu = ({
  fullMenuHeight = 800,
  mediumMenuHeight = 600,
  compactMenuHeight = 400
} = {}) => {
  const [menuSize, setMenuSize] = useState('full');
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);

  const updateMenuSize = useCallback(() => {
    const height = window.innerHeight;
    setWindowHeight(height);

    if (height >= fullMenuHeight) {
      setMenuSize('full');
    } else if (height >= mediumMenuHeight) {
      setMenuSize('medium');
    } else {
      setMenuSize('compact');
    }
  }, [fullMenuHeight, mediumMenuHeight, compactMenuHeight]);

  useEffect(() => {
    updateMenuSize();
    
    const handleResize = () => {
      updateMenuSize();
    };

    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [updateMenuSize]);

  const isFullMenu = menuSize === 'full';
  const isMediumMenu = menuSize === 'medium';
  const isCompactMenu = menuSize === 'compact';

  return {
    menuSize,
    windowHeight,
    isFullMenu,
    isMediumMenu,
    isCompactMenu,
    // Utility functions for conditional rendering
    showInFull: (condition = true) => isFullMenu && condition,
    showInMedium: (condition = true) => (isFullMenu || isMediumMenu) && condition,
    hideInCompact: (condition = true) => !isCompactMenu && condition,
  };
};

export default useResponsiveMenu;