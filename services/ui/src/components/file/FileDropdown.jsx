import React, { useState, useEffect } from "react";
import { Dropdown, ButtonGroup, Badge, Spinner, Offcanvas } from "react-bootstrap";
import FileOpenModal from "@/components/file/FileOpenModal";
import FileImportModal from "@/components/file/FileImportModal";
import FileSaveAsModal from "@/components/file/FileSaveAsModal";
import FileOverwriteModal from "@/components/file/FileOverwriteModal";
import GitHubSaveModal from "@/components/file/modals/GitHubSaveModal";
import RecentFilesDropdown from "@/components/file/RecentFilesDropdown";
import UnsavedDocumentsDropdown from "@/components/file/UnsavedDocumentsDropdown";
import ConfirmModal from "@/components/shared/modals/ConfirmModal";
import GitHistoryModal from "@/components/shared/modals/GitHistoryModal";
import PromoteDraftModal from "@/components/document/modals/PromoteDraftModal";
import SaveAsDocumentModal from "@/components/document/modals/SaveAsDocumentModal";
import { useDocumentContext } from "@/providers/DocumentContextProvider.jsx";
import { useConfirmModal, useFileModal, useResponsiveMenu } from "@/hooks/ui";
import { useNotification } from "@/components/NotificationProvider";
import { useFileOperations, useGitStatus } from "@/hooks/document";
import { useTheme } from "@/providers/ThemeProvider.jsx";
import { useAuth } from "@/providers/AuthProvider";
import { useViewport } from "@/hooks";
import { markDraftAcknowledged, isDraftAcknowledged } from "@/hooks/document/useSaveDocument";
import gitHubApi from "@/api/gitHubApi";
import documentsApi from "@/api/documentsApi";

function FileDropdown({ setDocumentTitle, setContent }) {
  const { isAuthenticated } = useAuth();
  const { theme } = useTheme();
  const { isMobile } = useViewport();
  const { show, modalConfig, openModal, handleAction } = useConfirmModal();
  const {
    createDocument, saveDocument, currentDocument,
    loadDocument, deleteDocument, isDefaultDoc, hasUnsavedChanges, content, previewHTML,
    categories, openCategory, openRecents, clearSiblingOverride
  } = useDocumentContext();
  const { showSuccess, showError, showInfo } = useNotification();
  const { showFileModal, openFileModal } = useFileModal();

  // Responsive menu hook - adjusted thresholds for better UX
  const { isFullMenu, isMediumMenu, isCompactMenu, showInMedium } = useResponsiveMenu({
    fullMenuHeight: 900,  // 900px+ shows everything
    mediumMenuHeight: 700, // 700-899px shows most features
    compactMenuHeight: 500 // <700px shows minimal features
  });

  // Debug logging for responsive behavior
  useEffect(() => {
    const mode = isCompactMenu ? 'Compact' : isMediumMenu ? 'Medium' : 'Full';
    console.debug(`[FileDropdown] Responsive mode: ${mode} (window height: ${window.innerHeight}px)`);
  }, [isCompactMenu, isMediumMenu, isFullMenu]);

  // Removed share modal state - now handled by ShareButton component

  // GitHub save modal state
  const [showGitHubSaveModal, setShowGitHubSaveModal] = React.useState(false);

  // Mobile file menu offcanvas state
  const [showMobileFileMenu, setShowMobileFileMenu] = useState(false);

  // Git history modal state
  const [showGitHistoryModal, setShowGitHistoryModal] = useState(false);

  // Draft promotion modal state (for File > Save on Drafts docs)
  const [showPromoteDraft, setShowPromoteDraft] = useState(false);

  // Save As modal state
  const [showSaveAsDocModal, setShowSaveAsDocModal] = useState(false);

  // Open Category submenu state
  const [showCategorySubmenu, setShowCategorySubmenu] = useState(false);

  // Local loading state for git operations
  const [gitLoading, setGitLoading] = useState(false);

  // Use centralized git status hook
  const { gitStatus, loading: gitStatusLoading, refreshGitStatus } = useGitStatus(currentDocument?.id, currentDocument);

  // Consolidated file operations
  const fileOps = useFileOperations({ setDocumentTitle, setContent, renderedHTML: previewHTML, theme });

  // Git operation handlers
  const handleCommit = async () => {
    if (!currentDocument?.id) return;

    const commitMessage = prompt('Enter commit message:');
    if (!commitMessage) return;

    setGitLoading(true);
    try {
      const result = await gitHubApi.commitDocumentChanges(currentDocument.id, commitMessage);

      showSuccess(`Successfully committed changes: ${result.commit_hash?.substring(0, 7) || 'success'}`);

      // Reload status after commit
      refreshGitStatus();
    } catch (error) {
      showError(`Failed to commit changes: ${error.message}`);
    } finally {
      setGitLoading(false);
    }
  };

  const handleSaveAndCommit = async () => {
    if (!currentDocument) return;

    // Save first
    try {
      await saveDocument({ ...currentDocument, content });
      setDocumentTitle(currentDocument.name);

      // Then commit
      await handleCommit();
    } catch (error) {
      showError(`Failed to save and commit: ${error.message}`);
    }
  };

  const handleRefreshGitStatus = () => {
    refreshGitStatus();
  };

  const handleViewGitFiles = () => {
    // Open the existing file browser modal and navigate to the current document's repository
    if (currentDocument?.repository_type === 'github' && currentDocument?.github_repository_id) {
      // For GitHub repositories, create a minimal repository object and open the GitHub tab
      const repositoryInfo = {
        id: currentDocument.github_repository_id,
        internal_repo_id: currentDocument.github_repository_id,
        // Add any other information we might have from the document
        ...(currentDocument.github_file_path && { file_path: currentDocument.github_file_path })
      };

      console.log('🔍 FileDropdown handleViewGitFiles - GitHub repositoryInfo:', repositoryInfo);

      // Open the GitHub tab with the specific repository pre-selected
      openFileModal('github', repositoryInfo);
    } else {
      // For local documents, try to navigate to the document's category/repository
      let repositoryInfo = null;

      if (currentDocument?.file_path && currentDocument.file_path.startsWith('local/')) {
        // Extract category from file_path like "local/General/filename.md"
        const pathParts = currentDocument.file_path.split('/');
        if (pathParts.length >= 2) {
          const categoryName = pathParts[1];
          repositoryInfo = {
            type: 'local',
            category: categoryName,
            // For local documents, we navigate to the Documents folder
            path: `/Documents/${categoryName}`
          };
        }
      }

      console.log('🔍 FileDropdown handleViewGitFiles - Local repositoryInfo:', repositoryInfo);

      // Open the local tab with repository info if available
      openFileModal('local', repositoryInfo);
    }
  };  const handleViewGitHistory = () => {
    if (!currentDocument?.id) return;
    setShowGitHistoryModal(true);
  };

  const handleGitSync = () => {
    if (gitStatus?.repository_type === 'github') {
      showInfo('GitHub sync: Use Save to GitHub to push changes to remote repository');
    } else {
      showInfo('Local repositories do not have remote sync. Use Save to GitHub to create a remote repository.');
    }
  };

  const handleCreateBranch = async () => {
    if (!currentDocument?.id) {
      showError('No document selected');
      return;
    }

    const branchName = prompt('Enter new branch name:');
    if (!branchName || !branchName.trim()) {
      return; // User cancelled or empty name
    }

    setGitLoading(true);
    try {
      const response = await documentsApi.createDocumentBranch(currentDocument.id, {
        branch_name: branchName.trim(),
        switch_to_branch: true
      });

      if (response.success) {
        showSuccess(`Branch '${response.branch_name}' created and switched to successfully!`);
        refreshGitStatus();
      } else {
        showError(`Failed to create branch: ${response.message || 'Unknown error'}`, null, null, 'git');
      }
    } catch (error) {
      console.error('Failed to create branch:', error);
      showError(`Failed to create branch: ${error.message}`, null, error.response?.data, 'git');
    } finally {
      setGitLoading(false);
    }
  };

  // File operation handlers
  const handleNew = () => {
    if (hasUnsavedChanges) {
      fileOps.openSaveAs && fileOps.openSaveAs(content, currentDocument?.name || 'Untitled Document');
    } else {
      createDocument({ category: 'Drafts' });
      setDocumentTitle("Untitled Document");
      showSuccess("New document created in Drafts.");
    }
  };

  const handleSave = () => {
    if (!currentDocument) return;
    // Draft promotion check
    if (currentDocument.category === 'Drafts' && !isDraftAcknowledged(currentDocument.id)) {
      setShowPromoteDraft(true);
      return;
    }
    saveDocument({ ...currentDocument, content });
    setDocumentTitle(currentDocument.name);
  };

  const handlePromoteConfirm = (category, name) => {
    if (!currentDocument) return;
    if (category === 'Drafts') {
      markDraftAcknowledged(currentDocument.id);
    }
    const updatedDoc = { ...currentDocument, name, category, content };
    saveDocument(updatedDoc, true);
    setDocumentTitle(name);
    setShowPromoteDraft(false);
  };

  const handleClose = () => {
    createDocument({ category: 'Drafts' });
    setDocumentTitle("Untitled Document");
    showSuccess("Document closed.");
  };

  const handleSaveAsConfirm = async (category, name) => {
    try {
      const newDoc = await documentsApi.createDocument({
        name,
        content: content || "",
        category,
      });
      await loadDocument(newDoc.id);
      setDocumentTitle(name);
      // Force re-render of preview (content is identical, so trigger rendering explicitly)
      setContent(content || "");
      setShowSaveAsDocModal(false);
      showSuccess(`Document saved as '${name}'.`);
    } catch (error) {
      showError(`Failed to save as: ${error.message}`);
    }
  };

  const handleDelete = () => {
    if (isDefaultDoc) {
      showError("Cannot delete an unsaved document.");
      return;
    }

    openModal(
      async (actionKey) => {
        if (actionKey === "delete") {
          try {
            await deleteDocument(currentDocument.id);
            createDocument();
            setDocumentTitle("Untitled Document");
          } catch (error) {
            showError(`Failed to delete document: ${error.message}`);
          }
        }
      },
      {
        title: "Delete Document",
        message: `Are you sure you want to delete '${currentDocument.name}'? This cannot be undone.`,
        buttons: [
          { text: "Delete", variant: "danger", action: "delete", autoFocus: true },
          { text: "Cancel", variant: "secondary", action: "cancel" },
        ],
        icon: <i className="bi bi-trash text-danger me-2"></i>,
      },
    );
  };

  const handleRecentFileSelect = async (file) => {
    try {
      await loadDocument(file.id);
      setDocumentTitle(file.name);
      showSuccess(`Opened: ${file.name}`);
    } catch (error) {
      showError(`Failed to open document: ${error.message}`);
    }
  };

  // Function to close the main dropdown
  const closeDropdown = () => {
    // Find the dropdown toggle and trigger a click to close it
    const dropdownToggle = document.querySelector('#fileMenuDropdown');
    if (dropdownToggle && dropdownToggle.getAttribute('aria-expanded') === 'true') {
      dropdownToggle.click();
    }
  };

  const handleSaveToGitHub = () => {
    if (isDefaultDoc) {
      showError("Please save the document locally before saving to GitHub.");
      return;
    }
    setShowGitHubSaveModal(true);
  };

  const handleGitHubSaveSuccess = (result) => {
    showSuccess(`Document saved to GitHub: ${result.file_url}`);
    // Optionally reload the document to get updated GitHub metadata
    if (result.document_id === currentDocument?.id) {
      loadDocument(result.document_id);
    }
  };

  // Helper to run an action and close mobile menu
  const mobileAction = (action) => {
    setShowMobileFileMenu(false);
    action();
  };

  // Shared menu items renderer for mobile offcanvas
  const renderMobileFileMenu = () => (
    <Offcanvas
      show={showMobileFileMenu}
      onHide={() => setShowMobileFileMenu(false)}
      placement="start"
      className="mobile-file-menu"
    >
      <Offcanvas.Header closeButton>
        <Offcanvas.Title>
          <i className="bi bi-folder2 me-2" />File
        </Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body>
        <nav className="mobile-menu-nav">
          {/* Core Operations */}
          <button type="button" className="mobile-menu-item" onClick={() => mobileAction(handleNew)}>
            <i className="bi bi-file-plus" /><span>New Document</span>
          </button>
          <button type="button" className="mobile-menu-item" onClick={() => mobileAction(() => openFileModal('local'))}>
            <i className="bi bi-folder2-open" /><span>Open Document</span>
          </button>

          {/* Open Category - Mobile */}
          {categories && categories.length > 0 && (
            <>
              <div className="mobile-menu-section-header">
                <i className="bi bi-folder2-open me-2" />Open Category
              </div>
              <button
                type="button"
                className="mobile-menu-item"
                onClick={() => mobileAction(() => openRecents())}
              >
                <i className="bi bi-clock-history" />
                <span>Recent</span>
              </button>
              <hr className="mobile-menu-divider" />
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className="mobile-menu-item"
                  onClick={() => mobileAction(() => { clearSiblingOverride(); openCategory(cat); })}
                >
                  <i className={`bi ${cat === currentDocument?.category ? 'bi-folder-fill' : 'bi-folder'}`} />
                  <span>{cat}</span>
                </button>
              ))}
            </>
          )}
          <button type="button" className="mobile-menu-item" onClick={() => mobileAction(handleClose)} disabled={isDefaultDoc && !hasUnsavedChanges}>
            <i className="bi bi-x-circle" /><span>Close Document</span>
          </button>
          <button type="button" className="mobile-menu-item" onClick={() => mobileAction(handleSave)} disabled={gitLoading}>
            <i className="bi bi-save" />
            <span className="d-flex align-items-center gap-2">
              Save
              {gitLoading && <Spinner size="sm" />}
              {gitStatus && (gitStatus.has_uncommitted_changes || gitStatus.has_staged_changes || gitStatus.has_untracked_files) && (
                <Badge bg="warning" text="dark" style={{ fontSize: '0.7em' }}>Changes</Badge>
              )}
            </span>
          </button>
          <button type="button" className="mobile-menu-item" onClick={() => mobileAction(() => setShowSaveAsDocModal(true))} disabled={isDefaultDoc}>
            <i className="bi bi-files" /><span>Save As</span>
          </button>
          <button type="button" className="mobile-menu-item text-danger" onClick={() => mobileAction(handleDelete)} disabled={isDefaultDoc}>
            <i className="bi bi-trash" /><span>Delete Document</span>
          </button>

          {gitStatus && (gitStatus.has_uncommitted_changes || gitStatus.has_staged_changes || gitStatus.has_untracked_files) && (
            <button type="button" className="mobile-menu-item" onClick={() => mobileAction(handleSaveAndCommit)} disabled={gitLoading || isDefaultDoc}>
              <i className="bi bi-check-square" /><span>Save & Commit</span>
            </button>
          )}

          <hr className="mobile-menu-divider" />

          {/* Version Control */}
          {gitStatus && (
            <>
              <div className="mobile-menu-section-header">
                <i className="bi bi-git me-2" />Version Control
                <small className="text-muted ms-2">({gitStatus.repository_type} • {gitStatus.current_branch})</small>
              </div>

              <button type="button" className="mobile-menu-item" onClick={() => mobileAction(handleCommit)}
                disabled={gitLoading || (!gitStatus?.has_uncommitted_changes && !gitStatus?.has_staged_changes && !gitStatus?.has_untracked_files)}>
                <i className="bi bi-check-square" /><span>Commit Changes</span>
              </button>
              <button type="button" className="mobile-menu-item" onClick={() => mobileAction(handleCreateBranch)} disabled={gitLoading}>
                <i className="bi bi-diagram-3" /><span>Create Branch</span>
              </button>
              <button type="button" className="mobile-menu-item" onClick={() => mobileAction(handleViewGitFiles)} disabled={gitLoading}>
                <i className="bi bi-folder" /><span>Browse Repository</span>
              </button>
              <button type="button" className="mobile-menu-item" onClick={() => mobileAction(handleViewGitHistory)} disabled={gitLoading}>
                <i className="bi bi-clock-history" /><span>View History</span>
              </button>

              <hr className="mobile-menu-divider" />
            </>
          )}

          {/* GitHub */}
          {isAuthenticated && (
            <>
              <div className="mobile-menu-section-header">
                <i className="bi bi-github me-2" />GitHub
              </div>
              <button type="button" className="mobile-menu-item" onClick={() => mobileAction(handleSaveToGitHub)} disabled={isDefaultDoc}>
                <i className="bi bi-cloud-arrow-up" /><span>Save to GitHub</span>
              </button>
              {gitStatus?.repository_type === 'github' && (
                <button type="button" className="mobile-menu-item" onClick={() => mobileAction(handleGitSync)} disabled={gitLoading}>
                  <i className="bi bi-cloud-arrow-up-down" /><span>Sync with GitHub</span>
                </button>
              )}
              <hr className="mobile-menu-divider" />
            </>
          )}

          {/* Import/Export */}
          <div className="mobile-menu-section-header">Import/Export</div>
          <button type="button" className="mobile-menu-item" onClick={() => mobileAction(fileOps.handleImport)}>
            <i className="bi bi-file-earmark-arrow-up" /><span>Import Markdown</span>
          </button>
          <button type="button" className="mobile-menu-item" onClick={() => mobileAction(fileOps.handleExportMarkdown)}>
            <i className="bi bi-filetype-md" /><span>Export Markdown</span>
          </button>
          <button type="button" className="mobile-menu-item" onClick={() => mobileAction(fileOps.handleExportPDF)}
            disabled={!currentDocument || !content || content.trim() === ""}>
            <i className="bi bi-filetype-pdf" /><span>Export PDF</span>
          </button>
        </nav>
      </Offcanvas.Body>
    </Offcanvas>
  );

  return (
    <>
      {isMobile ? (
        /* Mobile: icon button that opens offcanvas */
        <button
          type="button"
          className="mobile-file-menu-btn position-relative"
          onClick={() => setShowMobileFileMenu(true)}
          aria-label="File menu"
        >
          <i className="bi bi-folder2" />
          {gitStatus && (gitStatus.has_uncommitted_changes || gitStatus.has_staged_changes || gitStatus.has_untracked_files) && (
            <span className="mobile-file-menu-badge">
              <i className="bi bi-exclamation-circle"></i>
            </span>
          )}
        </button>
      ) : (
      <Dropdown as={ButtonGroup}>
        <Dropdown.Toggle id="fileMenuDropdown" size="sm" variant="secondary" className="dropdownToggle position-relative">
          <i className="bi bi-folder me-1"></i>File
          {gitStatus && (gitStatus.has_uncommitted_changes || gitStatus.has_staged_changes || gitStatus.has_untracked_files) && (
            <Badge bg="warning" className="position-absolute top-0 start-100 translate-middle" style={{ fontSize: '0.6em' }}>
              <i className="bi bi-exclamation-circle"></i>
            </Badge>
          )}
        </Dropdown.Toggle>
        <Dropdown.Menu>
          <RecentFilesDropdown onFileSelect={handleRecentFileSelect} onClose={closeDropdown} />
          <UnsavedDocumentsDropdown onFileSelect={handleRecentFileSelect} onClose={closeDropdown} />

          {/* Open Category submenu */}
          {categories && categories.length > 0 && (
            <div
              className="dropdown-submenu"
              onMouseEnter={() => setShowCategorySubmenu(true)}
              onMouseLeave={() => setShowCategorySubmenu(false)}
            >
              <Dropdown.Item
                as="div"
                className="d-flex justify-content-between align-items-center"
                style={{ cursor: 'pointer' }}
              >
                <span>
                  <i className="bi bi-folder2-open me-2"></i>
                  Open Category
                </span>
                <i className="bi bi-chevron-right"></i>
              </Dropdown.Item>

              {showCategorySubmenu && (
                <div
                  className="dropdown-submenu-menu show"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: '100%',
                    zIndex: 1001,
                    minWidth: '200px',
                    marginTop: '-0.5rem',
                    marginLeft: '0.125rem',
                    backgroundColor: 'var(--bs-body-bg)',
                    border: '1px solid var(--bs-border-color)',
                    borderRadius: '0.375rem',
                    boxShadow: '0 0.5rem 1rem rgba(0, 0, 0, 0.175)',
                    padding: '0.5rem 0'
                  }}
                >
                  <Dropdown.Item
                    key="__recents__"
                    onClick={() => {
                      openRecents();
                      setShowCategorySubmenu(false);
                      closeDropdown();
                    }}
                  >
                    <i className="bi bi-clock-history me-2"></i>
                    Recent
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  {categories.map((cat) => (
                    <Dropdown.Item
                      key={cat}
                      onClick={() => {
                        clearSiblingOverride();
                        openCategory(cat);
                        setShowCategorySubmenu(false);
                        closeDropdown();
                      }}
                    >
                      <i className={`bi ${cat === currentDocument?.category ? 'bi-folder-fill' : 'bi-folder'} me-2`}></i>
                      {cat}
                    </Dropdown.Item>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Core Operations - Always visible */}
          <Dropdown.Item onClick={handleNew}>
            <i className="bi bi-file-plus me-2"></i>New Document
          </Dropdown.Item>
          <Dropdown.Item onClick={() => openFileModal('local')}>
            <i className="bi bi-folder2-open me-2"></i>Open Document
          </Dropdown.Item>
          <Dropdown.Item onClick={handleClose} disabled={isDefaultDoc && !hasUnsavedChanges}>
            <i className="bi bi-x-circle me-2"></i>Close Document
          </Dropdown.Item>
          <Dropdown.Item onClick={handleSave} disabled={gitLoading}>
            <i className="bi bi-save me-2"></i>Save
            {gitLoading && <Spinner size="sm" className="ms-2" />}
            {gitStatus && (gitStatus.has_uncommitted_changes || gitStatus.has_staged_changes || gitStatus.has_untracked_files) && (
              <Badge bg="warning" text="dark" className="ms-2" style={{ fontSize: '0.7em' }}>
                Changes
              </Badge>
            )}
            {gitStatus && !gitStatus.has_uncommitted_changes && !gitStatus.has_staged_changes && !gitStatus.has_untracked_files && (
              <Badge bg="success" className="ms-2" style={{ fontSize: '0.7em' }}>
                Clean
              </Badge>
            )}
          </Dropdown.Item>
          <Dropdown.Item onClick={() => setShowSaveAsDocModal(true)} disabled={isDefaultDoc}>
            <i className="bi bi-files me-2"></i>Save As
          </Dropdown.Item>
          <Dropdown.Item onClick={handleDelete} disabled={isDefaultDoc}>
            <i className="bi bi-trash me-2"></i>Delete Document
          </Dropdown.Item>

          {/* Save & Commit - Always show if there are changes */}
          {gitStatus && (gitStatus.has_uncommitted_changes || gitStatus.has_staged_changes || gitStatus.has_untracked_files) && (
            <Dropdown.Item onClick={handleSaveAndCommit} disabled={gitLoading || isDefaultDoc}>
              <i className="bi bi-check-square me-2"></i>Save & Commit...
              {gitLoading && <Spinner size="sm" className="ms-2" />}
            </Dropdown.Item>
          )}

          <Dropdown.Divider />

          {/* Version Control Operations */}
          {gitStatus && (
            <>
              {showInMedium() && (
                <Dropdown.Header>
                  <i className="bi bi-git me-2"></i>Version Control
                </Dropdown.Header>
              )}
              {isCompactMenu && (
                <Dropdown.Header>
                  <i className="bi bi-git me-2"></i>Git ({gitStatus.repository_type})
                </Dropdown.Header>
              )}

              {/* Git Status Information - Now within Version Control section */}
              {showInMedium() && (
                <Dropdown.ItemText className="small text-muted">
                  <div className="d-flex align-items-center justify-content-between">
                    <span>
                      <i className="bi bi-info-circle me-1"></i>
                      {gitStatus.repository_type} • {gitStatus.current_branch}
                    </span>
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={handleRefreshGitStatus}
                      disabled={gitStatusLoading}
                      title="Refresh git status"
                      style={{ padding: '2px 6px', fontSize: '0.7em' }}
                    >
                      <i className="bi bi-arrow-clockwise"></i>
                    </button>
                  </div>
                  {(gitStatus.has_uncommitted_changes || gitStatus.has_staged_changes || gitStatus.has_untracked_files) && (
                    <div className="text-warning mt-1">
                      <i className="bi bi-exclamation-triangle me-1"></i>
                      <strong>Uncommitted changes detected</strong>
                      {gitStatus.modified_files?.length > 0 && <div>• {gitStatus.modified_files.length} modified files</div>}
                      {gitStatus.staged_files?.length > 0 && <div>• {gitStatus.staged_files.length} staged files</div>}
                      {gitStatus.untracked_files?.length > 0 && <div>• {gitStatus.untracked_files.length} untracked files</div>}
                    </div>
                  )}
                  {!gitStatus.has_uncommitted_changes && !gitStatus.has_staged_changes && !gitStatus.has_untracked_files && (
                    <div className="text-success mt-1">
                      <i className="bi bi-check-circle me-1"></i>
                      Working directory clean
                    </div>
                  )}
                </Dropdown.ItemText>
              )}

              <Dropdown.Item
                onClick={handleCommit}
                disabled={gitLoading || (!gitStatus?.has_uncommitted_changes && !gitStatus?.has_staged_changes && !gitStatus?.has_untracked_files)}
              >
                <i className="bi bi-check-square me-2"></i>Commit Changes
                {(!gitStatus?.has_uncommitted_changes && !gitStatus?.has_staged_changes && !gitStatus?.has_untracked_files) && (
                  <small className="text-muted ms-2">(no changes)</small>
                )}
              </Dropdown.Item>

              {showInMedium() && (
                <>
                  <Dropdown.Item onClick={handleCreateBranch} disabled={gitLoading}>
                    <i className="bi bi-diagram-3 me-2"></i>Create Branch
                  </Dropdown.Item>
                </>
              )}

              <Dropdown.Item onClick={handleViewGitFiles} disabled={gitLoading}>
                <i className="bi bi-folder me-2"></i>Browse Repository
              </Dropdown.Item>

              <Dropdown.Item onClick={handleViewGitHistory} disabled={gitLoading}>
                <i className="bi bi-clock-history me-2"></i>View History
              </Dropdown.Item>

              <Dropdown.Divider />
            </>
          )}

          {/* GitHub Operations */}
          {isAuthenticated && (
            <>
              <Dropdown.Header>
                <i className="bi bi-github me-2"></i>GitHub
              </Dropdown.Header>

              <Dropdown.Item onClick={handleSaveToGitHub} disabled={isDefaultDoc}>
                <i className="bi bi-cloud-arrow-up me-2"></i>Save to GitHub
              </Dropdown.Item>

              {gitStatus?.repository_type === 'github' && showInMedium() && (
                <Dropdown.Item onClick={handleGitSync} disabled={gitLoading}>
                  <i className="bi bi-cloud-arrow-up-down me-2"></i>Sync with GitHub
                </Dropdown.Item>
              )}

              <Dropdown.Divider />
            </>
          )}

          {/* Import/Export Operations */}
          {showInMedium() && (
            <>
              <Dropdown.Header>Import/Export</Dropdown.Header>
              <Dropdown.Item onClick={fileOps.handleImport}>
                <i className="bi bi-file-earmark-arrow-up me-2"></i>Import Markdown
              </Dropdown.Item>
              <Dropdown.Item onClick={fileOps.handleExportMarkdown}>
                <i className="bi bi-filetype-md me-2"></i>Export Markdown
              </Dropdown.Item>
              <Dropdown.Item
                onClick={fileOps.handleExportPDF}
                disabled={!currentDocument || !content || content.trim() === ""}
              >
                <i className="bi bi-filetype-pdf me-2"></i>Export PDF
              </Dropdown.Item>
            </>
          )}

          {/* Compact Menu: Grouped Import/Export */}
          {isCompactMenu && (
            <>
              <Dropdown.Header>Import/Export</Dropdown.Header>
              <Dropdown.Item onClick={fileOps.handleImport}>
                <i className="bi bi-file-earmark-arrow-up me-2"></i>Import
              </Dropdown.Item>
              <Dropdown.Item onClick={fileOps.handleExportMarkdown}>
                <i className="bi bi-filetype-md me-2"></i>Export MD
              </Dropdown.Item>
              <Dropdown.Item
                onClick={fileOps.handleExportPDF}
                disabled={!currentDocument || !content || content.trim() === ""}
              >
                <i className="bi bi-filetype-pdf me-2"></i>Export PDF
              </Dropdown.Item>
            </>
          )}
        </Dropdown.Menu>
      </Dropdown>
      )}

      {/* Mobile file menu offcanvas */}
      {isMobile && renderMobileFileMenu()}

      <input
        type="file"
        accept=".md"
        style={{ display: "none" }}
        ref={fileOps.fileInputRef}
        onChange={fileOps.handleFileChange}
      />

      {showFileModal && (
        <FileOpenModal
          show={showFileModal}
          onHide={() => {}} // Modal will handle its own closing via the hook
          onOpen={fileOps.handleOpenFile}
          deleteDocument={deleteDocument}
          setDocumentTitle={setDocumentTitle}
          setContent={setContent}
        />
      )}

      {fileOps.showSaveAsModal && (
        <FileSaveAsModal
          show={fileOps.showSaveAsModal}
          onHide={() => {
            fileOps.setShowSaveAsModal(false);
            fileOps.setImportedFileData(null);
          }}
          defaultName={fileOps.importedFileData ? fileOps.importedFileData.name : ""}
          onConfirm={fileOps.handleSaveAsConfirm}
          icon={<i className="bi bi-exclamation-triangle-fill text-warning me-2"></i>}
        />
      )}

      {fileOps.showImportModal && (
        <FileImportModal
          show={fileOps.showImportModal}
          onHide={() => {
            fileOps.setShowImportModal(false);
            fileOps.setImportedFileData(null);
          }}
          defaultName={fileOps.importedFileData ? fileOps.importedFileData.name : ""}
          onConfirm={fileOps.handleImportConfirm}
          icon={<i className="bi bi-file-earmark-arrow-up text-primary me-2"></i>}
        />
      )}

      {fileOps.showOverwriteModal && (
        <FileOverwriteModal
          show={fileOps.showOverwriteModal}
          title="Document Exists"
          message={
            <>
              <div className="mb-2">A document with this name and category already exists.</div>
              <div>Do you want to overwrite it?</div>
            </>
          }
          icon={<i className="bi bi-exclamation-triangle-fill text-danger me-2"></i>}
          buttons={[
            {
              key: "overwrite",
              action: "overwrite",
              text: "Overwrite",
              variant: "danger",
              autoFocus: true,
            },
            {
              key: "cancel",
              action: "cancel",
              text: "Cancel",
              variant: "secondary",
            },
          ]}
          onAction={async (actionKey) => {
            if (actionKey === "overwrite") {
              await fileOps.handleOverwriteConfirm();
            } else if (actionKey === "cancel") {
              fileOps.handleOverwriteCancel();
            }
          }}
          onHide={() => {
            fileOps.setShowOverwriteModal(false);
            fileOps.setPendingImport(null);
            if (fileOps.importedFileData) {
              fileOps.setShowImportModal(true);
            }
          }}
        />
      )}

      {/* ConfirmModal for generic confirm flows */}
      {show && modalConfig && (
        <ConfirmModal
          show={show}
          title={modalConfig.title}
          message={modalConfig.message}
          icon={modalConfig.icon}
          buttons={modalConfig.buttons}
          onAction={handleAction}
          onHide={() => handleAction("cancel")}
        />
      )}

      {/* GitHub Save Modal */}
      <GitHubSaveModal
        show={showGitHubSaveModal}
        onHide={() => setShowGitHubSaveModal(false)}
        document={currentDocument}
        onSaveSuccess={handleGitHubSaveSuccess}
      />

      {/* Git History Modal */}
      <GitHistoryModal
        show={showGitHistoryModal}
        onHide={() => setShowGitHistoryModal(false)}
        documentId={currentDocument?.id}
        repositoryType={gitStatus?.repository_type}
        currentBranch={gitStatus?.current_branch}
      />

      {/* Draft Promotion Modal */}
      <PromoteDraftModal
        show={showPromoteDraft}
        onHide={() => setShowPromoteDraft(false)}
        defaultName={currentDocument?.name || 'Untitled Document'}
        onConfirm={handlePromoteConfirm}
      />

      {/* Save As Modal */}
      <SaveAsDocumentModal
        show={showSaveAsDocModal}
        onHide={() => setShowSaveAsDocModal(false)}
        defaultName={currentDocument?.name || 'Untitled Document'}
        defaultCategory={currentDocument?.category || 'General'}
        onConfirm={handleSaveAsConfirm}
      />
    </>
  );
}

export default FileDropdown;
