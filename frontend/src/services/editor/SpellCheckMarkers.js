// src/services/editor/SpellCheckMarkers.js
import * as monaco from 'monaco-editor';

/**
 * Service for managing spell check markers in Monaco editor
 */
export default class SpellCheckMarkers {
  /**
   * Clear all spell check markers from the Monaco editor
   * @param {Object} editor - Monaco editor instance
   * @param {Map} suggestionsMap - The suggestions map to clear
   */
  static clearMarkers(editor, suggestionsMap = null) {
    if (!editor || typeof editor.getModel !== 'function') return;
    
    // Guard against Monaco not being loaded
    if (!monaco || !monaco.editor) {
      console.warn('Monaco editor not fully loaded, skipping marker clearing');
      return;
    }

    const model = editor.getModel();
    if (model) {
      monaco.editor.setModelMarkers(model, 'spell', []);
      if (suggestionsMap) {
        suggestionsMap.clear();
      }
    }
  }

  /**
   * Get existing spell check markers for a model
   * @param {Object} model - Monaco editor model
   * @returns {Array} Array of existing spell check markers
   */
  static getExistingMarkers(model) {
    if (!monaco || !monaco.editor || !model) {
      return [];
    }
    
    return monaco.editor.getModelMarkers({ resource: model.uri })
      .filter(m => m.owner === 'spell');
  }

  /**
   * Filter markers that are outside a specific region
   * @param {Array} markers - Array of Monaco markers
   * @param {Object} model - Monaco editor model
   * @param {number} startOffset - Start offset of the region
   * @param {number} endOffset - End offset of the region
   * @returns {Array} Filtered markers outside the region
   */
  static filterMarkersOutsideRegion(markers, model, startOffset, endOffset) {
    return markers.filter(m => {
      const markerStart = model.getOffsetAt({ 
        lineNumber: m.startLineNumber, 
        column: m.startColumn 
      });
      const markerEnd = model.getOffsetAt({ 
        lineNumber: m.endLineNumber, 
        column: m.endColumn 
      });
      return markerEnd < startOffset || markerStart > endOffset;
    });
  }

  /**
   * Apply markers to the Monaco editor model
   * @param {Object} model - Monaco editor model
   * @param {Array} markers - Array of markers to apply
   */
  static applyMarkers(model, markers) {
    if (!monaco || !monaco.editor || !model) {
      console.warn('Monaco editor not available for applying markers');
      return;
    }

    monaco.editor.setModelMarkers(model, 'spell', markers);
  }
}
