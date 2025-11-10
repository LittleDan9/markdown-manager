/**
 * HoverControls - Unified hover control system for both images and diagrams
 *
 * This component provides a consistent approach to hover controls across
 * different content types, ensuring unified styling and behavior.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useTheme } from '../../providers/ThemeProvider';

const HoverControls = ({
  targetElement,
  controls,
  position = 'top-right',
  showCondition = true,
  className = '',
  onControlsCreated,
  onControlsDestroyed
}) => {
  const { theme: _theme } = useTheme();
  const [isVisible, setIsVisible] = useState(false);
  const controlsRef = useRef(null);
  const themeObserverRef = useRef(null);

  // Create control button element
  const createControlButton = (control) => {
    const button = document.createElement('button');
    button.className = `btn btn-sm hover-control-btn ${control.className || ''}`;
    button.innerHTML = control.icon;
    button.title = control.title;

    // Base button styles
    Object.assign(button.style, {
      width: '24px',
      height: '24px',
      padding: '0',
      fontSize: '12px',
      border: 'none',
      borderRadius: '3px',
      marginRight: control.isLast ? '0' : '4px',
      transition: 'all 0.2s ease',
      cursor: 'pointer'
    });

    // Apply theme-aware styling
    const applyTheme = () => {
      const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
      const buttonStyle = {
        background: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.9)',
        color: isDark ? 'white' : '#333'
      };
      Object.assign(button.style, buttonStyle);
    };

    applyTheme();

    // Add hover effects
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.1)';
      const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
      button.style.background = isDark ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 1)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
      applyTheme();
    });

    // Add click handler
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      control.onClick(e);
    });

    return { button, applyTheme };
  };

  // Get position styles based on position prop
  const getPositionStyles = useCallback(() => {
    const baseStyles = {
      position: 'absolute',
      zIndex: '20',
      background: 'rgba(0, 0, 0, 0.7)',
      borderRadius: '4px',
      padding: '4px',
      gap: '4px',
      display: 'none',
      pointerEvents: 'none'
    };

    switch (position) {
      case 'top-right':
        return { ...baseStyles, top: '8px', right: '8px' };
      case 'top-left':
        return { ...baseStyles, top: '8px', left: '8px' };
      case 'bottom-right':
        return { ...baseStyles, bottom: '8px', right: '8px' };
      case 'bottom-left':
        return { ...baseStyles, bottom: '8px', left: '8px' };
      case 'center':
        return {
          ...baseStyles,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        };
      default:
        return { ...baseStyles, top: '8px', right: '8px' };
    }
  }, [position]);

  // Setup controls
  useEffect(() => {
    if (!targetElement || !controls || controls.length === 0) return;

    // Create controls container
    const controlsContainer = document.createElement('div');
    controlsContainer.className = `hover-controls-container ${className}`;

    const positionStyles = getPositionStyles();
    Object.assign(controlsContainer.style, positionStyles);

    // Update theme-aware overlay background
    const updateOverlayTheme = () => {
      const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
      controlsContainer.style.background = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.7)';
    };

    updateOverlayTheme();

    // Create buttons and their theme functions
    const buttonData = controls.map((control, index) => {
      const isLast = index === controls.length - 1;
      return createControlButton({ ...control, isLast });
    });

    // Add buttons to container
    buttonData.forEach(({ button }) => {
      controlsContainer.appendChild(button);
    });

    // Setup theme observer
    const themeObserver = new MutationObserver(() => {
      updateOverlayTheme();
      buttonData.forEach(({ applyTheme }) => applyTheme());
    });

    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-bs-theme']
    });

    themeObserverRef.current = themeObserver;

    // Add hover functionality to target element
    const showControls = () => {
      if (showCondition) {
        controlsContainer.style.display = 'flex';
        setIsVisible(true);
      }
    };

    const hideControls = () => {
      if (showCondition) {
        controlsContainer.style.display = 'none';
        setIsVisible(false);
      }
    };

    targetElement.addEventListener('mouseenter', showControls);
    targetElement.addEventListener('mouseleave', hideControls);

    // Add controls to target element
    targetElement.appendChild(controlsContainer);
    controlsRef.current = {
      container: controlsContainer,
      showControls,
      hideControls,
      cleanup: () => {
        targetElement.removeEventListener('mouseenter', showControls);
        targetElement.removeEventListener('mouseleave', hideControls);
        if (controlsContainer.parentNode) {
          controlsContainer.parentNode.removeChild(controlsContainer);
        }
        if (themeObserver) {
          themeObserver.disconnect();
        }
      }
    };

    // Notify parent of controls creation
    if (onControlsCreated) {
      onControlsCreated(controlsRef.current);
    }

    // Cleanup function
    return () => {
      if (controlsRef.current) {
        controlsRef.current.cleanup();
        if (onControlsDestroyed) {
          onControlsDestroyed();
        }
      }
    };
  }, [targetElement, controls, position, showCondition, className, getPositionStyles, onControlsCreated, onControlsDestroyed]);

  // Force show/hide based on showCondition
  useEffect(() => {
    if (controlsRef.current) {
      if (showCondition) {
        // Only show if mouse is over the element
        if (isVisible) {
          controlsRef.current.showControls();
        }
      } else {
        controlsRef.current.hideControls();
      }
    }
  }, [showCondition, isVisible]);

  // This component doesn't render anything directly - it manages DOM elements
  return null;
};

export default HoverControls;