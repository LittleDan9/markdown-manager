/**
 * RenderingOrchestrator - Central coordinator for all rendering operations
 *
 * This component manages the entire rendering pipeline with proper orchestration,
 * preventing race conditions and coordinating all renderer sub-components.
 *
 * Key responsibilities:
 * - Queue and prioritize rendering requests
 * - Cancel obsolete renders when new content arrives
 * - Coordinate timing between markdown processing, syntax highlighting, and Mermaid
 * - Provide stable render state to dependent components (ImageManager, LifecycleManager)
 * - Debounce rapid content changes to prevent performance issues
 */
import React from 'react';
import { useRenderingOrchestrator } from '../../hooks/renderer/useRenderingOrchestrator';

const RenderingOrchestrator = ({ theme, onRenderComplete }) => {
  useRenderingOrchestrator({ theme, onRenderComplete });

  // This component doesn't render anything directly
  return null;
};

export default RenderingOrchestrator;