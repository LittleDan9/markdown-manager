import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Button, ButtonGroup, Dropdown, Spinner, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useTheme } from '../../providers/ThemeProvider';
import MermaidExportService from '../../services/rendering/MermaidExportService';
import DiagramFullscreenModal from './DiagramFullscreenModal';

/**
 * Overlay controls for Mermaid diagrams providing expand/download functionality
 *
 * This component provides user-facing controls for:
 * - Fullscreen diagram viewing
 * - SVG/PNG export and download
 * - GitHub compatibility indicators
 */
function DiagramControls({ diagramElement, diagramId, diagramSource, onFullscreen }) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState(null);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const controlsRef = useRef(null);
  const interactionTimeoutRef = useRef(null);

  // Use context with fallback values
  const themeContext = useTheme();

  // Use event-based notifications to avoid portal context issues
  const showSuccess = (message) => {
    window.dispatchEvent(new CustomEvent('notification', {
      detail: { message, type: 'success', duration: 5000 }
    }));
  };

  const showError = (message) => {
    window.dispatchEvent(new CustomEvent('notification', {
      detail: { message, type: 'danger', duration: 8000 }
    }));
  };
  const theme = themeContext?.theme || 'light';
  const isDarkMode = theme === 'dark';

  // Check if diagram needs GitHub conversion
  const needsConversion = diagramElement ?
    MermaidExportService.needsGitHubConversion(diagramElement, diagramSource) : false;

  // Extract SVG content for fullscreen modal
  const getSvgContent = () => {
    if (!diagramElement) {
      return null;
    }
    const svgElement = diagramElement.querySelector('svg');
    const svgContent = svgElement ? svgElement.outerHTML : null;
    return svgContent;
  };

  // Manage interaction visibility
  const markInteractionActive = () => {
    if (controlsRef.current) {
      // Clear any existing timeout first
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }

      // Reset styles before applying new ones to avoid conflicts
      controlsRef.current.style.transition = '';
      controlsRef.current.style.opacity = '';
      
      // Add the interaction class
      controlsRef.current.classList.add('interaction-active');
      
      // Force visibility immediately to prevent flickering
      controlsRef.current.style.opacity = '1';
      controlsRef.current.style.transition = 'opacity 0.2s ease-in-out 2s';

      // Set timeout to remove the class after interaction is complete
      interactionTimeoutRef.current = setTimeout(() => {
        if (controlsRef.current) {
          controlsRef.current.classList.remove('interaction-active');
          // Reset to CSS-controlled transition
          controlsRef.current.style.transition = '';
          controlsRef.current.style.opacity = '';
        }
        interactionTimeoutRef.current = null;
      }, 3000); // 3 seconds for export operations
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }
    };
  }, []);

  // Add a helper function to debug control state (can be called from browser console)
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current._debugControlState = () => {
        console.log('DiagramControls Debug State:', {
          diagramId,
          hasInteractionClass: controlsRef.current?.classList.contains('interaction-active'),
          opacity: window.getComputedStyle(controlsRef.current).opacity,
          isExporting,
          showFullscreen,
          timeoutActive: !!interactionTimeoutRef.current
        });
      };
    }
  }, [diagramId, isExporting, showFullscreen]);

  // Monitor controls visibility after interactions to prevent disappearing
  useEffect(() => {
    if (!controlsRef.current) return;

    let visibilityInterval;

    const checkVisibility = () => {
      if (controlsRef.current && controlsRef.current.classList.contains('interaction-active')) {
        const computedStyle = window.getComputedStyle(controlsRef.current);
        const opacity = parseFloat(computedStyle.opacity);
        
        // If controls are supposed to be visible but aren't, force visibility
        if (opacity < 0.5) {
          console.log('Detected invisible controls, forcing visibility');
          controlsRef.current.style.opacity = '1';
          controlsRef.current.style.transition = 'opacity 0.2s ease-in-out';
        }
      }
    };

    const startMonitoring = () => {
      if (visibilityInterval) clearInterval(visibilityInterval);
      visibilityInterval = setInterval(checkVisibility, 2000); // Check every 2 seconds instead of 1
    };

    const stopMonitoring = () => {
      if (visibilityInterval) {
        clearInterval(visibilityInterval);
        visibilityInterval = null;
      }
    };

    // Start monitoring when interaction becomes active
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          if (controlsRef.current.classList.contains('interaction-active')) {
            startMonitoring();
          } else {
            stopMonitoring();
          }
        }
      });
    });

    observer.observe(controlsRef.current, { attributes: true });

    return () => {
      observer.disconnect();
      stopMonitoring();
    };
  }, []);

  const handleExport = async (format) => {
    if (!diagramElement) {
      showError('Diagram element not found');
      return;
    }

    setIsExporting(true);
    setExportFormat(format);
    markInteractionActive(); // Keep controls visible during and after export

    try {
      let exportOptions;

      if (format === 'png') {
        // For PNG, use high-resolution natural dimensions for crisp quality
        exportOptions = {
          useNaturalDimensions: true,
          maxWidth: 2400,  // High resolution for crisp output
          maxHeight: 1800,
          isDarkMode: isDarkMode
        };
      } else {
        // For SVG, use standard container dimensions
        exportOptions = {
          width: 1200,
          height: 800,
          isDarkMode: isDarkMode
        };
      }

      const filename = MermaidExportService.generateFilename(diagramElement, `diagram-${diagramId}`);

      await MermaidExportService.downloadDiagram(
        diagramElement,
        format,
        filename,
        exportOptions
      );

      showSuccess(`Diagram exported as ${format.toUpperCase()}`);

    } catch (error) {
      console.error(`Export failed:`, error);
      showError(`Failed to export diagram: ${error.message}`);
    } finally {
      setIsExporting(false);
      setExportFormat(null);
      markInteractionActive(); // Keep controls visible after export completes
      
      // Dispatch event to notify parent that controls need to be re-validated
      // This helps ensure controls remain available after export
      window.dispatchEvent(new CustomEvent('diagramExportComplete', {
        detail: { diagramId, format }
      }));
    }
  };

  const handleFullscreen = () => {
    const svgContent = getSvgContent();

    // Add modal interaction class to parent container to keep controls visible
    if (diagramElement) {
      diagramElement.classList.add('modal-interaction');
      // Remove the class after a short delay and ensure controls reset properly
      setTimeout(() => {
        if (diagramElement) {
          diagramElement.classList.remove('modal-interaction');
          // Clear any forced styles to ensure natural hover behavior returns
          if (controlsRef.current) {
            controlsRef.current.style.opacity = '';
            controlsRef.current.style.transition = '';
            controlsRef.current.classList.remove('interaction-active');
          }
        }
      }, 2000); // Reduced to 2 seconds for quicker return to normal behavior
    }

    if (onFullscreen) {
      onFullscreen(diagramElement, diagramId, diagramSource);
    } else {
      setShowFullscreen(true);
    }
  };

  // Handle modal close to ensure controls reset properly
  const handleModalClose = () => {
    setShowFullscreen(false);
    
    // Immediately clear any forced interaction states when modal closes
    if (controlsRef.current) {
      // Clear the interaction-active class and styles immediately
      controlsRef.current.classList.remove('interaction-active');
      controlsRef.current.style.opacity = '';
      controlsRef.current.style.transition = '';
    }
    
    // Clear any existing timeout
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
      interactionTimeoutRef.current = null;
    }
  };

  return (
    <>
      <div className="diagram-controls" ref={controlsRef}>
        <ButtonGroup size="sm">
          {/* Fullscreen Button */}
          <Button
            variant="outline-secondary"
            onClick={handleFullscreen}
            title="View fullscreen"
          >
            <i className="bi bi-arrows-fullscreen"></i>
          </Button>

          {/* Export Dropdown */}
          <Dropdown as={ButtonGroup}>
            <Dropdown.Toggle
              variant="outline-secondary"
              size="sm"
              disabled={isExporting}
              title="Export diagram"
              id={`export-dropdown-${diagramId}`}
            >
              {isExporting ? (
                <>
                  <Spinner animation="border" size="sm" className="me-1" />
                  <span className="visually-hidden">Exporting...</span>
                </>
              ) : (
                <i className="bi bi-download"></i>
              )}
            </Dropdown.Toggle>

            <Dropdown.Menu align="end">
              <Dropdown.Item
                onClick={() => handleExport('svg')}
                disabled={isExporting}
              >
                <i className="bi bi-file-earmark-code me-2"></i>
                Export as SVG
              </Dropdown.Item>
              <Dropdown.Item
                onClick={() => handleExport('png')}
                disabled={isExporting}
              >
                <i className="bi bi-file-earmark-image me-2"></i>
                Export as PNG
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>

          {/* GitHub Conversion Indicator */}
          {needsConversion && (
            <OverlayTrigger
              placement="bottom"
              overlay={
                <Tooltip id={`github-tooltip-${diagramId}`}>
                  <strong>GitHub conversion available</strong><br />
                  This diagram uses advanced features that can be automatically converted to static images when saving to GitHub repositories.
                </Tooltip>
              }
            >
              <span className="d-inline-flex">
                <Button
                  variant="outline-info"
                  size="sm"
                  disabled
                >
                  <i className="bi bi-github"></i>
                </Button>
              </span>
            </OverlayTrigger>
          )}
        </ButtonGroup>
      </div>

      {/* Fullscreen Modal */}
      <DiagramFullscreenModal
        show={showFullscreen}
        onHide={handleModalClose}
        diagramElement={diagramElement}
        diagramId={diagramId}
        diagramSource={diagramSource}
        svgContent={getSvgContent()}
      />
    </>
  );
}

DiagramControls.propTypes = {
  diagramElement: PropTypes.object,
  diagramId: PropTypes.string.isRequired,
  diagramSource: PropTypes.string,
  onFullscreen: PropTypes.func
};

export default DiagramControls;