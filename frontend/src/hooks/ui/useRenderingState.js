import { useState, useEffect } from 'react';

export default function useRenderingState() {
  const [isRendering, setIsRendering] = useState(false);
  const [renderState, setRenderState] = useState('idle');
  const [isRapidTyping, setIsRapidTyping] = useState(false);

  // Debug logging for rendering state changes
  useEffect(() => {
    console.log('🎨 Rendering state updated', {
      isRendering,
      renderState,
      isRapidTyping,
      timestamp: new Date().toISOString()
    });
  }, [isRendering, renderState, isRapidTyping]);

  return {
    isRendering,
    setIsRendering,
    renderState,
    setRenderState,
    isRapidTyping,
    setIsRapidTyping
  };
}