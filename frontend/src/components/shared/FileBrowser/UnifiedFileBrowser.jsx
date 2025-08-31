import React, { useState, useEffect } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import FileTree from './FileTree';
import FileList from './FileList';
import FilePreview from './FilePreview';
import FileBrowserHeader from './FileBrowserHeader';
import FileBrowserActions from './FileBrowserActions';

export default function UnifiedFileBrowser({
  dataProvider,
  config = {},
  onFileSelect,
  onFileOpen,
  onMultiSelect,
  selectedFiles = [],
  initialPath = '/'
}) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [treeData, setTreeData] = useState([]);
  const [currentFiles, setCurrentFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState(new Set(['/']));

  // Default configuration
  const defaultConfig = {
    allowMultiSelect: false,
    showPreview: true,
    showActions: true,
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
    setCurrentPath(newPath);
    setSelectedFile(null);
    
    // Ensure the corresponding folder is expanded in the tree
    if (newPath && newPath !== '/') {
      setExpandedFolders(prev => new Set(prev).add(newPath));
    }
  };

  const handleFileSelect = (file) => {
    setSelectedFile(file);
    if (onFileSelect) {
      onFileSelect(file);
    }
  };

  const handleFileOpen = (file) => {
    if (onFileOpen) {
      onFileOpen(file);
    }
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
    <div className={`unified-file-browser ${loading ? 'loading' : ''} ${finalConfig.allowMultiSelect ? 'file-browser-multi-select' : ''}`}>
        {finalConfig.showActions && (
          <FileBrowserHeader
            currentPath={currentPath}
            onPathChange={handlePathChange}
            selectedFiles={selectedFiles}
            config={finalConfig}
          />
        )}
      
      <div className="d-flex flex-grow-1 overflow-hidden">
        {/* Tree Navigation */}
        <div className="flex-shrink-0" style={{ width: '300px' }}>
          <FileTree
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
        <div className="flex-grow-1 border-start">
          <FileList
            files={currentFiles}
            currentPath={currentPath}
            selectedFile={selectedFile}
            selectedFiles={selectedFiles}
            onFileSelect={handleFileSelect}
            onFileOpen={handleFileOpen}
            onPathChange={handlePathChange}
            onMultiSelect={handleMultiSelect}
            config={finalConfig}
          />
        </div>

        {/* Preview Pane */}
        {finalConfig.showPreview && (
          <div className="flex-shrink-0 border-start" style={{ width: '350px' }}>
            <FilePreview
              file={selectedFile}
              dataProvider={dataProvider}
              config={finalConfig}
            />
          </div>
        )}
      </div>

      {finalConfig.showActions && (
        <FileBrowserActions
          selectedFile={selectedFile}
          selectedFiles={selectedFiles}
          onFileOpen={handleFileOpen}
          onMultiSelect={handleMultiSelect}
          config={finalConfig}
        />
      )}
    </div>
  );
}
