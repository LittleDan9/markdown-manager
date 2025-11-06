/**
 * LifecycleManager - Handles cleanup and lifecycle management
 *
 * This component manages cleanup operations for diagrams and images,
 * coordinates effects, and handles first render logic.
 */
import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { useRendererContext } from './RendererContext';
import { useTheme } from '../../providers/ThemeProvider';
import DiagramControls from './DiagramControls';
import { ThemeProvider } from '../../providers/ThemeProvider';

const LifecycleManager = ({ onFirstRender }) => {
  const { theme } = useTheme();
  const {
    previewScrollRef,
    previewHTML,
    isRendering,
    diagramControlsRefs,
    imageControlsRefs,
    shouldCallFirstRender,
    markFirstRenderCalled
  } = useRendererContext();

  const imageManagerRef = useRef(null);

  /**
   * Add diagram controls to rendered Mermaid diagrams
   */
  const addDiagramControls = (previewElement) => {
    if (!previewElement) return;

    const diagrams = previewElement.querySelectorAll('.mermaid[data-processed="true"]');

    diagrams.forEach((diagram, index) => {
      const diagramId = `diagram-${index}`;

      // Skip if controls already added and still in DOM
      const existingControls = diagram.querySelector('.diagram-controls-container');
      if (existingControls && existingControls.isConnected) return;

      // Get diagram source from data attribute
      const encodedSource = diagram.getAttribute('data-mermaid-source') || '';
      const diagramSource = encodedSource ? decodeURIComponent(encodedSource) : '';

      // Add mermaid-container class if not present
      if (!diagram.classList.contains('mermaid-container')) {
        diagram.classList.add('mermaid-container');
      }

      // Remove any orphaned controls first
      const orphanedControls = diagram.querySelectorAll('.diagram-controls-container');
      orphanedControls.forEach(control => control.remove());

      // Create a container for the controls
      const controlsContainer = document.createElement('div');
      controlsContainer.className = 'diagram-controls-container';
      controlsContainer.style.position = 'absolute';
      controlsContainer.style.top = '0';
      controlsContainer.style.left = '0';
      controlsContainer.style.width = '100%';
      controlsContainer.style.height = '100%';
      controlsContainer.style.pointerEvents = 'none';
      diagram.appendChild(controlsContainer);

      // Create React root and render controls with providers
      const root = ReactDOM.createRoot(controlsContainer);
      root.render(
        <ThemeProvider>
          <DiagramControls
            diagramElement={diagram}
            diagramId={diagramId}
            diagramSource={diagramSource}
          />
        </ThemeProvider>
      );

      // Store the root for cleanup
      diagramControlsRefs.current.set(diagram, root);
    });
  };

  /**
   * Clean up controls that are no longer in the DOM
   */
  const cleanupStaleControls = () => {
    const validDiagrams = new Set();
    const validImages = new Set();

    if (previewScrollRef.current) {
      const currentDiagrams = previewScrollRef.current.querySelectorAll('.mermaid[data-processed="true"]');
      currentDiagrams.forEach(diagram => validDiagrams.add(diagram));

      const currentImageContainers = previewScrollRef.current.querySelectorAll('.user-image-container');
      currentImageContainers.forEach(container => validImages.add(container));
    }

    // Async cleanup to avoid race conditions
    setTimeout(() => {
      // Cleanup diagram controls
      diagramControlsRefs.current.forEach((root, diagram) => {
        if (!validDiagrams.has(diagram)) {
          try {
            root.unmount();
            diagramControlsRefs.current.delete(diagram);
          } catch (error) {
            console.warn('Error unmounting diagram controls:', error);
          }
        }
      });

      // Cleanup image controls
      imageControlsRefs.current.forEach((controlsData, container) => {
        if (!validImages.has(container)) {
          try {
            if (controlsData.cleanup) {
              controlsData.cleanup();
            }
            if (controlsData.observer) {
              controlsData.observer.disconnect();
            }
            imageControlsRefs.current.delete(container);
          } catch (error) {
            console.warn('Error cleaning up image controls:', error);
          }
        }
      });
    }, 0);
  };

  // Add controls after preview HTML is updated and rendering is complete
  useEffect(() => {
    if (previewHTML && previewScrollRef.current && !isRendering) {
      console.log('LifecycleManager: Checking orchestrator state before adding controls');

      // Check orchestrator state if available
      const orchestratorState = window.__renderingOrchestrator;

      if (orchestratorState && orchestratorState.state !== 'idle' && orchestratorState.state !== 'completed') {
        console.log('LifecycleManager: Orchestrator still processing, delaying control setup', {
          orchestratorState: orchestratorState.state,
          queueLength: orchestratorState.queueLength
        });

        // Wait for orchestrator to finish
        const checkOrchestrator = () => {
          const currentState = window.__renderingOrchestrator;
          if (!currentState || currentState.state === 'idle' || currentState.state === 'completed') {
            console.log('LifecycleManager: Orchestrator ready, proceeding with control setup');
            proceedWithControlSetup();
          } else {
            // Check again after a short delay
            setTimeout(checkOrchestrator, 100);
          }
        };

        setTimeout(checkOrchestrator, 100);
      } else {
        console.log('LifecycleManager: Orchestrator idle, proceeding immediately');
        proceedWithControlSetup();
      }
    }

    function proceedWithControlSetup() {
      // Clean up stale controls
      cleanupStaleControls();

      // Add controls to new diagrams with appropriate delay
      setTimeout(() => {
        if (previewScrollRef.current) {
          addDiagramControls(previewScrollRef.current);
        }
      }, 200); // Increased delay for stability
    }
  }, [previewHTML, isRendering]);

  // Call onFirstRender when ready
  useEffect(() => {
    console.log("onFirstRender check:", {
      hasCallback: !!onFirstRender,
      isRendering,
      hasPreviewHTML: !!previewHTML,
      shouldCall: shouldCallFirstRender()
    });

    if (onFirstRender && !isRendering && previewHTML && shouldCallFirstRender()) {
      console.log("Calling onFirstRender");
      markFirstRenderCalled();
      onFirstRender();
    }
  }, [onFirstRender, isRendering, previewHTML]);

  // Listen for diagram export completion events
  useEffect(() => {
    const handleExportComplete = (event) => {
      console.log('Diagram export completed:', event.detail);

      // Re-validate diagram controls after export
      if (previewScrollRef.current && !isRendering) {
        setTimeout(() => {
          const diagrams = previewScrollRef.current.querySelectorAll('.mermaid[data-processed="true"]');
          diagrams.forEach(diagram => {
            const existingControls = diagram.querySelector('.diagram-controls-container');
            if (!existingControls || !existingControls.isConnected) {
              console.log('Re-adding controls after export for diagram');
              // Remove the diagram from refs so it gets re-processed
              diagramControlsRefs.current.delete(diagram);
            }
          });
          // Re-add controls
          addDiagramControls(previewScrollRef.current);
        }, 100);
      }
    };

    window.addEventListener('diagramExportComplete', handleExportComplete);
    return () => {
      window.removeEventListener('diagramExportComplete', handleExportComplete);
    };
  }, [previewHTML, isRendering]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setTimeout(() => {
        // Cleanup diagram controls
        diagramControlsRefs.current.forEach((root, diagram) => {
          try {
            root.unmount();
          } catch (error) {
            console.warn('Error unmounting diagram controls on cleanup:', error);
          }
        });
        diagramControlsRefs.current.clear();

        // Cleanup image controls
        imageControlsRefs.current.forEach((controlsData, container) => {
          try {
            if (controlsData.cleanup) {
              controlsData.cleanup();
            }
            if (controlsData.observer) {
              controlsData.observer.disconnect();
            }
          } catch (error) {
            console.warn('Error cleaning up image controls on cleanup:', error);
          }
        });
        imageControlsRefs.current.clear();
      }, 0);
    };
  }, []);

  // This component doesn't render anything directly
  return null;
};

export default LifecycleManager;