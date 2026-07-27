import React from 'react';
import { useViewport } from '@/hooks/ui/useViewport';

const TOOLS = [
  { id: 'select', icon: 'bi-cursor', label: 'Select', hotkey: 'V' },
  { id: 'arrow', icon: 'bi-arrow-up-right', label: 'Arrow', hotkey: 'A' },
  { id: 'rect', icon: 'bi-square', label: 'Rectangle', hotkey: 'R' },
  { id: 'ellipse', icon: 'bi-circle', label: 'Ellipse', hotkey: 'E' },
  { id: 'line', icon: 'bi-pencil', label: 'Freehand', hotkey: 'D' },
  { id: 'text', icon: 'bi-fonts', label: 'Text', hotkey: 'T' },
];

const COLORS = [
  '#ff0000', '#ff6600', '#ffcc00', '#00cc00',
  '#0066ff', '#9933ff', '#ffffff', '#000000',
];

const STROKE_WIDTHS = [
  { value: 1, label: 'Thin' },
  { value: 3, label: 'Medium' },
  { value: 6, label: 'Thick' },
];

function AnnotationToolbar({
  activeTool,
  onToolChange,
  strokeColor,
  onColorChange,
  strokeWidth,
  onStrokeWidthChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onDelete,
  onClear,
  hasSelection,
  stageScale,
  onResetZoom,
}) {
  const { isMobile } = useViewport();

  const toolbarStyle = isMobile
    ? {
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1060,
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '8px 12px',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        background: 'var(--bs-body-bg)',
        borderTop: '1px solid var(--bs-border-color)',
      }
    : {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        borderBottom: '1px solid var(--bs-border-color)',
        flexWrap: 'wrap',
      };

  const btnSize = isMobile ? { minWidth: '44px', minHeight: '44px' } : {};

  return (
    <div style={toolbarStyle} className="annotation-toolbar">
      {/* Drawing tools */}
      <div className="btn-group" role="group">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            type="button"
            className={`btn btn-sm ${activeTool === tool.id ? 'btn-primary' : 'btn-outline-secondary'}`}
            style={btnSize}
            onClick={() => onToolChange(tool.id)}
            title={`${tool.label} (${tool.hotkey})`}
          >
            <i className={`bi ${tool.icon}`} />
          </button>
        ))}
      </div>

      {/* Separator */}
      <div className="vr mx-1" style={{ height: '24px' }} />

      {/* Color picker */}
      <div className="d-flex align-items-center gap-1">
        {COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className="btn btn-sm p-0 border"
            style={{
              ...btnSize,
              width: isMobile ? '44px' : '24px',
              height: isMobile ? '44px' : '24px',
              backgroundColor: color,
              outline: strokeColor === color ? '2px solid var(--bs-primary)' : 'none',
              outlineOffset: '2px',
              borderRadius: '4px',
            }}
            onClick={() => onColorChange(color)}
            title={color}
          />
        ))}
      </div>

      {/* Separator */}
      <div className="vr mx-1" style={{ height: '24px' }} />

      {/* Stroke width */}
      <div className="btn-group" role="group">
        {STROKE_WIDTHS.map((sw) => (
          <button
            key={sw.value}
            type="button"
            className={`btn btn-sm ${strokeWidth === sw.value ? 'btn-primary' : 'btn-outline-secondary'}`}
            style={btnSize}
            onClick={() => onStrokeWidthChange(sw.value)}
            title={sw.label}
          >
            <svg width="16" height="16" viewBox="0 0 16 16">
              <line
                x1="2" y1="8" x2="14" y2="8"
                stroke="currentColor"
                strokeWidth={sw.value}
                strokeLinecap="round"
              />
            </svg>
          </button>
        ))}
      </div>

      {/* Separator */}
      <div className="vr mx-1" style={{ height: '24px' }} />

      {/* Actions */}
      <button
        type="button"
        className="btn btn-sm btn-outline-secondary"
        style={btnSize}
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
      >
        <i className="bi bi-arrow-counterclockwise" />
      </button>
      <button
        type="button"
        className="btn btn-sm btn-outline-secondary"
        style={btnSize}
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo (Ctrl+Shift+Z)"
      >
        <i className="bi bi-arrow-clockwise" />
      </button>

      <button
        type="button"
        className="btn btn-sm btn-outline-danger"
        style={btnSize}
        onClick={onDelete}
        disabled={!hasSelection}
        title="Delete selected (Del)"
      >
        <i className="bi bi-trash" />
      </button>

      <button
        type="button"
        className="btn btn-sm btn-outline-warning"
        style={btnSize}
        onClick={onClear}
        title="Clear all"
      >
        <i className="bi bi-x-circle" />
      </button>

      {/* Zoom indicator + reset */}
      {stageScale !== undefined && stageScale !== 1 && (
        <>
          <div className="vr mx-1" style={{ height: '24px' }} />
          <button
            type="button"
            className="btn btn-sm btn-outline-info"
            style={btnSize}
            onClick={onResetZoom}
            title="Reset zoom"
          >
            {Math.round(stageScale * 100)}%
          </button>
        </>
      )}
    </div>
  );
}

export default AnnotationToolbar;
