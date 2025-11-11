import React, { useState, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import ImageCropOverlay from './ImageCropOverlay';

/**
 * UserImage - Enhanced image component with crop controls
 *
 * Features:
 * - Non-destructive image cropping using CSS transforms
 * - Inline crop controls similar to Mermaid diagram pattern
 * - Click-to-expand functionality
 * - Auto-save crop changes
 */
function UserImage({
  src,
  alt,
  title,
  filename,
  lineNumber,
  cropData,
  onCropChange,
  onImageClick,
  className = '',
  style = {},
  loading = 'lazy'
}) {
  const [showCropControls, setShowCropControls] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [tempCrop, setTempCrop] = useState(cropData);
  const imageRef = useRef(null);
  const containerRef = useRef(null);

  // Update temp crop when prop changes
  useEffect(() => {
    setTempCrop(cropData);
  }, [cropData]);

  // Get image dimensions when it loads
  const handleImageLoad = useCallback(() => {
    if (imageRef.current) {
      setImageDimensions({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight
      });
    }
  }, []);

  // Calculate crop styles for CSS transformation
  const getCropStyles = useCallback((crop) => {
    if (!crop) return {};

    const { x, y, width, height, unit = 'percentage' } = crop;

    if (unit === 'percentage') {
      return {
        clipPath: `inset(${y}% ${100 - x - width}% ${100 - y - height}% ${x}%)`,
        objectFit: 'cover',
        objectPosition: `${x + width/2}% ${y + height/2}%`
      };
    }

    return {};
  }, []);

  const handleCropChange = useCallback((newCrop) => {
    setTempCrop(newCrop);
  }, []);

  const handleCropSave = useCallback((finalCrop) => {
    if (onCropChange) {
      onCropChange(filename, lineNumber, finalCrop);
    }
    setShowCropControls(false);
  }, [filename, lineNumber, onCropChange]);

  const handleCropCancel = useCallback(() => {
    setTempCrop(cropData); // Reset to original
    setShowCropControls(false);
  }, [cropData]);

  const toggleCropMode = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowCropControls(!showCropControls);
  }, [showCropControls]);

  const handleImageClick = useCallback((e) => {
    if (showCropControls) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (onImageClick) {
      onImageClick({
        src,
        alt,
        title,
        filename,
        cropData: tempCrop
      });
    }
  }, [showCropControls, onImageClick, src, alt, title, filename, tempCrop]);

  const cropStyles = getCropStyles(tempCrop);
  const hasActiveCrop = tempCrop && (tempCrop.width < 100 || tempCrop.height < 100 || tempCrop.x > 0 || tempCrop.y > 0);

  return (
    <div
      ref={containerRef}
      className={`user-image-container ${hasActiveCrop ? 'has-crop' : ''} ${className}`}
      style={{
        position: 'relative',
        display: 'inline-block',
        ...style
      }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <img
        ref={imageRef}
        src={src}
        alt={alt}
        title={title}
        className={`user-image img-fluid ${hasActiveCrop ? 'cropped' : ''}`}
        loading={loading}
        style={{
          maxWidth: '100%',
          height: 'auto',
          cursor: showCropControls ? 'default' : 'pointer',
          transition: 'all 0.2s ease',
          ...cropStyles
        }}
        onClick={handleImageClick}
        onLoad={handleImageLoad}
        onError={(e) => {
          e.target.style.filter = 'grayscale(100%)';
          e.target.title = 'Image failed to load';
        }}
        data-filename={filename}
        data-line={lineNumber}
      />

      {/* Image controls - shown on hover or when cropping */}
      {(isHovering || showCropControls) && (
        <div
          className="image-controls"
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            display: 'flex',
            gap: '4px',
            background: 'rgba(0, 0, 0, 0.7)',
            borderRadius: '4px',
            padding: '4px',
            zIndex: 20
          }}
        >
          <button
            className="btn btn-sm btn-light"
            onClick={toggleCropMode}
            title={showCropControls ? 'Exit crop mode' : 'Crop image'}
            style={{
              width: '24px',
              height: '24px',
              padding: '0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              border: 'none',
              backgroundColor: showCropControls ? '#007bff' : 'rgba(255, 255, 255, 0.9)',
              color: showCropControls ? 'white' : '#333'
            }}
          >
            ✂️
          </button>

          {!showCropControls && (
            <button
              className="btn btn-sm btn-light"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleImageClick(e);
              }}
              title="Expand image"
              style={{
                width: '24px',
                height: '24px',
                padding: '0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                border: 'none',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                color: '#333'
              }}
            >
              ⛶
            </button>
          )}
        </div>
      )}

      {/* Crop overlay */}
      {showCropControls && imageDimensions.width > 0 && (
        <ImageCropOverlay
          imageDimensions={imageDimensions}
          currentCrop={tempCrop}
          onCropChange={handleCropChange}
          onSave={handleCropSave}
          onCancel={handleCropCancel}
          className="user-image-crop-overlay"
        />
      )}

      {/* Crop indicator */}
      {hasActiveCrop && !showCropControls && (
        <div
          className="crop-indicator"
          style={{
            position: 'absolute',
            bottom: '4px',
            left: '4px',
            background: 'rgba(0, 123, 255, 0.8)',
            color: 'white',
            padding: '2px 6px',
            borderRadius: '3px',
            fontSize: '10px',
            pointerEvents: 'none',
            zIndex: 10
          }}
        >
          Cropped
        </div>
      )}

      {/* Caption */}
      {title && (
        <div className="image-caption text-muted text-center mt-1 small">
          {title}
        </div>
      )}
    </div>
  );
}

UserImage.propTypes = {
  src: PropTypes.string.isRequired,
  alt: PropTypes.string,
  title: PropTypes.string,
  filename: PropTypes.string.isRequired,
  lineNumber: PropTypes.number.isRequired,
  cropData: PropTypes.shape({
    x: PropTypes.number,
    y: PropTypes.number,
    width: PropTypes.number,
    height: PropTypes.number,
    unit: PropTypes.string
  }),
  onCropChange: PropTypes.func,
  onImageClick: PropTypes.func,
  className: PropTypes.string,
  style: PropTypes.object,
  loading: PropTypes.string
};

export default UserImage;