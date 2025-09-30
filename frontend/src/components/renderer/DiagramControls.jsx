import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Button, ButtonGroup, Dropdown, Spinner } from 'react-bootstrap';
import { useNotification } from '../NotificationProvider';
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

  // Use context with fallback values
  const notificationContext = useNotification();
  const themeContext = useTheme();

  const showSuccess = notificationContext?.showSuccess || ((msg) => console.log(`Success: ${msg}`));
  const showError = notificationContext?.showError || ((msg) => console.error(`Error: ${msg}`));
  const theme = themeContext?.theme || 'light';
  const isDarkMode = theme === 'dark';

  // Check if diagram needs GitHub conversion
  const needsConversion = diagramElement ?
    MermaidExportService.needsGitHubConversion(diagramElement) : false;

  // Extract SVG content for fullscreen modal
  const getSvgContent = () => {
    if (!diagramElement) {
      return null;
    }
    const svgElement = diagramElement.querySelector('svg');
    const svgContent = svgElement ? svgElement.outerHTML : null;
    return svgContent;
  };

  const handleExport = async (format) => {
    if (!diagramElement) {
      showError('Diagram element not found');
      return;
    }

    setIsExporting(true);
    setExportFormat(format);

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
    }
  };

  const handleFullscreen = () => {
    const svgContent = getSvgContent();

    if (onFullscreen) {
      onFullscreen(diagramElement, diagramId, diagramSource);
    } else {
      setShowFullscreen(true);
    }
  };

  return (
    <>
      <div className="diagram-controls">
        <ButtonGroup size="sm">
          {/* Fullscreen Button */}
          <Button
            variant="outline-secondary"
            onClick={handleFullscreen}
            title="View fullscreen"
            className="diagram-control-btn"
          >
            <i className="bi bi-fullscreen"></i>
          </Button>

          {/* Export Dropdown */}
          <Dropdown>
            <Dropdown.Toggle
              variant="outline-secondary"
              size="sm"
              disabled={isExporting}
              className="diagram-control-btn"
              title="Export diagram"
            >
              {isExporting ? (
                <>
                  <Spinner animation="border" size="sm" className="me-1" />
                  {exportFormat?.toUpperCase()}
                </>
              ) : (
                <i className="bi bi-download"></i>
              )}
            </Dropdown.Toggle>

            <Dropdown.Menu>
              <Dropdown.Item
                onClick={() => handleExport('svg')}
                disabled={isExporting}
              >
                <i className="bi bi-file-earmark-image me-2"></i>
                Export as SVG
              </Dropdown.Item>
              <Dropdown.Item
                onClick={() => handleExport('png')}
                disabled={isExporting}
              >
                <i className="bi bi-file-earmark-image-fill me-2"></i>
                Export as PNG
              </Dropdown.Item>

              {needsConversion && (
                <>
                  <Dropdown.Divider />
                  <Dropdown.Item disabled className="text-muted">
                    <i className="bi bi-github me-2"></i>
                    GitHub conversion available
                  </Dropdown.Item>
                </>
              )}
            </Dropdown.Menu>
          </Dropdown>

          {/* GitHub Conversion Indicator */}
          {needsConversion && (
            <Button
              variant="outline-warning"
              size="sm"
              title="This diagram uses advanced features that need conversion for GitHub compatibility"
              className="diagram-control-btn github-indicator"
              disabled
            >
              <i className="bi bi-exclamation-triangle"></i>
            </Button>
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