import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import FileTree from './FileTree';
import FileList from './FileList';
import FilePreview from './FilePreview';
import FileBrowserActions from './FileBrowserActions';
import BreadcrumbBar from './BreadcrumbBar';

export default function UnifiedFileBrowser({
  dataProvider,
  config = {},
  onFileSelect,
  onFileOpen,
  onMultiSelect,
  selectedFiles = [],
  initialPath = '/',
  breadcrumbType = 'github', // 'github' or 'local'
  breadcrumbData = {}, // Additional data for breadcrumb (repository, categories, documents)
  className = '',
  style = {}
}) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [treeData, setTreeData] = useState([]);
  const [currentFiles, setCurrentFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState(new Set(['/']));
  const fileTreeRef = useRef(null);

  // Default configuration
  const defaultConfig = {
    allowMultiSelect: false,
    showPreview: true,
    showActions: true,
    showBreadcrumb: true,
    showTreeBreadcrumb: false, // Disable internal FileList breadcrumb by default
    defaultView: 'tree',
    filters: {}
  };

  const finalConfig = { ...defaultConfig, ...config };

  // Load tree data on mount or provider change
  useEffect(() => {
    if (dataProvider) {
      loadTreeData();
      // Ensure root files are loaded when the component mounts
      if (!currentPath || currentPath === '/') {
        loadCurrentPathFiles();
      }
    }
  }, [dataProvider]);

  // Load files for current path
  useEffect(() => {
    if (dataProvider && (currentPath !== null && currentPath !== undefined)) {
      loadCurrentPathFiles();
    }
  }, [currentPath, dataProvider]);

  const loadTreeData = async () => {
    setLoading(true);
    try {
      const data = await dataProvider.getTreeStructure();
      setTreeData(data);
    } catch (error) {
      console.error('Failed to load tree data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentPathFiles = async () => {
    try {
      // Ensure we always pass a valid path, defaulting to root '/' if empty
      const pathToLoad = currentPath || '/';
      const files = await dataProvider.getFilesInPath(pathToLoad);
      setCurrentFiles(files);
    } catch (error) {
      console.error('Failed to load files:', error);
      setCurrentFiles([]);
    }
  };

  const handlePathChange = (newPath) => {
    console.log('UnifiedFileBrowser handlePathChange called with:', newPath);
    setCurrentPath(newPath);
    setSelectedFile(null);

    // Ensure the corresponding folder and all its parents are expanded in the tree
    if (newPath && newPath !== '/') {
      const newExpanded = new Set(expandedFolders);

      // Add root path
      newExpanded.add('/');

      // Add all parent paths step by step
      const pathParts = newPath.split('/').filter(p => p);
      let buildPath = '';
      pathParts.forEach(part => {
        buildPath += '/' + part;
        newExpanded.add(buildPath);
      });

      // Also add the current path itself (target folder)
      newExpanded.add(newPath);

      setExpandedFolders(newExpanded);
    }

    // Scroll to the navigated folder after a short delay
    setTimeout(() => {
      if (fileTreeRef.current && fileTreeRef.current.scrollToFolder) {
        fileTreeRef.current.scrollToFolder(newPath);
      }
    }, 150);
  };

  const handleFileSelect = (file) => {
    setSelectedFile(file);

    // If a file is selected (not a folder), navigate to its parent directory
    if (file && file.type === 'file') {
      const filePath = file.path;
      if (filePath) {
        // Get the parent directory path
        const pathParts = filePath.split('/');
        pathParts.pop(); // Remove the filename
        const parentPath = pathParts.join('/') || '/';

        // Only navigate if we're not already in the parent directory
        if (parentPath !== currentPath) {
          setCurrentPath(parentPath);
        }
      }
    }

    if (onFileSelect) {
      onFileSelect(file);
    }
  };

  const handleFileOpen = (file) => {
    if (onFileOpen) {
      onFileOpen(file);
    }
  };

  const handleFolderExpand = (folderPath) => {
    // Expand the folder in the tree without navigating to it
    setExpandedFolders(prev => {
      const newSet = new Set(prev);

      // Add the folder itself
      newSet.add(folderPath);

      // Also ensure all parent folders are expanded
      const pathParts = folderPath.split('/').filter(p => p);
      let currentPath = '';
      pathParts.forEach(part => {
        currentPath += '/' + part;
        newSet.add(currentPath);
      });

      // Make sure root is expanded
      newSet.add('/');

      return newSet;
    });

    // Scroll to the expanded folder after a short delay
    setTimeout(() => {
      if (fileTreeRef.current && fileTreeRef.current.scrollToFolder) {
        fileTreeRef.current.scrollToFolder(folderPath);
      }
    }, 150);
  };

  const handleFolderToggle = (folderPath, isExpanded) => {
    const newExpanded = new Set(expandedFolders);
    if (isExpanded) {
      newExpanded.add(folderPath);
    } else {
      newExpanded.delete(folderPath);
    }
    setExpandedFolders(newExpanded);

    // Also update current path when expanding folders
    if (isExpanded) {
      setCurrentPath(folderPath);
    }
  };

  const handleMultiSelect = (files) => {
    if (finalConfig.allowMultiSelect && onMultiSelect) {
      onMultiSelect(files);
    }
  };

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
}
