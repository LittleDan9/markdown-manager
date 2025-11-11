import { useState, useEffect, useRef, useCallback } from 'react';

export function useUnifiedFileBrowser({
  dataProvider,
  config = {},
  initialPath = '/',
  initialSelectedFile = null,
  onFileSelect,
  onFileOpen,
  onMultiSelect,
  onPathChange,
  selectedFiles: _selectedFiles = []
}) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [treeData, setTreeData] = useState([]);
  const [currentFiles, setCurrentFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(initialSelectedFile);
  const [loading, setLoading] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState(new Set(['/']));
  const fileTreeRef = useRef(null);

  // Default configuration
  const defaultConfig = {
    allowMultiSelect: false,
    showPreview: true,
    showActions: true,
    showBreadcrumb: true,
    showTreeBreadcrumb: false,
    defaultView: 'tree',
    filters: {}
  };

  const finalConfig = { ...defaultConfig, ...config };

  const loadTreeData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await dataProvider.getTreeStructure();
      setTreeData(data);
    } catch (error) {
      console.error('Failed to load tree data:', error);
    } finally {
      setLoading(false);
    }
  }, [dataProvider]);

  const loadCurrentPathFiles = useCallback(async () => {
    try {
      // Ensure we always pass a valid path, defaulting to root '/' if empty
      const pathToLoad = currentPath || '/';
      const files = await dataProvider.getFilesInPath(pathToLoad);
      setCurrentFiles(files || []);
    } catch (error) {
      console.error('Failed to load files:', error);
      setCurrentFiles([]); // Set empty array on error
    }
  }, [currentPath, dataProvider]);

  // Reset state and load tree data when provider changes
  useEffect(() => {
    if (dataProvider) {
      // Reset state when provider changes
      // setCurrentPath(initialPath); // Remove this to maintain current path when provider changes
      // Only reset selectedFile if we don't have an initialSelectedFile
      if (!initialSelectedFile) {
        setSelectedFile(null);
      }
      setTreeData([]);
      setCurrentFiles([]);

      // Properly expand folder hierarchy for the initial path
      const newExpanded = new Set(['/']);
      if (initialPath && initialPath !== '/') {
        // Add root path
        newExpanded.add('/');

        // Add all parent paths step by step
        const pathParts = initialPath.split('/').filter(p => p);
        let buildPath = '';
        pathParts.forEach(part => {
          buildPath += '/' + part;
          newExpanded.add(buildPath);
        });

        // Also add the current path itself (target folder)
        newExpanded.add(initialPath);
      }
      setExpandedFolders(newExpanded);

      loadTreeData();
      // Load files for the initial path
      loadCurrentPathFiles();
    }
  }, [dataProvider, initialPath, initialSelectedFile]); // Removed loadCurrentPathFiles and loadTreeData from dependencies

  // Sync currentPath with initialPath when initialPath changes
  useEffect(() => {
    if (initialPath !== currentPath) {
      setCurrentPath(initialPath);
    }
  }, [initialPath]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load files for current path
  useEffect(() => {
    if (dataProvider && (currentPath !== null && currentPath !== undefined)) {
      loadCurrentPathFiles();
    }
  }, [currentPath, dataProvider, loadCurrentPathFiles]);

  const handlePathChange = (newPath) => {
    console.log('UnifiedFileBrowser handlePathChange called with:', newPath);
    setCurrentPath(newPath);
    setSelectedFile(null);

    // Call parent's onPathChange callback
    if (onPathChange) {
      onPathChange(newPath);
    }

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

    // Don't update current path here - navigation is handled by onPathChange in handleItemClick
    // This prevents duplicate path setting that causes tree refreshes
  };

  const handleMultiSelect = (files) => {
    if (finalConfig.allowMultiSelect && onMultiSelect) {
      onMultiSelect(files);
    }
  };

  return {
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
  };
}