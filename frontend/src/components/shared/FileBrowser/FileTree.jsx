/**
 * File Tree Component - Hierarchical navigation
 * Abstracted from GitHub file tree for universal use with existing styling
 */

import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Spinner } from 'react-bootstrap';
import { getFileIcon, getFileIconColor } from '../../../utils/fileIcons';
import { sortRepositoryItems } from '../../../utils/fileBrowserUtils';
// Import existing GitHub styles for consistency
import '../../../styles/github/index.scss';

export default forwardRef(function FileTree({
  treeData,
  currentPath,
  selectedFile,
  expandedFolders,
  onPathChange,
  onFileSelect,
  onFileOpen,
  onFolderToggle,
  loading,
  config,
  dataProvider
}, ref) {
  const [folderContents, setFolderContents] = useState(new Map());
  const [loadingFolders, setLoadingFolders] = useState(new Set());
  const treeContainerRef = useRef(null);
  const nodeRefs = useRef(new Map());

  // Reset state when provider changes
  useEffect(() => {
    if (dataProvider) {
      console.log('🔄 Provider changed, resetting FileTree state');
      setFolderContents(new Map());
      setLoadingFolders(new Set());
      nodeRefs.current.clear();

      // Load root contents for new provider
      loadFolderContents('/');
    }
  }, [dataProvider]);

  // Load contents for current path when it changes
  useEffect(() => {
    if (dataProvider && currentPath && currentPath !== '/') {
      console.log('📍 Current path changed to:', currentPath);

      // Always load the current path contents when path changes
      if (!folderContents.has(currentPath) && !loadingFolders.has(currentPath)) {
        console.log('� Loading contents for new current path:', currentPath);
        loadFolderContents(currentPath);
      }

      // Also ensure all parent paths are loaded for proper tree display
      const pathParts = currentPath.split('/').filter(p => p);
      let buildPath = '';
      pathParts.forEach((part, index) => {
        if (index < pathParts.length - 1) { // Don't duplicate the final path
          buildPath += '/' + part;
          if (!folderContents.has(buildPath) && !loadingFolders.has(buildPath)) {
            console.log('📁 Loading parent path:', buildPath);
            loadFolderContents(buildPath);
          }
        }
      });
    }
  }, [currentPath, dataProvider]);

  // Load folder contents when folders are expanded
  useEffect(() => {
    // Load contents for newly expanded folders
    expandedFolders.forEach(folderPath => {
      if (folderPath !== '/' && !folderContents.has(folderPath) && !loadingFolders.has(folderPath)) {
        console.log('📂 Loading expanded folder:', folderPath);
        loadFolderContents(folderPath);
      }
    });
  }, [expandedFolders]);

  // Handle tree data changes (when provider loads initial data)
  useEffect(() => {
    if (treeData.length > 0) {
      console.log('🌳 Tree data loaded:', treeData.length, 'root items');

      // If we have a current path that's not root, make sure it's loaded
      if (currentPath && currentPath !== '/' && !folderContents.has(currentPath)) {
        console.log('📍 Loading current path after tree data loaded:', currentPath);
        loadFolderContents(currentPath);
      }
    }
  }, [treeData, currentPath]);

  // Scroll to a specific folder in the tree
  const scrollToFolder = (folderPath) => {
    const nodeElement = nodeRefs.current.get(folderPath);
    if (nodeElement && treeContainerRef.current) {
      nodeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
    }
  };

  // Expose scrollToFolder function to parent components
  useImperativeHandle(ref, () => ({
    scrollToFolder
  }));

  // Load folder contents when expanded
  const loadFolderContents = React.useCallback(async (folderPath) => {
    if (folderContents.has(folderPath) || loadingFolders.has(folderPath)) {
      console.log(`⏭️ Skipping ${folderPath} - already loaded or loading`);
      return;
    }

    console.log(`📂 Loading folder contents for: ${folderPath}`);
    setLoadingFolders(prev => new Set(prev).add(folderPath));

    try {
      const contents = await dataProvider.getFilesInPath(folderPath);
      console.log(`✅ Loaded ${contents.length} items for ${folderPath}:`, contents.map(c => c.name));

      // Only update if we actually got contents - prevent erasing existing data
      if (contents.length > 0 || !folderContents.has(folderPath)) {
        setFolderContents(prev => new Map(prev).set(folderPath, contents));
      } else {
        console.log(`⚠️ Empty contents for ${folderPath} - keeping existing data`);
      }
    } catch (error) {
      console.error(`❌ Failed to load folder contents for ${folderPath}:`, error);
    } finally {
      setLoadingFolders(prev => {
        const newSet = new Set(prev);
        newSet.delete(folderPath);
        return newSet;
      });
    }
  }, [dataProvider, folderContents, loadingFolders]);

  const handleFolderToggle = async (folder, event) => {
    event?.stopPropagation();

    const isExpanded = expandedFolders.has(folder.path);

    if (!isExpanded) {
      await loadFolderContents(folder.path);
    }

    onFolderToggle(folder.path, !isExpanded);
  };

  const handleItemClick = (item) => {
    onFileSelect(item);

    if (item.type === 'folder' || item.type === 'dir') {
      onPathChange(item.path);
      handleFolderToggle(item);
      // Scroll to the folder after a short delay to allow expansion
      setTimeout(() => scrollToFolder(item.path), 100);
    }
  };

  const buildTreeWithContents = (nodes, depth = 0) => {
    // If no tree data but we have root contents, use root contents
    const nodesToProcess = nodes.length > 0 ? nodes : (folderContents.get('/') || []);

    return nodesToProcess.map(node => {
      const isExpanded = expandedFolders.has(node.path);
      const isFolder = node.type === 'folder' || node.type === 'dir';
      const isCurrentPath = node.path === currentPath;

      // Get children from folderContents if expanded, otherwise preserve existing children
      let children = [];
      if (isFolder && isExpanded) {
        // Use loaded contents if available
        if (folderContents.has(node.path)) {
          children = folderContents.get(node.path) || [];
          console.log(`🔍 Using loaded contents for ${node.path}:`, children.length, 'items');
        } else {
          // Preserve existing children until new contents are loaded
          children = node.children || [];
          console.log(`⏳ Using existing children for ${node.path}:`, children.length, 'items');
        }
      }

      return {
        ...node,
        children: children.length > 0 ? buildTreeWithContents(children, depth + 1) : [],
        isExpanded,
        isCurrentPath, // Add flag for styling/debugging
        depth
      };
    });
  };

  const renderTreeNode = (node) => {
    const isFolder = node.type === 'folder' || node.type === 'dir';
    const isSelected = selectedFile && selectedFile.path === node.path;
    const isLoading = loadingFolders.has(node.path || '');
    const paddingLeft = node.depth * 20 + 12;

    // Create a truly unique key by combining all available identifiers
    const uniqueKey = `${node.id || 'no-id'}-${node.path || 'no-path'}-${node.name || 'no-name'}-${node.depth || 0}-${node.type || 'unknown'}-${node.source || 'no-source'}-${node.parentPath || 'no-parent'}-${node.index || 0}`;

    return (
      <div key={uniqueKey}>
        <div
          ref={(el) => {
            if (el && node.path) {
              nodeRefs.current.set(node.path, el);
            }
          }}
          className={`tree-item ${isSelected ? 'selected' : ''}`}
          style={{ paddingLeft: `${paddingLeft}px` }}
          onClick={() => handleItemClick(node)}
        >
          <div className="tree-item-content">
            {isFolder && (
              <i
                className={`tree-chevron bi bi-chevron-${node.isExpanded ? 'down' : 'right'}`}
                onClick={(e) => handleFolderToggle(node, e)}
              />
            )}
            {!isFolder && <span className="tree-spacer"></span>}

            <i className={`tree-icon bi bi-${getFileIcon(node, node.isExpanded)} ${
              getFileIconColor(node, node.isExpanded, isSelected)
            }`}></i>

            <span className="tree-label">{node.name}</span>

            {/* Storage location indicator for documents */}
            {!isFolder && node.documentId && (
              <span className="storage-indicator ms-auto d-flex align-items-center">
                {String(node.documentId).startsWith('doc_') ? (
                  <i
                    className="bi bi-exclamation-triangle text-warning"
                    title="Browser storage only - Save to backend to prevent data loss"
                    style={{ fontSize: '0.8em' }}
                  />
                ) : (
                  <i
                    className="bi bi-cloud-check text-success"
                    title="Saved to server"
                    style={{ fontSize: '0.8em' }}
                  />
                )}
              </span>
            )}

            {isLoading && <Spinner animation="border" size="sm" className="ms-auto" />}
          </div>
        </div>

        {isFolder && node.isExpanded && node.children.length > 0 && (
          <div className="tree-children">
            {sortRepositoryItems(node.children).map((child, index) => renderTreeNode({
              ...child,
              // Ensure unique key by adding parent context
              parentPath: node.path,
              index: index
            }))}
          </div>
        )}
      </div>
    );
  };

  const treeWithContents = buildTreeWithContents(treeData);

  return (
    <div className="file-browser-tree d-flex flex-column">
      <div className="tree-header p-2 border-bottom">
        <small className="text-muted">
          <i className="bi bi-folder me-1"></i>
          Files and folders
        </small>
      </div>

      <div
        ref={treeContainerRef}
        className="tree-content flex-grow-1 overflow-auto"
      >
        {loading ? (
          <div className="d-flex justify-content-center align-items-center p-4">
            <Spinner animation="border" size="sm" role="status">
              <span className="visually-hidden">Loading...</span>
            </Spinner>
          </div>
        ) : (
          sortRepositoryItems(treeWithContents).map((node, index) => renderTreeNode({
            ...node,
            index: index
          }))
        )}
      </div>
    </div>
  );
});