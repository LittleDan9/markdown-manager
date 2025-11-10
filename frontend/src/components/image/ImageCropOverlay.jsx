import React, { useState, useRef, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * ImageCropOverlay - Interactive crop overlay for non-destructive image cropping
 *
 * Features:
 * - Resizable crop rectangle with corner and edge handles
 * - Real-time preview of crop area
 * - Percentage-based coordinates for responsive behavior
 * - Auto-save on crop changes
 */
function ImageCropOverlay({
  imageDimensions: _imageDimensions,
  currentCrop,
  onCropChange,
  onSave,
  onCancel,
  className = ''
}) {
  const overlayRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragType, setDragType] = useState(null); // 'move', 'resize-nw', 'resize-ne', etc.
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cropStart, setCropStart] = useState(null);

  // Use internal crop state that syncs with currentCrop prop
  const [crop, setCrop] = useState(() => currentCrop || {
    x: 10,
    y: 10,
    width: 80,
    height: 80,
    unit: 'percentage'
  });

  // Sync internal crop state with currentCrop prop changes
  useEffect(() => {
    if (currentCrop) {
      setCrop(currentCrop);
    }
  }, [currentCrop]);

  const handleMouseDown = useCallback((e, type) => {
    e.preventDefault();
    e.stopPropagation();

    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;

    setDragStart({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    setCropStart({ ...crop });
    setDragType(type);

    if (type === 'move') {
      setIsDragging(true);
    } else {
      setIsResizing(true);
    }
  }, [crop]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging && !isResizing) return;
    if (!overlayRef.current || !cropStart) return;

    const rect = overlayRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const deltaX = ((currentX - dragStart.x) / rect.width) * 100;
    const deltaY = ((currentY - dragStart.y) / rect.height) * 100;

    const newCrop = { ...cropStart };

    if (dragType === 'move') {
      // Move the entire crop area
      newCrop.x = Math.max(0, Math.min(100 - cropStart.width, cropStart.x + deltaX));
      newCrop.y = Math.max(0, Math.min(100 - cropStart.height, cropStart.y + deltaY));
    } else if (dragType?.startsWith('resize-')) {
      // Resize the crop area based on handle
      const [, direction] = dragType.split('-');

      switch (direction) {
        case 'nw': // Northwest corner
          newCrop.x = Math.max(0, cropStart.x + deltaX);
          newCrop.y = Math.max(0, cropStart.y + deltaY);
          newCrop.width = Math.max(5, cropStart.width - deltaX);
          newCrop.height = Math.max(5, cropStart.height - deltaY);
          break;
        case 'ne': // Northeast corner
          newCrop.y = Math.max(0, cropStart.y + deltaY);
          newCrop.width = Math.max(5, Math.min(100 - cropStart.x, cropStart.width + deltaX));
          newCrop.height = Math.max(5, cropStart.height - deltaY);
          break;
        case 'sw': // Southwest corner
          newCrop.x = Math.max(0, cropStart.x + deltaX);
          newCrop.width = Math.max(5, cropStart.width - deltaX);
          newCrop.height = Math.max(5, Math.min(100 - cropStart.y, cropStart.height + deltaY));
          break;
        case 'se': // Southeast corner
          newCrop.width = Math.max(5, Math.min(100 - cropStart.x, cropStart.width + deltaX));
          newCrop.height = Math.max(5, Math.min(100 - cropStart.y, cropStart.height + deltaY));
          break;
        case 'n': // North edge
          newCrop.y = Math.max(0, cropStart.y + deltaY);
          newCrop.height = Math.max(5, cropStart.height - deltaY);
          break;
        case 's': // South edge
          newCrop.height = Math.max(5, Math.min(100 - cropStart.y, cropStart.height + deltaY));
          break;
        case 'w': // West edge
          newCrop.x = Math.max(0, cropStart.x + deltaX);
          newCrop.width = Math.max(5, cropStart.width - deltaX);
          break;
        case 'e': // East edge
          newCrop.width = Math.max(5, Math.min(100 - cropStart.x, cropStart.width + deltaX));
          break;
      }

      // Ensure crop doesn't go out of bounds
      if (newCrop.x + newCrop.width > 100) {
        newCrop.width = 100 - newCrop.x;
      }
      if (newCrop.y + newCrop.height > 100) {
        newCrop.height = 100 - newCrop.y;
      }
    }

    // Update both local state and notify parent
    setCrop(newCrop);
    onCropChange(newCrop);
  }, [isDragging, isResizing, dragStart, cropStart, dragType, onCropChange]);

  const handleMouseUp = useCallback(() => {
    if (isDragging || isResizing) {
      setIsDragging(false);
      setIsResizing(false);
      setDragType(null);
      setCropStart(null);

      // Don't auto-save on mouse up - let user choose when to save
      // if (onSave) {
      //   onSave(crop);
      // }
    }
  }, [isDragging, isResizing]);

  // Add global mouse event listeners
  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  const cropStyle = {
    left: `${crop.x}%`,
    top: `${crop.y}%`,
    width: `${crop.width}%`,
    height: `${crop.height}%`
  };

  return (
    <div
      ref={overlayRef}
      className={`image-crop-overlay ${className}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'auto'
      }}
    >
      {/* Semi-transparent overlay outside crop area */}
      <div className="crop-overlay-mask">
        {/* Top mask */}
        <div
          className="crop-mask crop-mask-top"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: `${crop.y}%`,
            backgroundColor: 'rgba(0, 0, 0, 0.5)'
          }}
        />

        {/* Left mask */}
        <div
          className="crop-mask crop-mask-left"
          style={{
            position: 'absolute',
            top: `${crop.y}%`,
            left: 0,
            width: `${crop.x}%`,
            height: `${crop.height}%`,
            backgroundColor: 'rgba(0, 0, 0, 0.5)'
          }}
        />

        {/* Right mask */}
        <div
          className="crop-mask crop-mask-right"
          style={{
            position: 'absolute',
            top: `${crop.y}%`,
            left: `${crop.x + crop.width}%`,
            width: `${100 - crop.x - crop.width}%`,
            height: `${crop.height}%`,
            backgroundColor: 'rgba(0, 0, 0, 0.5)'
          }}
        />

        {/* Bottom mask */}
        <div
          className="crop-mask crop-mask-bottom"
          style={{
            position: 'absolute',
            top: `${crop.y + crop.height}%`,
            left: 0,
            width: '100%',
            height: `${100 - crop.y - crop.height}%`,
            backgroundColor: 'rgba(0, 0, 0, 0.5)'
          }}
        />
      </div>

      {/* Crop area with handles */}
      <div
        className="crop-area"
        style={{
          ...cropStyle,
          position: 'absolute',
          border: '2px solid #007bff',
          cursor: 'move',
          boxSizing: 'border-box'
        }}
        onMouseDown={(e) => handleMouseDown(e, 'move')}
      >
        {/* Corner handles */}
        <div
          className="crop-handle crop-handle-nw"
          style={{
            position: 'absolute',
            top: '-6px',
            left: '-6px',
            width: '12px',
            height: '12px',
            backgroundColor: '#007bff',
            border: '2px solid white',
            borderRadius: '50%',
            cursor: 'nw-resize'
          }}
          onMouseDown={(e) => handleMouseDown(e, 'resize-nw')}
        />

        <div
          className="crop-handle crop-handle-ne"
          style={{
            position: 'absolute',
            top: '-6px',
            right: '-6px',
            width: '12px',
            height: '12px',
            backgroundColor: '#007bff',
            border: '2px solid white',
            borderRadius: '50%',
            cursor: 'ne-resize'
          }}
          onMouseDown={(e) => handleMouseDown(e, 'resize-ne')}
        />

        <div
          className="crop-handle crop-handle-sw"
          style={{
            position: 'absolute',
            bottom: '-6px',
            left: '-6px',
            width: '12px',
            height: '12px',
            backgroundColor: '#007bff',
            border: '2px solid white',
            borderRadius: '50%',
            cursor: 'sw-resize'
          }}
          onMouseDown={(e) => handleMouseDown(e, 'resize-sw')}
        />

        <div
          className="crop-handle crop-handle-se"
          style={{
            position: 'absolute',
            bottom: '-6px',
            right: '-6px',
            width: '12px',
            height: '12px',
            backgroundColor: '#007bff',
            border: '2px solid white',
            borderRadius: '50%',
            cursor: 'se-resize'
          }}
          onMouseDown={(e) => handleMouseDown(e, 'resize-se')}
        />

        {/* Edge handles */}
        <div
          className="crop-handle crop-handle-n"
          style={{
            position: 'absolute',
            top: '-3px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '20px',
            height: '6px',
            backgroundColor: '#007bff',
            border: '1px solid white',
            cursor: 'n-resize'
          }}
          onMouseDown={(e) => handleMouseDown(e, 'resize-n')}
        />

        <div
          className="crop-handle crop-handle-s"
          style={{
            position: 'absolute',
            bottom: '-3px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '20px',
            height: '6px',
            backgroundColor: '#007bff',
            border: '1px solid white',
            cursor: 's-resize'
          }}
          onMouseDown={(e) => handleMouseDown(e, 'resize-s')}
        />

        <div
          className="crop-handle crop-handle-w"
          style={{
            position: 'absolute',
            left: '-3px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '6px',
            height: '20px',
            backgroundColor: '#007bff',
            border: '1px solid white',
            cursor: 'w-resize'
          }}
          onMouseDown={(e) => handleMouseDown(e, 'resize-w')}
        />

        <div
          className="crop-handle crop-handle-e"
          style={{
            position: 'absolute',
            right: '-3px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '6px',
            height: '20px',
            backgroundColor: '#007bff',
            border: '1px solid white',
            cursor: 'e-resize'
          }}
          onMouseDown={(e) => handleMouseDown(e, 'resize-e')}
        />
      </div>

      {/* Crop info tooltip */}
      <div
        className="crop-info"
        style={{
          position: 'absolute',
          top: `${Math.max(0, crop.y - 8)}%`,
          left: `${crop.x}%`,
          transform: crop.y < 10 ? 'translateY(0)' : 'translateY(-100%)',
          background: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 10
        }}
      >
        {`${Math.round(crop.width)}% × ${Math.round(crop.height)}%`}
      </div>

      {/* Action buttons */}
      <div
        className="crop-actions"
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          display: 'flex',
          gap: '4px',
          zIndex: 10
        }}
      >
        {onCancel && (
          <button
            className="btn btn-sm btn-secondary"
            onClick={onCancel}
            style={{ fontSize: '12px', padding: '2px 6px' }}
          >
            Cancel
          </button>
        )}
        {onSave && (
          <button
            className="btn btn-sm btn-primary"
            onClick={() => onSave(crop)}
            style={{ fontSize: '12px', padding: '2px 6px' }}
          >
            Save
          </button>
        )}
      </div>
    </div>
  );
}

ImageCropOverlay.propTypes = {
  imageDimensions: PropTypes.shape({
    width: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired
  }).isRequired,
  currentCrop: PropTypes.shape({
    x: PropTypes.number,
    y: PropTypes.number,
    width: PropTypes.number,
    height: PropTypes.number,
    unit: PropTypes.string
  }),
  onCropChange: PropTypes.func.isRequired,
  onSave: PropTypes.func,
  onCancel: PropTypes.func,
  className: PropTypes.string
};

export default ImageCropOverlay;