import React, { forwardRef, useImperativeHandle } from 'react';
import FileTree from './FileTree';
import FileList from './FileList';
import FilePreview from './FilePreview';
import FileBrowserActions from './FileBrowserActions';
import BreadcrumbBar from './BreadcrumbBar';
import { useUnifiedFileBrowser } from '@/hooks/fileBrowser/useUnifiedFileBrowser';

const UnifiedFileBrowser = forwardRef(({
  dataProvider,
  config = {},
  onFileSelect,
  onFileOpen,
  onMultiSelect,
  onPathChange, // Callback when path changes
  selectedFiles = [],
  initialPath = '/',
  initialSelectedFile = null,
  breadcrumbType = 'github', // 'github' or 'local'
  breadcrumbData = {}, // Additional data for breadcrumb (repository, categories, documents)
  className = '',
  style = {}
}, ref) => {
  const {
    currentPath,
    treeData,
    currentFiles,
    selectedFile,
    loading,
    expandedFolders,
    fileTreeRef,
    finalConfig,
    handlePathChange,
    handleFileSelect,
    handleFileOpen,
    handleFolderExpand,
    handleFolderToggle,
    handleMultiSelect
  } = useUnifiedFileBrowser({
    dataProvider,
    config,
    initialPath,
    initialSelectedFile,
    onFileSelect,
    onFileOpen,
    onMultiSelect,
    onPathChange,
    selectedFiles
  });

  // Expose handlePathChange via ref
  useImperativeHandle(ref, () => ({
    handlePathChange
  }), [handlePathChange]);

  return (
    <div
      className={`unified-file-browser ${loading ? 'loading' : ''} ${finalConfig.allowMultiSelect ? 'file-browser-multi-select' : ''} ${className}`}
      style={style}
    >
        {/* Full-width Breadcrumb Bar */}
        {finalConfig.showBreadcrumb && (
          <div className="breadcrumb-section">
            <BreadcrumbBar
              currentPath={currentPath}
              onPathChange={handlePathChange}
              breadcrumbType={breadcrumbType}
              repository={breadcrumbData.repository}
              categories={breadcrumbData.categories}
              documents={breadcrumbData.documents}
              currentFiles={currentFiles}
            />
          </div>
        )}

      <div className="file-browser-content">
        {/* Tree Navigation */}
        <div className="file-browser-tree-panel">
          <FileTree
            ref={fileTreeRef}
            treeData={treeData}
            currentPath={currentPath}
            selectedFile={selectedFile}
            expandedFolders={expandedFolders}
            onPathChange={handlePathChange}
            onFileSelect={handleFileSelect}
            onFileOpen={handleFileOpen}
            onFolderToggle={handleFolderToggle}
            loading={loading}
            config={finalConfig}
            dataProvider={dataProvider}
          />
        </div>

        {/* File List */}
        <div className="file-browser-list-panel">
          <FileList
            files={currentFiles}
            currentPath={currentPath}
            selectedFile={selectedFile}
            selectedFiles={selectedFiles}
            onFileSelect={handleFileSelect}
            onFileOpen={handleFileOpen}
            onPathChange={handlePathChange}
            onFolderExpand={handleFolderExpand}
            onMultiSelect={handleMultiSelect}
            config={finalConfig}
          />
        </div>

        {/* Preview Pane */}
        {finalConfig.showPreview && (
          <div className="file-browser-preview-panel">
            <FilePreview
              file={selectedFile}
              dataProvider={dataProvider}
              config={finalConfig}
            />
          </div>
        )}

        {/* Bottom Gradient */}
        <div className="bottom-gradient"></div>
      </div>

      {finalConfig.showActions && (
        <div className="file-browser-actions-section">
          <FileBrowserActions
            selectedFile={selectedFile}
            selectedFiles={selectedFiles}
            onFileOpen={handleFileOpen}
            onMultiSelect={handleMultiSelect}
            config={finalConfig}
          />
        </div>
      )}
    </div>
  );
});

UnifiedFileBrowser.displayName = 'UnifiedFileBrowser';

export default UnifiedFileBrowser;
