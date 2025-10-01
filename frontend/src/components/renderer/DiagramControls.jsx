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
      controlsRef.current.classList.add('interaction-active');

      // Clear any existing timeout
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }

      // Set timeout to remove the class after interaction is complete
      interactionTimeoutRef.current = setTimeout(() => {
        if (controlsRef.current) {
          controlsRef.current.classList.remove('interaction-active');
        }
      }, 3000); // Stay visible for 3 seconds after interaction
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

  const handleExport = async (format) => {
    if (!diagramElement) {
      showError('Diagram element not found');
      return;
    }

    setIsExporting(true);
    setExportFormat(format);
    markInteractionActive(); // Keep controls visible during and after export

    try {
      const exportOptions = {
        width: 1200,
        height: 800,
        isDarkMode: isDarkMode
      };

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
    }
  };

  const handleFullscreen = () => {
    markInteractionActive(); // Keep controls visible during fullscreen interaction
    const svgContent = getSvgContent();

    if (onFullscreen) {
      onFullscreen(diagramElement, diagramId, diagramSource);
    } else {
      setShowFullscreen(true);
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
        onHide={() => setShowFullscreen(false)}
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