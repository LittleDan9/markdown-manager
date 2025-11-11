/**
 * RendererContext - Centralized state management for the renderer system
 *
 * This context provides shared state and actions for all renderer components,
 * eliminating prop drilling and ensuring consistent state management.
 */
import React, { createContext, useContext, useState, useRef } from 'react';

const RendererContext = createContext();

export const useRendererContext = () => {
  const context = useContext(RendererContext);
  if (!context) {
    throw new Error('useRendererContext must be used within a RendererProvider');
  }
  return context;
};

export const RendererProvider = ({ children }) => {
  // Core rendering state
  const [html, setHtml] = useState('');

  // Modal states
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  // Crop mode state (using ref to prevent re-renders during crop operations)
  const cropModeRef = useRef(null);
  const [cropOverlayKey, setCropOverlayKey] = useState(0);

  // DOM references
  const previewScrollRef = useRef(null);
  const hasCalledFirstRender = useRef(false);
  const diagramControlsRefs = useRef(new Map());
  const imageControlsRefs = useRef(new Map());

  // Crop mode management
  const enterCropMode = (filename, lineNumber, imageDimensions, currentCrop) => {
    cropModeRef.current = {
      filename,
      lineNumber,
      imageDimensions,
      currentCrop
    };
    setCropOverlayKey(prev => prev + 1);
  };

  const exitCropMode = () => {
    cropModeRef.current = null;
    setCropOverlayKey(0);
  };

  const isCropModeActive = (filename) => {
    return cropModeRef.current && cropModeRef.current.filename === filename;
  };

  // Control management
  const addDiagramControlsRef = (diagram, root) => {
    diagramControlsRefs.current.set(diagram, root);
  };

  const removeDiagramControlsRef = (diagram) => {
    diagramControlsRefs.current.delete(diagram);
  };

  const addImageControlsRef = (container, controlsData) => {
    imageControlsRefs.current.set(container, controlsData);
  };

  const removeImageControlsRef = (container) => {
    imageControlsRefs.current.delete(container);
  };

  // First render management
  const markFirstRenderCalled = () => {
    hasCalledFirstRender.current = true;
  };

  const resetFirstRenderFlag = () => {
    hasCalledFirstRender.current = false;
  };

  const shouldCallFirstRender = () => {
    return !hasCalledFirstRender.current;
  };

  const value = {
    // State
    html,
    setHtml,
    showImageModal,
    setShowImageModal,
    selectedImage,
    setSelectedImage,
    cropOverlayKey,
    setCropOverlayKey,

    // Refs
    previewScrollRef,
    cropModeRef,
    diagramControlsRefs,
    imageControlsRefs,

    // Crop mode actions
    enterCropMode,
    exitCropMode,
    isCropModeActive,

    // Control management
    addDiagramControlsRef,
    removeDiagramControlsRef,
    addImageControlsRef,
    removeImageControlsRef,

    // First render management
    markFirstRenderCalled,
    resetFirstRenderFlag,
    shouldCallFirstRender
  };

  return (
    <RendererContext.Provider value={value}>
      {children}
    </RendererContext.Provider>
  );
};

export default RendererProvider;