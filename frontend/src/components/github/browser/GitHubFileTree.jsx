import React, { useState, useEffect, useMemo } from 'react';
import { Spinner, Card, Row, Col } from 'react-bootstrap';
import { useTheme } from '../../../providers/ThemeProvider';
import gitHubApi from '../../../api/gitHubApi';
import { getFileIcon, getFileIconColor } from '../../../utils/fileIcons';
import { sortRepositoryItems, getEmptyState } from '../../../utils/githubUtils';

export default function GitHubFileTree({
  fileTree = [],
  selectedFile,
  onFileSelect,
  loading,
  repository,
  branch
}) {
  const { theme } = useTheme();
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [folderContents, setFolderContents] = useState(new Map());
  const [loadingFolders, setLoadingFolders] = useState(new Set());

  // Reset tree state when repository or branch changes
  useEffect(() => {
    setExpandedFolders(new Set());
    setFolderContents(new Map());
    setLoadingFolders(new Set());
  }, [repository?.id, branch]);

  // Auto-collapse folders when navigating to unrelated directories or root
  useEffect(() => {
    const currentlyExpanded = Array.from(expandedFolders);

    // If no file is selected (navigated to root), collapse all folders
    if (!selectedFile) {
      if (currentlyExpanded.length > 0) {
        setExpandedFolders(new Set());
      }
      return;
    }

    // Only process directory selections
    if (selectedFile.type !== 'dir') return;

    const selectedPath = selectedFile.path || '';

    // Find folders that should be collapsed (not in the current selection hierarchy)
    const foldersToCollapse = currentlyExpanded.filter(expandedPath => {
      // Keep expanded if this folder is the selected item
      if (expandedPath === selectedPath) return false;

      // Keep expanded if this folder is a parent of the selected item
      if (selectedPath.startsWith(expandedPath + '/')) return false;

      // Keep expanded if the selected item is a parent of this folder
      if (expandedPath.startsWith(selectedPath + '/')) return false;

      // Collapse this folder as it's not in the selected hierarchy
      return true;
    });

    if (foldersToCollapse.length > 0) {
      setExpandedFolders(prev => {
        const newSet = new Set(prev);
        foldersToCollapse.forEach(path => newSet.delete(path));
        return newSet;
      });
    }
  }, [selectedFile]);

  // Build complete tree structure with cached folder contents
  const buildTreeStructure = useMemo(() => {
    if (!fileTree || fileTree.length === 0) return [];

    const buildNode = (item, depth = 0) => {
      const isExpanded = expandedFolders.has(item.path || '');
      const children = isExpanded && item.type === 'dir' && folderContents.has(item.path || '')
        ? folderContents.get(item.path || '') || []
        : [];

      return {
        ...item,
        children: children.map(child => buildNode(child, depth + 1)),
        isExpanded,
        depth
      };
    };

    return fileTree.map(item => buildNode(item));
  }, [fileTree, expandedFolders, folderContents]);

  const toggleFolderExpansion = async (folder, event) => {
    // Stop event from bubbling to avoid triggering folder selection
    event.stopPropagation();

    const folderPath = folder.path || '';

    if (expandedFolders.has(folderPath)) {
      // Collapse folder
      setExpandedFolders(prev => {
        const newSet = new Set(prev);
        newSet.delete(folderPath);
        return newSet;
      });
    } else {
      // Expand folder - first update UI optimistically
      setExpandedFolders(prev => new Set(prev).add(folderPath));

      // Load contents if not already cached and not currently loading
      if (!folderContents.has(folderPath) && !loadingFolders.has(folderPath)) {
        setLoadingFolders(prev => new Set(prev).add(folderPath));

        try {
          const contents = await gitHubApi.getRepositoryContents(
            repository.id,
            folderPath,
            branch
          );

          // Cache the contents
          setFolderContents(prev => new Map(prev).set(folderPath, contents));
          // Force scroll recalculation after chevron expansion
          // setTimeout(() => forceScrollRecalculation(), 100);
        } catch (error) {
          console.error('Error loading folder contents:', error);
          // On error, collapse the folder
          setExpandedFolders(prev => {
            const newSet = new Set(prev);
            newSet.delete(folderPath);
            return newSet;
          });
        } finally {
          setLoadingFolders(prev => {
            const newSet = new Set(prev);
            newSet.delete(folderPath);
            return newSet;
          });
        }
      }
    }
  };

  const toggleFolder = async (folder) => {
    const folderPath = folder.path || '';

    if (expandedFolders.has(folderPath)) {
      // Collapse folder
      setExpandedFolders(prev => {
        const newSet = new Set(prev);
        newSet.delete(folderPath);
        return newSet;
      });
    } else {
      // Expand folder - first update UI optimistically
      setExpandedFolders(prev => new Set(prev).add(folderPath));

      // Load contents if not already cached and not currently loading
      if (!folderContents.has(folderPath) && !loadingFolders.has(folderPath)) {
        setLoadingFolders(prev => new Set(prev).add(folderPath));

        try {
          const contents = await gitHubApi.getRepositoryContents(
            repository.id,
            folderPath,
            branch
          );

          // Cache the contents
          setFolderContents(prev => new Map(prev).set(folderPath, contents));
          // Force scroll recalculation after folder click expansion
          // setTimeout(() => forceScrollRecalculation(), 100);
        } catch (error) {
          console.error('Error loading folder contents:', error);
          // On error, collapse the folder
          setExpandedFolders(prev => {
            const newSet = new Set(prev);
            newSet.delete(folderPath);
            return newSet;
          });
        } finally {
          setLoadingFolders(prev => {
            const newSet = new Set(prev);
            newSet.delete(folderPath);
            return newSet;
          });
        }
      }
    }
  };

  const handleItemClick = (item) => {
    // Always notify parent about the selection
    onFileSelect(item);

    // For directories, also expand them when the folder itself is clicked
    if (item.type === 'dir') {
      toggleFolder(item);
    }
  };

  const renderTreeNode = (node) => {
    const isFolder = node.type === 'dir';
    const isSelected = selectedFile && selectedFile.path === node.path;
    const isLoading = loadingFolders.has(node.path || '');
    const paddingLeft = node.depth * 20 + 12;

    return (
      <div key={node.path || node.name}>
        <div
          className={`tree-item ${isSelected ? 'selected' : ''}`}
          style={{ paddingLeft: `${paddingLeft}px` }}
          onClick={() => handleItemClick(node)}
        >
          <div className="tree-item-content">
            {isFolder && (
              <i
                className={`tree-chevron bi bi-chevron-${node.isExpanded ? 'down' : 'right'}`}
                onClick={(e) => toggleFolderExpansion(node, e)}
                style={{ cursor: 'pointer' }}
              ></i>
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

  if (loading && fileTree.length === 0) {
    return (
      <div className="d-flex justify-content-center align-items-center h-100">
        <Spinner animation="border" role="status" variant={theme === 'dark' ? 'light' : 'primary'}>
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    );
  }

  return (
    <div className={`github-file-tree ${theme}`}>
      {/* Header */}
      <div className="tree-header p-2 border-bottom">
        <small className="text-muted">
          <i className="bi bi-folder me-1"></i>
          Files and folders
        </small>
      </div>

      {/* Tree */}
      <div className="tree-content overflow-auto" style={{ maxHeight: '400px' }}>
        {sortRepositoryItems(buildTreeStructure).map(node => renderTreeNode(node))}

        {fileTree.length === 0 && !loading && (
          <div className="text-center text-muted p-4">
            <i className={`${getEmptyState('tree').icon} display-6 d-block mb-2 opacity-50`}></i>
            <small>{getEmptyState('tree').message}</small>
          </div>
        )}
      </div>
    </div>
  );
}
