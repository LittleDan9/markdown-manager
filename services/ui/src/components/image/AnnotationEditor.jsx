import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Modal, Button } from 'react-bootstrap';
import { Stage, Layer, Image as KonvaImage, Arrow, Rect, Ellipse, Line, Text, Transformer } from 'react-konva';
import AnnotationToolbar from './AnnotationToolbar';
import { useViewport } from '@/hooks/ui/useViewport';
import {
  SHAPE_TYPES,
  DEFAULT_STROKE,
  DEFAULT_STROKE_WIDTH,
  DEFAULT_FONT_SIZE,
  DEFAULT_FONT_FAMILY,
  createAnnotationData,
  generateShapeId,
  simplifyPath,
  enforcePointLimit,
} from '@/services/image/annotationSchema';

/**
 * Full-screen modal annotation editor using Konva.
 * Renders a canvas with the document image as background and allows
 * drawing arrows, rectangles, ellipses, freehand lines, and text on top.
 */
function AnnotationEditor({ show, onHide, imageSrc, annotationData, onSave }) {
  const { isMobile } = useViewport();
  const stageRef = useRef(null);
  const transformerRef = useRef(null);
  const containerRef = useRef(null);

  // Canvas dimensions
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [image, setImage] = useState(null);
  const [imageNaturalSize, setImageNaturalSize] = useState(null);

  // Tool state
  const [activeTool, setActiveTool] = useState('select');
  const [strokeColor, setStrokeColor] = useState(DEFAULT_STROKE);
  const [strokeWidth, setStrokeWidth] = useState(DEFAULT_STROKE_WIDTH);

  // Shapes state
  const [shapes, setShapes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingShape, setDrawingShape] = useState(null);

  // Text input state (replaces browser prompt())
  const [textInputOpen, setTextInputOpen] = useState(false);
  const [textInputValue, setTextInputValue] = useState('');
  const [textInputPos, setTextInputPos] = useState({ x: 0, y: 0 });

  // Undo/redo
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Zoom/pan state (mobile pinch-to-zoom + scroll wheel)
  const [stageScale, setStageScale] = useState(1);
  const [stagePosition, setStagePosition] = useState({ x: 0, y: 0 });
  const lastTouchDist = useRef(null);
  const lastTouchCenter = useRef(null);

  // Load image
  useEffect(() => {
    if (!imageSrc || !show) return;

    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImage(img);
      setImageNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = imageSrc;
  }, [imageSrc, show]);

  // Initialize shapes from existing annotation data
  useEffect(() => {
    if (show && annotationData?.shapes) {
      setShapes(annotationData.shapes);
      setHistory([annotationData.shapes]);
      setHistoryIndex(0);
    } else if (show) {
      setShapes([]);
      setHistory([[]]);
      setHistoryIndex(0);
    }
  }, [show, annotationData]);

  // Fit stage to container
  useEffect(() => {
    if (!containerRef.current || !imageNaturalSize || !show) return;

    const updateSize = () => {
      const container = containerRef.current;
      if (!container) return;

      const maxWidth = container.clientWidth;
      const maxHeight = container.clientHeight;
      const imgRatio = imageNaturalSize.width / imageNaturalSize.height;
      const containerRatio = maxWidth / maxHeight;

      let width, height;
      if (imgRatio > containerRatio) {
        width = maxWidth;
        height = maxWidth / imgRatio;
      } else {
        height = maxHeight;
        width = maxHeight * imgRatio;
      }

      setStageSize({ width, height });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [imageNaturalSize, show]);

  // Push state to history
  const pushHistory = useCallback((newShapes) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newShapes);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  // Convert pixel coords to percentage (0-100)
  const toPercent = useCallback((px, dimension) => {
    return (px / dimension) * 100;
  }, []);

  // Convert percentage to pixel coords
  const fromPercent = useCallback((pct, dimension) => {
    return (pct / 100) * dimension;
  }, []);

  // Handle undo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setShapes(history[newIndex]);
      setSelectedId(null);
    }
  }, [history, historyIndex]);

  // Handle redo
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setShapes(history[newIndex]);
      setSelectedId(null);
    }
  }, [history, historyIndex]);

  // Delete selected shape
  const handleDelete = useCallback(() => {
    if (!selectedId) return;
    const newShapes = shapes.filter((s) => s.id !== selectedId);
    setShapes(newShapes);
    setSelectedId(null);
    pushHistory(newShapes);
  }, [selectedId, shapes, pushHistory]);

  // Clear all shapes
  const handleClear = useCallback(() => {
    setShapes([]);
    setSelectedId(null);
    pushHistory([]);
  }, [pushHistory]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!show) return;

    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const isMeta = e.metaKey || e.ctrlKey;

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        handleDelete();
      } else if (isMeta && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        handleRedo();
      } else if (isMeta && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (e.key === 'Escape') {
        setSelectedId(null);
      } else if (e.key === 'v' || e.key === 'V') {
        setActiveTool('select');
      } else if (e.key === 'a' && !isMeta) {
        setActiveTool('arrow');
      } else if (e.key === 'r') {
        setActiveTool('rect');
      } else if (e.key === 'e') {
        setActiveTool('ellipse');
      } else if (e.key === 'd') {
        setActiveTool('line');
      } else if (e.key === 't') {
        setActiveTool('text');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [show, selectedId, handleDelete, handleUndo, handleRedo]);

  // Wheel zoom (desktop scroll wheel)
  const handleWheel = useCallback((e) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const scaleBy = 1.08;
    const oldScale = stageScale;
    const pointer = stage.getPointerPosition();

    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const clampedScale = Math.max(0.5, Math.min(5, newScale));

    const mousePointTo = {
      x: (pointer.x - stagePosition.x) / oldScale,
      y: (pointer.y - stagePosition.y) / oldScale,
    };

    setStageScale(clampedScale);
    setStagePosition({
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    });
  }, [stageScale, stagePosition]);

  // Multi-touch pinch-zoom and two-finger pan
  const handleTouchMove = useCallback((e) => {
    const touches = e.evt.touches;
    if (touches.length < 2) {
      lastTouchDist.current = null;
      lastTouchCenter.current = null;
      return;
    }

    // Prevent default to stop page scrolling during pinch
    e.evt.preventDefault();

    const touch1 = touches[0];
    const touch2 = touches[1];

    const dist = Math.sqrt(
      (touch1.clientX - touch2.clientX) ** 2 +
      (touch1.clientY - touch2.clientY) ** 2
    );

    const center = {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2,
    };

    if (lastTouchDist.current !== null && lastTouchCenter.current !== null) {
      // Pinch zoom
      const scaleFactor = dist / lastTouchDist.current;
      const newScale = Math.max(0.5, Math.min(5, stageScale * scaleFactor));

      // Two-finger pan
      const dx = center.x - lastTouchCenter.current.x;
      const dy = center.y - lastTouchCenter.current.y;

      setStageScale(newScale);
      setStagePosition({
        x: stagePosition.x + dx,
        y: stagePosition.y + dy,
      });
    }

    lastTouchDist.current = dist;
    lastTouchCenter.current = center;
  }, [stageScale, stagePosition]);

  const handleTouchEnd = useCallback(() => {
    lastTouchDist.current = null;
    lastTouchCenter.current = null;
  }, []);

  // Reset zoom
  const handleResetZoom = useCallback(() => {
    setStageScale(1);
    setStagePosition({ x: 0, y: 0 });
  }, []);

  // Mouse/touch down - start drawing
  const handleStageMouseDown = (e) => {
    // Ignore multi-touch (handled by pinch-zoom)
    if (e.evt.touches && e.evt.touches.length > 1) return;

    // Deselect on stage click
    if (e.target === e.target.getStage()) {
      setSelectedId(null);
    }

    if (activeTool === 'select') return;

    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    if (!pos) return;

    // Account for zoom/pan when converting to percentage coords
    const adjustedX = (pos.x - stagePosition.x) / stageScale;
    const adjustedY = (pos.y - stagePosition.y) / stageScale;
    const x = toPercent(adjustedX, stageSize.width);
    const y = toPercent(adjustedY, stageSize.height);

    setIsDrawing(true);

    if (activeTool === 'text') {
      // Open text input UI instead of browser prompt
      setTextInputPos({ x, y });
      setTextInputValue('');
      setTextInputOpen(true);
      setIsDrawing(false);
      return;
    }

    const baseProps = {
      id: generateShapeId(),
      stroke: strokeColor,
      strokeWidth,
      opacity: 1,
      rotation: 0,
    };

    let shape;
    switch (activeTool) {
      case 'arrow':
        shape = { ...baseProps, type: SHAPE_TYPES.ARROW, points: [x, y, x, y] };
        break;
      case 'rect':
        shape = { ...baseProps, type: SHAPE_TYPES.RECT, x, y, width: 0, height: 0, fill: 'transparent' };
        break;
      case 'ellipse':
        shape = { ...baseProps, type: SHAPE_TYPES.ELLIPSE, x, y, radiusX: 0, radiusY: 0, fill: 'transparent' };
        break;
      case 'line':
        shape = { ...baseProps, type: SHAPE_TYPES.LINE, points: [x, y] };
        break;
      default:
        return;
    }

    setDrawingShape(shape);
  };

  // Mouse/touch move - update drawing shape
  const handleStageMouseMove = (e) => {
    if (!isDrawing || !drawingShape) return;

    // Ignore multi-touch (handled by pinch-zoom)
    if (e.evt.touches && e.evt.touches.length > 1) return;

    const stage = stageRef.current;
    const pos = stage.getPointerPosition();
    if (!pos) return;

    const adjustedX = (pos.x - stagePosition.x) / stageScale;
    const adjustedY = (pos.y - stagePosition.y) / stageScale;
    const x = toPercent(adjustedX, stageSize.width);
    const y = toPercent(adjustedY, stageSize.height);

    const updated = { ...drawingShape };

    switch (drawingShape.type) {
      case SHAPE_TYPES.ARROW:
        updated.points = [drawingShape.points[0], drawingShape.points[1], x, y];
        break;
      case SHAPE_TYPES.RECT:
        updated.width = x - drawingShape.x;
        updated.height = y - drawingShape.y;
        break;
      case SHAPE_TYPES.ELLIPSE:
        updated.radiusX = Math.abs(x - drawingShape.x);
        updated.radiusY = Math.abs(y - drawingShape.y);
        break;
      case SHAPE_TYPES.LINE:
        updated.points = [...drawingShape.points, x, y];
        break;
    }

    setDrawingShape(updated);
  };

  // Mouse/touch up - finalize drawing
  const handleStageMouseUp = () => {
    if (!isDrawing || !drawingShape) {
      setIsDrawing(false);
      return;
    }

    setIsDrawing(false);

    let finalShape = { ...drawingShape };

    // Simplify freehand paths
    if (finalShape.type === SHAPE_TYPES.LINE && finalShape.points.length > 4) {
      finalShape.points = enforcePointLimit(simplifyPath(finalShape.points, 0.3));
    }

    // Normalize shapes: ensure non-negative dimensions
    if (finalShape.type === SHAPE_TYPES.ELLIPSE) {
      finalShape.radiusX = Math.abs(finalShape.radiusX);
      finalShape.radiusY = Math.abs(finalShape.radiusY);
    }
    if (finalShape.type === SHAPE_TYPES.RECT) {
      if (finalShape.width < 0) {
        finalShape.x += finalShape.width;
        finalShape.width = Math.abs(finalShape.width);
      }
      if (finalShape.height < 0) {
        finalShape.y += finalShape.height;
        finalShape.height = Math.abs(finalShape.height);
      }
    }

    // Skip if shape is too small (accidental click)
    const isMinimal = isShapeTooSmall(finalShape);
    if (isMinimal) {
      setDrawingShape(null);
      return;
    }

    const newShapes = [...shapes, finalShape];
    setShapes(newShapes);
    pushHistory(newShapes);
    setDrawingShape(null);
  };

  // Check if a shape is too small to be intentional
  function isShapeTooSmall(shape) {
    const threshold = 1; // 1% of image dimension
    switch (shape.type) {
      case SHAPE_TYPES.ARROW: {
        const dx = shape.points[2] - shape.points[0];
        const dy = shape.points[3] - shape.points[1];
        return Math.sqrt(dx * dx + dy * dy) < threshold;
      }
      case SHAPE_TYPES.RECT:
        return Math.abs(shape.width) < threshold && Math.abs(shape.height) < threshold;
      case SHAPE_TYPES.ELLIPSE:
        return shape.radiusX < threshold && shape.radiusY < threshold;
      case SHAPE_TYPES.LINE:
        return shape.points.length <= 2;
      default:
        return false;
    }
  }

  // Handle shape selection
  const handleShapeSelect = (id) => {
    if (activeTool === 'select') {
      setSelectedId(id);
    }
  };

  // Update transformer when selection changes
  useEffect(() => {
    if (!transformerRef.current || !stageRef.current) return;
    const transformer = transformerRef.current;

    if (selectedId) {
      const node = stageRef.current.findOne(`#${selectedId}`);
      if (node) {
        transformer.nodes([node]);
        transformer.getLayer().batchDraw();
      }
    } else {
      transformer.nodes([]);
      transformer.getLayer().batchDraw();
    }
  }, [selectedId]);

  // Handle save
  const handleSave = () => {
    const data = createAnnotationData();
    data.shapes = shapes;
    onSave(data);
  };

  // Render a shape to Konva elements
  const renderShape = (shape) => {
    const commonProps = {
      key: shape.id,
      id: shape.id,
      opacity: shape.opacity || 1,
      rotation: shape.rotation || 0,
      draggable: activeTool === 'select',
      onClick: () => handleShapeSelect(shape.id),
      onTap: () => handleShapeSelect(shape.id),
      onDragEnd: (e) => {
        const node = e.target;
        const newShapes = shapes.map((s) => {
          if (s.id !== shape.id) return s;

          // For point-based shapes (Arrow, Line), update points array
          if (s.type === SHAPE_TYPES.ARROW || s.type === SHAPE_TYPES.LINE) {
            const dx = toPercent(node.x(), stageSize.width);
            const dy = toPercent(node.y(), stageSize.height);
            // Reset node position and offset points
            node.position({ x: 0, y: 0 });
            return {
              ...s,
              points: s.points.map((p, i) => (i % 2 === 0 ? p + dx : p + dy)),
            };
          }

          // For position-based shapes (Rect, Ellipse, Text)
          return {
            ...s,
            x: toPercent(node.x(), stageSize.width),
            y: toPercent(node.y(), stageSize.height),
          };
        });
        setShapes(newShapes);
        pushHistory(newShapes);
      },
    };

    switch (shape.type) {
      case SHAPE_TYPES.ARROW:
        return (
          <Arrow
            {...commonProps}
            points={shape.points.map((p, i) =>
              i % 2 === 0
                ? fromPercent(p, stageSize.width)
                : fromPercent(p, stageSize.height)
            )}
            stroke={shape.stroke}
            strokeWidth={shape.strokeWidth}
            fill={shape.stroke}
            pointerLength={shape.strokeWidth * 4}
            pointerWidth={shape.strokeWidth * 3}
            x={0}
            y={0}
          />
        );
      case SHAPE_TYPES.RECT:
        return (
          <Rect
            {...commonProps}
            x={fromPercent(shape.x, stageSize.width)}
            y={fromPercent(shape.y, stageSize.height)}
            width={fromPercent(shape.width, stageSize.width)}
            height={fromPercent(shape.height, stageSize.height)}
            stroke={shape.stroke}
            strokeWidth={shape.strokeWidth}
            fill={shape.fill || 'transparent'}
          />
        );
      case SHAPE_TYPES.ELLIPSE:
        return (
          <Ellipse
            {...commonProps}
            x={fromPercent(shape.x, stageSize.width)}
            y={fromPercent(shape.y, stageSize.height)}
            radiusX={fromPercent(shape.radiusX, stageSize.width)}
            radiusY={fromPercent(shape.radiusY, stageSize.height)}
            stroke={shape.stroke}
            strokeWidth={shape.strokeWidth}
            fill={shape.fill || 'transparent'}
          />
        );
      case SHAPE_TYPES.LINE:
        return (
          <Line
            {...commonProps}
            points={shape.points.map((p, i) =>
              i % 2 === 0
                ? fromPercent(p, stageSize.width)
                : fromPercent(p, stageSize.height)
            )}
            stroke={shape.stroke}
            strokeWidth={shape.strokeWidth}
            tension={0.3}
            lineCap="round"
            lineJoin="round"
            x={0}
            y={0}
          />
        );
      case SHAPE_TYPES.TEXT:
        return (
          <Text
            {...commonProps}
            x={fromPercent(shape.x, stageSize.width)}
            y={fromPercent(shape.y, stageSize.height)}
            text={shape.text}
            fontSize={shape.fontSize}
            fontFamily={shape.fontFamily}
            fill={shape.fill || shape.stroke}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      fullscreen
      backdrop="static"
      className="annotation-editor-modal"
    >
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="bi bi-pencil-square me-2" />
          Annotate Image
        </Modal.Title>
        <div className="ms-auto me-3 d-flex gap-2">
          <Button variant="outline-secondary" size="sm" onClick={onHide}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave}>
            <i className="bi bi-check-lg me-1" />
            Save
          </Button>
        </div>
      </Modal.Header>

      <AnnotationToolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        strokeColor={strokeColor}
        onColorChange={setStrokeColor}
        strokeWidth={strokeWidth}
        onStrokeWidthChange={setStrokeWidth}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onDelete={handleDelete}
        onClear={handleClear}
        hasSelection={!!selectedId}
        stageScale={stageScale}
        onResetZoom={handleResetZoom}
      />

      <Modal.Body
        ref={containerRef}
        className="d-flex align-items-center justify-content-center p-0"
        style={{
          background: 'var(--bs-dark-bg-subtle)',
          overflow: 'hidden',
          paddingBottom: isMobile ? '60px' : 0,
        }}
      >
        <Stage
          ref={stageRef}
          width={stageSize.width}
          height={stageSize.height}
          scaleX={stageScale}
          scaleY={stageScale}
          x={stagePosition.x}
          y={stagePosition.y}
          onWheel={handleWheel}
          onMouseDown={handleStageMouseDown}
          onMouseMove={handleStageMouseMove}
          onMouseUp={handleStageMouseUp}
          onTouchStart={handleStageMouseDown}
          onTouchMove={(e) => { handleTouchMove(e); handleStageMouseMove(e); }}
          onTouchEnd={(e) => { handleTouchEnd(); handleStageMouseUp(e); }}
          style={{ cursor: activeTool === 'select' ? 'default' : 'crosshair' }}
        >
          <Layer>
            {/* Background image */}
            {image && (
              <KonvaImage
                image={image}
                width={stageSize.width}
                height={stageSize.height}
                listening={false}
              />
            )}

            {/* Saved shapes */}
            {shapes.map(renderShape)}

            {/* Currently drawing shape */}
            {drawingShape && renderShape(drawingShape)}

            {/* Transformer for selection */}
            <Transformer
              ref={transformerRef}
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 5 || newBox.height < 5) return oldBox;
                return newBox;
              }}
            />
          </Layer>
        </Stage>
      </Modal.Body>

      {/* Text input overlay (replaces browser prompt) */}
      {textInputOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.4)',
            zIndex: 1070,
          }}
          onClick={() => setTextInputOpen(false)}
        >
          <div
            className="card p-3"
            style={{ minWidth: '300px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <label className="form-label fw-bold">Enter text label:</label>
            <input
              type="text"
              className="form-control mb-2"
              autoFocus
              value={textInputValue}
              onChange={(e) => setTextInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && textInputValue.trim()) {
                  const newShape = {
                    id: generateShapeId(),
                    type: SHAPE_TYPES.TEXT,
                    x: textInputPos.x,
                    y: textInputPos.y,
                    text: textInputValue.trim(),
                    fontSize: DEFAULT_FONT_SIZE,
                    fontFamily: DEFAULT_FONT_FAMILY,
                    fill: strokeColor,
                    stroke: strokeColor,
                    strokeWidth: 0,
                    opacity: 1,
                    rotation: 0,
                  };
                  const newShapes = [...shapes, newShape];
                  setShapes(newShapes);
                  pushHistory(newShapes);
                  setTextInputOpen(false);
                } else if (e.key === 'Escape') {
                  setTextInputOpen(false);
                }
              }}
              maxLength={200}
            />
            <div className="d-flex gap-2 justify-content-end">
              <Button size="sm" variant="outline-secondary" onClick={() => setTextInputOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={!textInputValue.trim()}
                onClick={() => {
                  if (!textInputValue.trim()) return;
                  const newShape = {
                    id: generateShapeId(),
                    type: SHAPE_TYPES.TEXT,
                    x: textInputPos.x,
                    y: textInputPos.y,
                    text: textInputValue.trim(),
                    fontSize: DEFAULT_FONT_SIZE,
                    fontFamily: DEFAULT_FONT_FAMILY,
                    fill: strokeColor,
                    stroke: strokeColor,
                    strokeWidth: 0,
                    opacity: 1,
                    rotation: 0,
                  };
                  const newShapes = [...shapes, newShape];
                  setShapes(newShapes);
                  pushHistory(newShapes);
                  setTextInputOpen(false);
                }}
              >
                Add Text
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default AnnotationEditor;
