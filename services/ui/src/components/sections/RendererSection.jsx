import React, { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Container, Alert, Button } from 'react-bootstrap';
import Renderer from '../Renderer';
import CategoryTabBar from '../editor/CategoryTabBar';
import { useDocumentContext } from '../../providers/DocumentContextProvider';
import { useAuth } from '../../providers/AuthProvider';
import { useConfirmModal } from '../../hooks/ui/useConfirmModal';
import ConfirmModal from '../shared/modals/ConfirmModal';
import documentsApi from '../../api/documentsApi';
import DocumentStorageService from '../../services/core/DocumentStorageService';

/**
 * RendererSection - Wrapper component for the renderer area
 * Handles renderer with error states and shared view logic
 */

// ...existing code...
function RendererSection({
  isSharedView,
  sharedDocument,
  sharedLoading,
  isInitializing,
  documentLoading,
  syncPreviewScrollEnabled,
  cursorLine,
  fullscreenPreview
}) {
  const {
    content,
    currentDocument,
    siblingDocs,
    tabsEnabled,
    siblingCategoryName,
    loadDocument,
    createDocument,
    deleteDocument,
    renameDocument,
    refreshSiblings,
    removeSibling,
    updateSiblingName,
    siblingOverrideMode,
    clearSiblingOverride,
  } = useDocumentContext();
  const { tabPosition, isAuthenticated } = useAuth();
  const { show: showDeleteModal, modalConfig: deleteModalConfig, openModal, handleAction: handleDeleteAction } = useConfirmModal();
  const [hasRendered, setHasRendered] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Loading...");

  // Reset hasRendered only when starting a document operation (not content changes)
  useEffect(() => {
    if (isInitializing || sharedLoading || documentLoading) {
      setHasRendered(false);
      if (isInitializing) {
        setLoadingMessage("Initializing...");
      } else if (sharedLoading) {
        setLoadingMessage("Loading shared document...");
      } else if (documentLoading) {
        setLoadingMessage("Loading document...");
      }
    }
  }, [isInitializing, sharedLoading, documentLoading]);

  // Handle empty content case - consider it "rendered" immediately
  useEffect(() => {
    console.log("RendererSection: Empty content check", {
      content: content.length,
      contentTrimmed: content.trim().length,
      isInitializing,
      sharedLoading,
      documentLoading
    });

    if (!content.trim() && !isInitializing && !sharedLoading && !documentLoading) {
      console.log("RendererSection: Setting hasRendered=true for empty content");
      setHasRendered(true);
    }
  }, [content, isInitializing, sharedLoading, documentLoading]);

    const handleFirstRender = useCallback(() => {
    console.log("handleFirstRender called - setting hasRendered to true");
    setHasRendered(true);
  }, []);

  // Only show spinner for document operations, not content changes
  const showSpinner = (isInitializing || sharedLoading || documentLoading) && !hasRendered;

  const scrollToLineValue = isSharedView ? null : (syncPreviewScrollEnabled ? cursorLine : null);

  // Tab bar callbacks
  const handleTabClick = useCallback((docId) => {
    if (docId !== currentDocument?.id) {
      // In override mode (e.g. recents), just load the doc — don't clear the override.
      // The override keeps the tab bar pinned to the virtual category.
      loadDocument(docId);
    }
  }, [currentDocument?.id, loadDocument]);

  const handleRename = useCallback(async (docId, newName) => {
    try {
      const category = currentDocument?.category || 'General';
      await renameDocument(docId, newName, category);
      if (siblingOverrideMode) {
        // In override mode, update the tab label in-place to avoid breaking the override
        updateSiblingName(docId, newName);
      } else {
        refreshSiblings();
      }
    } catch (error) {
      console.error('Failed to rename document:', error);
    }
  }, [currentDocument?.category, renameDocument, refreshSiblings, siblingOverrideMode, updateSiblingName]);

  const handleDeleteDocument = useCallback((docId, docName) => {
    if (!docId) return;
    const isActive = docId === currentDocument?.id;
    // Pre-compute the first remaining sibling (excluding the one being deleted)
    const remainingSiblings = siblingDocs.filter(d => d.id !== docId);
    const firstSiblingId = remainingSiblings.length > 0 ? remainingSiblings[0].id : null;

    // In recents override mode, dismiss from recents instead of deleting
    if (siblingOverrideMode === 'recents') {
      (async () => {
        try {
          if (isAuthenticated) {
            await documentsApi.dismissFromRecent(docId);
          } else {
            DocumentStorageService.dismissFromRecent(docId);
          }
          removeSibling(docId);
          if (isActive) {
            if (firstSiblingId) {
              await loadDocument(firstSiblingId);
            } else {
              clearSiblingOverride();
            }
          }
        } catch (error) {
          console.error('Failed to dismiss document from recents:', error);
        }
      })();
      return;
    }

    openModal(
      async (actionKey) => {
        if (actionKey === 'delete') {
          try {
            await deleteDocument(docId);
            // Optimistic removal: immediately hide the tab
            removeSibling(docId);
            if (isActive) {
              if (firstSiblingId) {
                // Switch to the first remaining doc in the category.
                // loadDocument changes currentDocument.id which triggers
                // the useEffect in useSiblingDocs — no explicit refresh needed.
                await loadDocument(firstSiblingId);
              } else if (siblingOverrideMode) {
                // All override tabs deleted — clear override
                clearSiblingOverride();
              }
              // If no siblings left, document is already cleared by deleteDocument
            } else if (!siblingOverrideMode) {
              // Non-active tab deleted outside override mode: refresh to get authoritative data
              await refreshSiblings();
            }
          } catch (error) {
            console.error('Failed to delete document from tab:', error);
          }
        }
      },
      {
        title: 'Delete Document',
        message: `Are you sure you want to delete '${docName}'? This cannot be undone.`,
        buttons: [
          { text: 'Delete', variant: 'danger', action: 'delete', autoFocus: true },
          { text: 'Cancel', variant: 'secondary', action: 'cancel' },
        ],
        icon: <i className="bi bi-trash text-danger me-2"></i>,
      },
    );
  }, [currentDocument?.id, siblingDocs, deleteDocument, loadDocument, refreshSiblings, removeSibling, openModal, siblingOverrideMode, clearSiblingOverride, isAuthenticated]);

  const handleAddDocument = useCallback(() => {
    if (siblingOverrideMode) {
      // In override mode (e.g. recents), create new doc in Drafts — stay in override
      createDocument({ name: 'Untitled', category: 'Drafts' });
    } else {
      const category = currentDocument?.category || 'General';
      const categoryId = currentDocument?.category_id;
      createDocument({
        name: 'Untitled',
        category,
        category_id: categoryId,
      });
    }
    // No manual refreshSiblings needed — the auto-refresh effect in useSiblingDocs
    // triggers when currentDocument changes. A stale setTimeout here would use the
    // old currentDocument's API path, overwriting the correct localStorage results.
  }, [currentDocument?.category, currentDocument?.category_id, createDocument, siblingOverrideMode]);

  const showTabs = !isSharedView && tabsEnabled && siblingDocs.length > 0;
  const tabBar = showTabs ? (
    <CategoryTabBar
      siblings={siblingDocs}
      activeDocId={currentDocument?.id}
      categoryName={siblingCategoryName}
      position={tabPosition}
      onTabClick={handleTabClick}
      onRename={handleRename}
      onDelete={handleDeleteDocument}
      onAddDocument={handleAddDocument}
    />
  ) : null;

  return (
    <>
      {isSharedView && !sharedDocument && !sharedLoading ? (
        <div id="previewContainer">
          <Container className="py-4">
            <Alert variant="danger">
              <Alert.Heading>Unable to Load Document</Alert.Heading>
              <p>The shared document could not be found or sharing has been disabled.</p>
              <hr />
              <div className="d-flex justify-content-end">
                <Button
                  variant="outline-danger"
                  onClick={() => window.location.href = '/'}
                >
                  Go to Main App
                </Button>
              </div>
            </Alert>
          </Container>
        </div>
      ) : (
        <>
          <Renderer
            scrollToLine={scrollToLineValue}
            fullscreenPreview={fullscreenPreview}
            onFirstRender={handleFirstRender}
            showLoadingOverlay={showSpinner}
            loadingMessage={loadingMessage}
            tabBarAbove={tabPosition === 'above' ? tabBar : null}
            tabBarBelow={tabPosition === 'below' ? tabBar : null}
          />
        </>
      )}

      {showDeleteModal && deleteModalConfig && (
        <ConfirmModal
          show={showDeleteModal}
          title={deleteModalConfig.title}
          message={deleteModalConfig.message}
          icon={deleteModalConfig.icon}
          buttons={deleteModalConfig.buttons}
          onAction={handleDeleteAction}
          onHide={() => handleDeleteAction('cancel')}
        />
      )}
    </>
  );
}
RendererSection.propTypes = {
  isSharedView: PropTypes.bool.isRequired,
  sharedDocument: PropTypes.object,
  sharedLoading: PropTypes.bool.isRequired,
  isInitializing: PropTypes.bool.isRequired,
  documentLoading: PropTypes.bool.isRequired,
  syncPreviewScrollEnabled: PropTypes.bool.isRequired,
  cursorLine: PropTypes.number.isRequired,
  fullscreenPreview: PropTypes.bool.isRequired,
};

export default RendererSection;
