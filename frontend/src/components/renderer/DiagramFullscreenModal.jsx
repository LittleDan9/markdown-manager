import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Modal, Button, ButtonGroup, Badge } from 'react-bootstrap';
import { useTheme } from '../../providers/ThemeProvider';
import { serviceFactory } from '../../services/injectors';

/**
 * Fullscreen modal for viewing and exporting diagrams
 *
 * Provides an enhanced viewing experience with:
 * - Fullscreen diagram display
 * - Export controls
 * - Diagram metadata display
 */
function DiagramFullscreenModal({ show, onHide, diagramElement, diagramId, diagramSource, svgContent }) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState(null);
  const mermaidExportService = serviceFactory.createMermaidExportService();

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

  const diagramMetadata = diagramElement ?
    mermaidExportService.extractDiagramMetadata(diagramElement) : null;

  const handleExport = async (format) => {
    if (!diagramElement) {
      showError('Diagram element not found');
      return;
    }

    setIsExporting(true);
    setExportFormat(format);

    try {
      let exportOptions;

      if (format === 'png') {
        // For PNG, use high-resolution natural dimensions for ultra-crisp fullscreen export
        exportOptions = {
          useNaturalDimensions: true,
          maxWidth: 3200,  // Ultra-high resolution for fullscreen export
          maxHeight: 2400,
          isDarkMode: isDarkMode
        };
      } else {
        // For SVG, use high resolution container
        exportOptions = {
          width: 2400,
          height: 1800,
          isDarkMode: isDarkMode
        };
      }

      const filename = mermaidExportService.generateFilename(
        diagramElement,
        `fullscreen-diagram-${diagramId}`
      );

      await mermaidExportService.downloadDiagram(
        diagramElement,
        format,
        filename,
        exportOptions
      );

      showSuccess(`High-resolution diagram exported as ${format.toUpperCase()}`);

    } catch (error) {
      console.error(`Export failed:`, error);
      showError(`Failed to export diagram: ${error.message}`);
    } finally {
      setIsExporting(false);
      setExportFormat(null);
    }
  };

  const renderDiagramContent = () => {
    if (!svgContent) {
      return (
        <div className="text-center text-muted p-4">
          <i className="bi bi-exclamation-triangle fs-1 mb-3"></i>
          <p>No diagram content available</p>
        </div>
      );
    }

    return (
      <div className="mermaid-container fullscreen-diagram">
        <div
          className="diagram-svg-container"
          dangerouslySetInnerHTML={{ __html: svgContent }}
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        />
      </div>
    );
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      size="xl"
      fullscreen
      className="diagram-fullscreen-modal"
    >
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="bi bi-diagram-3 me-2"></i>
          Diagram Viewer
          {diagramId && (
            <small className="text-muted ms-2">#{diagramId}</small>
          )}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {renderDiagramContent()}
      </Modal.Body>

      <Modal.Footer className="d-flex justify-content-between">
        {/* Diagram Metadata */}
        <div className="diagram-metadata">
          {diagramMetadata && (
            <div className="d-flex gap-2 align-items-center">
              <Badge bg="secondary">
                {diagramMetadata.type}
              </Badge>

              {diagramMetadata.hasArchitectureBeta && (
                <Badge bg="warning">
                  <i className="bi bi-diagram-2 me-1"></i>
                  Architecture
                </Badge>
              )}

              {diagramMetadata.hasCustomIcons && (
                <Badge bg="info">
                  <i className="bi bi-image me-1"></i>
                  Custom Icons
                </Badge>
              )}

              {diagramMetadata.hasAdvancedFeatures && (
                <Badge bg="warning">
                  <i className="bi bi-github me-1"></i>
                  Needs Conversion
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Export Controls */}
        <ButtonGroup>
          <Button
            variant="outline-primary"
            onClick={() => handleExport('svg')}
            disabled={isExporting}
          >
            {isExporting && exportFormat === 'svg' ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" />
                Exporting SVG...
              </>
            ) : (
              <>
                <i className="bi bi-file-earmark-image me-1"></i>
                Export SVG
              </>
            )}
          </Button>

          <Button
            variant="outline-secondary"
            onClick={() => handleExport('png')}
            disabled={isExporting}
          >
            {isExporting && exportFormat === 'png' ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" />
                Exporting PNG...
              </>
            ) : (
              <>
                <i className="bi bi-file-earmark-image-fill me-1"></i>
                Export PNG
              </>
            )}
          </Button>

          <Button variant="secondary" onClick={onHide}>
            <i className="bi bi-x-lg me-1"></i>
            Close
          </Button>
        </ButtonGroup>
      </Modal.Footer>
    </Modal>
  );
}

DiagramFullscreenModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
  diagramElement: PropTypes.object,
  diagramId: PropTypes.string,
  diagramSource: PropTypes.string,
  svgContent: PropTypes.string
};

export default DiagramFullscreenModal;