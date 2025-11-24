import { logger } from "@/providers/LoggerProvider.jsx";

// Create service-specific logger
const serviceLogger = logger.createServiceLogger('MermaidValidator');

/**
 * Mermaid diagram validation and error handling service
 * Handles validation, error detection, and error display for Mermaid diagrams
 */
class MermaidValidator {
  /**
   * Validate the Mermaid diagram source
   * @param {string} diagramSource - The Mermaid diagram source code
   * @returns {string|null} - Returns an error message if invalid, otherwise null
   */
  validateDiagramSource(diagramSource) {
    if (!diagramSource || !diagramSource.trim()) {
      return "Diagram source is empty.";
    }
    // Let Mermaid handle the rest of the validation
    return null;
  }

  /**
   * Check if the SVG contains Mermaid error indicators
   * @param {string} svgHtml - The SVG HTML string
   * @returns {boolean} - True if the SVG contains error indicators
   */
  containsMermaidError(svgHtml) {
    // Only check for very specific error patterns that Mermaid actually outputs for errors
    const errorPatterns = [
      /Parse error on line \d+/i,
      /<text[^>]*>[\s]*Parse error on line/i,
      /<text[^>]*>[\s]*Syntax error/i,
      /class="error-icon"/i,
      /id="mermaid-error"/i
    ];

    // Check for error patterns
    const hasErrorPattern = errorPatterns.some(pattern => pattern.test(svgHtml));

    serviceLogger.debug("Error detection results:");
    serviceLogger.debug("- Has specific error pattern:", hasErrorPattern);
    if (hasErrorPattern) {
      errorPatterns.forEach((pattern, index) => {
        if (pattern.test(svgHtml)) {
          serviceLogger.debug(`- Matched error pattern ${index + 1}:`, pattern.toString());
        }
      });
    }

    return hasErrorPattern;
  }

  /**
   * Check if SVG appears to be empty (no meaningful content)
   * @param {string} svgHtml - The SVG HTML string
   * @returns {boolean} - True if the SVG appears empty
   */
  isEmptyMermaidSVG(svgHtml) {
    const parser = new DOMParser();
    const svgElement = parser.parseFromString(svgHtml, "image/svg+xml").documentElement;

    // Look for .nodes or .edgePaths with children (flowcharts)
    const nodes = svgElement.querySelector('.nodes');
    const edges = svgElement.querySelector('.edgePaths');

    // Look for architecture-specific elements
    const archGroups = svgElement.querySelectorAll('.architecture-group');
    const archServices = svgElement.querySelectorAll('.architecture-service');
    const archElements = svgElement.querySelectorAll('[data-id]'); // Generic architecture elements

    // Look for generic diagram elements
    const allPaths = svgElement.querySelectorAll('path');
    const allRects = svgElement.querySelectorAll('rect');
    const allTexts = svgElement.querySelectorAll('text');
    const allGroups = svgElement.querySelectorAll('g');

    // Check for SVG dimensions - if very small, might be empty
    const svgWidth = svgElement.getAttribute('width') || svgElement.style.width || '';
    const svgHeight = svgElement.getAttribute('height') || svgElement.style.height || '';

    serviceLogger.debug("SVG content analysis:");
    serviceLogger.debug("- Nodes:", nodes ? nodes.children.length : 0);
    serviceLogger.debug("- Edges:", edges ? edges.children.length : 0);
    serviceLogger.debug("- Architecture groups:", archGroups.length);
    serviceLogger.debug("- Architecture services:", archServices.length);
    serviceLogger.debug("- Architecture elements:", archElements.length);
    serviceLogger.debug("- All paths:", allPaths.length);
    serviceLogger.debug("- All rects:", allRects.length);
    serviceLogger.debug("- All texts:", allTexts.length);
    serviceLogger.debug("- All groups:", allGroups.length);
    serviceLogger.debug("- SVG dimensions:", svgWidth, "x", svgHeight);

    const hasFlowchartContent = (nodes && nodes.children.length) || (edges && edges.children.length);
    const hasArchContent = archGroups.length > 0 || archServices.length > 0 || archElements.length > 0;
    const hasGenericContent = allPaths.length > 1 || allRects.length > 0 || allTexts.length > 0; // paths > 1 because empty SVGs often have one background path

    // Only consider it empty if it has NO meaningful content AND is very small
    const isEmpty = !hasFlowchartContent && !hasArchContent && !hasGenericContent && (svgHtml.length < 500 || allTexts.length === 0);

    serviceLogger.debug("- Has flowchart content:", hasFlowchartContent);
    serviceLogger.debug("- Has architecture content:", hasArchContent);
    serviceLogger.debug("- Has generic content:", hasGenericContent);
    serviceLogger.debug("- SVG length:", svgHtml.length);
    serviceLogger.debug("- Is empty:", isEmpty);

    return isEmpty;
  }

  /**
   * Show error message in the Mermaid block
   * @param {HTMLElement} mermaidElement - The Mermaid block element
   * @param {string} errorMessage - The error message to display
   * @returns {string} - The error HTML content
   */
  showError(mermaidElement, errorMessage) {
    // Decode the encoded source before displaying
    const encodedSource = mermaidElement.dataset.mermaidSource?.trim() || "";
    const diagramSource = decodeURIComponent(encodedSource);

    const errorHtml = `<div class="alert alert-danger" role="alert">
      <strong>Mermaid Error:</strong> ${errorMessage}
      <div class="mt-2">
        <details>
          <summary class="text-muted" style="cursor: pointer;">Show diagram source</summary>
          <pre class="text-muted small mt-2">${this.escapeHtml(diagramSource)}</pre>
        </details>
      </div>
    </div>`;

    const textContent = mermaidElement.querySelector(".language-mermaid");
    if (textContent) {
      textContent.innerHTML = `<div class="text-danger mb-2">
        <strong>Mermaid Error:</strong> ${errorMessage}
      </div>
      <div class="mt-2">
        <details>
          <summary class="text-muted" style="cursor: pointer;">Show diagram source</summary>
          <pre class="text-muted small mt-2">${this.escapeHtml(diagramSource)}</pre>
        </details>
      </div>`;
    } else {
      // Fallback if .language-mermaid doesn't exist
      mermaidElement.innerHTML = errorHtml;
    }

    return errorHtml;
  }

  /**
   * Escape HTML characters to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} - Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Log error with context
   * @param {string} message - Error message
   * @param {Error} error - Error object
   * @param {string} diagramSource - Diagram source that caused the error
   */
  logError(message, error, diagramSource = '') {
    serviceLogger.error(message, error);
    if (diagramSource) {
      serviceLogger.error("Diagram source:", diagramSource);
    }
  }
}

export default MermaidValidator;
