/**
 * File Tree Component - Hierarchical navigation
 * Abstracted from GitHub file tree for universal use with existing styling
 */

import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Spinner } from 'react-bootstrap';
import { getFileIcon, getFileIconColor } from '../../../utils/fileIcons';
import { sortRepositoryItems } from '../../../utils/fileBrowserUtils';
// Import existing GitHub styles for consistency
import '../../../styles/_github.scss';

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

  // Auto-load root contents when tree mounts
  useEffect(() => {
    if (dataProvider && treeData.length === 0) {
      loadFolderContents('/');
    }
  }, [dataProvider, treeData]);

  // Load folder contents when folders are expanded
  useEffect(() => {
    // Load contents for newly expanded folders
    expandedFolders.forEach(folderPath => {
      if (folderPath !== '/' && !folderContents.has(folderPath) && !loadingFolders.has(folderPath)) {
        loadFolderContents(folderPath);
      }
    });
  }, [expandedFolders]);

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
  const loadFolderContents = async (folderPath) => {
    if (folderContents.has(folderPath) || loadingFolders.has(folderPath)) {
      return;
    }

    setLoadingFolders(prev => new Set(prev).add(folderPath));

    try {
      const contents = await dataProvider.getFilesInPath(folderPath);
      setFolderContents(prev => new Map(prev).set(folderPath, contents));
    } catch (error) {
      console.error('Failed to load folder contents:', error);
    } finally {
      setLoadingFolders(prev => {
        const newSet = new Set(prev);
        newSet.delete(folderPath);
        return newSet;
      });
    }
  };

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
      const children = isExpanded && (node.type === 'folder' || node.type === 'dir') && folderContents.has(node.path)
        ? folderContents.get(node.path) || []
        : node.children || [];

      return {
        ...node,
        children: children.length > 0 ? buildTreeWithContents(children, depth + 1) : [],
        isExpanded,
        depth
      };
    });
  };

  const renderTreeNode = (node) => {
    const isFolder = node.type === 'folder' || node.type === 'dir';
    const isSelected = selectedFile && selectedFile.path === node.path;
    const isLoading = loadingFolders.has(node.path || '');
    const paddingLeft = node.depth * 20 + 12;

    return (
      <div key={node.id || node.path}>
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

            {isLoading && <Spinner animation="border" size="sm" className="ms-auto" />}
          </div>
        </div>

        {isFolder && node.isExpanded && node.children.length > 0 && (
          <div className="tree-children">
            {sortRepositoryItems(node.children).map(child => renderTreeNode(child))}
          </div>
        )}
      </div>
    );
  };

  const treeWithContents = buildTreeWithContents(treeData);

  return (
    <div className="file-browser-tree">
      <div className="tree-header p-2 border-bottom">
        <small className="text-muted">
          <i className="bi bi-folder me-1"></i>
          Files and folders
        </small>
      </div>
      
      <div 
        ref={treeContainerRef}
        className="tree-content"
      >
        {loading ? (
          <div className="d-flex justify-content-center align-items-center p-4">
            <Spinner animation="border" size="sm" role="status">
              <span className="visually-hidden">Loading...</span>
            </Spinner>
          </div>
        ) : (
          sortRepositoryItems(treeWithContents).map(node => renderTreeNode(node))
        )}
      </div>
    </div>
  );
});