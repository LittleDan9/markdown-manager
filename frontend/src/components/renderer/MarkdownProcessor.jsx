/**
 * MarkdownProcessor - Simplified component that delegates to RenderingOrchestrator
 *
 * This component now serves as a bridge between the content props and the
 * centralized RenderingOrchestrator, removing the direct rendering logic
 * to prevent race conditions and uncoordinated renders.
 */
import React from 'react';
import RenderingOrchestrator from './RenderingOrchestrator';
import { useTheme } from '../../providers/ThemeProvider';

const MarkdownProcessor = ({ content, onRenderComplete }) => {
  const { theme } = useTheme();

  console.log("📄 MarkdownProcessor: Delegating to RenderingOrchestrator", {
    contentLength: content?.length,
    theme,
    timestamp: new Date().toISOString()
  });

  // Delegate all rendering logic to the orchestrator
  return (
    <RenderingOrchestrator
      content={content}
      theme={theme}
      onRenderComplete={onRenderComplete}
    />
  );
};

export default MarkdownProcessor;