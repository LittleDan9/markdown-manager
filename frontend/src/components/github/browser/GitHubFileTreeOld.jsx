import React, { useState } from 'react';
import { Card, Spinner, Alert } from 'react-bootstrap';
import gitHubApi from '../../../api/gitHubApi';

export default function GitHubFileTree({ 
  fileTree, 
  selectedFile, 
  onFileSelect, 
  loading, 
  repository, 
  branch 
}) {
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [folderContents, setFolderContents] = useState({});
  const [loadingPaths, setLoadingPaths] = useState(new Set());

  const toggleFolder = async (folder) => {
    const newExpanded = new Set(expandedFolders);
    
    if (expandedFolders.has(folder.path)) {
      // Collapse folder
      newExpanded.delete(folder.path);
      setExpandedFolders(newExpanded);
    } else {
      // Expand folder - load contents if not already loaded
      newExpanded.add(folder.path);
      setExpandedFolders(newExpanded);
      
      if (!folderContents[folder.path]) {
        const newLoadingPaths = new Set(loadingPaths);
        newLoadingPaths.add(folder.path);
        setLoadingPaths(newLoadingPaths);
        
        try {
          const contents = await gitHubApi.getRepositoryContents(
            repository.id,
            folder.path,
            branch
          );
          
          // Ensure contents is an array and filter out any invalid items
          const validContents = Array.isArray(contents) ? contents.filter(item => 
            item && item.path && item.name && item.type
          ) : [];
          
          setFolderContents(prev => ({
            ...prev,
            [folder.path]: validContents
          }));
        } catch (err) {
          console.error('Failed to load folder contents:', err);
          // Revert expansion on error
          const revertExpanded = new Set(expandedFolders);
          revertExpanded.delete(folder.path);
          setExpandedFolders(revertExpanded);
        } finally {
          setLoadingPaths(prev => {
            const newSet = new Set(prev);
            newSet.delete(folder.path);
            return newSet;
          });
        }
      }
    }
  };

  const isMarkdownFile = (filename) => {
    return /\.(md|markdown)$/i.test(filename);
  };

  const getFileIcon = (item) => {
    if (item.type === 'dir') {
      return expandedFolders.has(item.path) ? 'bi-folder-open' : 'bi-folder';
    }
    
    if (isMarkdownFile(item.name)) {
      return 'bi-file-earmark-text';
    }
    
    return 'bi-file-earmark';
  };

  const getFileClass = (item) => {
    const baseClass = 'file-tree-item p-2 border-bottom';
    const isSelected = selectedFile && selectedFile.path === item.path;
    const isClickable = item.type === 'dir' || isMarkdownFile(item.name);
    
    let classes = [baseClass];
    
    if (isSelected) classes.push('bg-primary text-white');
    else if (isClickable) classes.push('file-tree-clickable');
    
    if (!isMarkdownFile(item.name) && item.type === 'file') classes.push('text-muted');
    
    return classes.join(' ');
  };

  const handleItemClick = (item) => {
    if (item.type === 'dir') {
      toggleFolder(item);
    } else if (isMarkdownFile(item.name)) {
      onFileSelect(item);
    }
  };

  const renderFileTree = (items, depth = 0) => {
    // Safety check to prevent infinite recursion
    if (depth > 10) {
      console.warn('File tree depth limit reached, stopping recursion');
      return null;
    }
    
    if (!items || !Array.isArray(items)) {
      return null;
    }

    return items.map(item => {
      // Safety check for item structure
      if (!item || !item.path || !item.name) {
        console.warn('Invalid item in file tree:', item);
        return null;
      }

      return (
        <div key={item.path}>
          <div
            className={getFileClass(item)}
            style={{ 
              paddingLeft: `${(depth * 20) + 12}px`,
              cursor: (item.type === 'dir' || isMarkdownFile(item.name)) ? 'pointer' : 'default'
            }}
            onClick={() => handleItemClick(item)}
          >
            <div className="d-flex align-items-center">
              {item.type === 'dir' && loadingPaths.has(item.path) ? (
                <Spinner size="sm" className="me-2" />
              ) : (
                <i className={`bi ${getFileIcon(item)} me-2`}></i>
              )}
              <span className="flex-grow-1">{item.name}</span>
              {item.type === 'file' && isMarkdownFile(item.name) && (
                <i className="bi bi-download small text-success ms-1" title="Can import"></i>
              )}
            </div>
          </div>
          
          {/* Render folder contents if expanded */}
          {item.type === 'dir' && 
           expandedFolders.has(item.path) && 
           folderContents[item.path] && 
           Array.isArray(folderContents[item.path]) &&
           renderFileTree(folderContents[item.path], depth + 1)}
        </div>
      );
    }).filter(Boolean); // Remove null entries
  };

  return (
    <Card className="h-100 border-0 rounded-0">
      <Card.Header className="py-2">
        <small className="text-muted">
          <i className="bi bi-folder-open me-1"></i>
          Files
        </small>
      </Card.Header>
      <Card.Body className="p-0 overflow-auto">
        {loading && fileTree.length === 0 ? (
          <div className="text-center p-4">
            <Spinner />
            <div className="mt-2 small text-muted">Loading files...</div>
          </div>
        ) : fileTree.length === 0 ? (
          <Alert variant="info" className="m-3">
            No files found in this repository.
          </Alert>
        ) : (
          <div className="file-tree">
            {renderFileTree(fileTree)}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
