import React from 'react';
import { Table, Badge, Spinner } from 'react-bootstrap';
import { useTheme } from '../../../providers/ThemeProvider';
import { getFileIcon, getFileIconColor } from '../../../utils/fileIcons';
import { 
  sortRepositoryItems, 
  formatFileSize, 
  isMarkdownFile,
  getHoverBackgroundColor,
  getTableVariant,
  getTableHeaderClass,
  getEmptyState
} from '../../../utils/fileBrowserUtils';

export default function FileList({
  files,
  currentPath,
  selectedFile,
  selectedFiles = [],
  onFileSelect,
  onFileOpen,
  onPathChange,
  onFolderExpand,
  onMultiSelect,
  config
}) {
  const { theme } = useTheme();
  const sortedItems = sortRepositoryItems(files);

  const renderBreadcrumb = () => {
    if (!currentPath || currentPath === '/') {
      return (
        <div className="d-flex align-items-center">
          <i className="bi bi-house-door me-1"></i>
          <small>Root</small>
        </div>
      );
    }

    const pathParts = currentPath.split('/').filter(p => p);
    
    // Check if this is a GitHub path or local documents path
    const isGitHub = pathParts.includes('GitHub') || pathParts.length > 2;
    
    if (isGitHub) {
      // GitHub-specific breadcrumb logic (existing logic)
      let filteredParts = pathParts.filter(part => part !== 'GitHub');
      
      let repoName = '';
      let folderParts = [];
      
      if (filteredParts.length > 0) {
        repoName = filteredParts[0]; // First part is repository name
        if (filteredParts.length > 2) {
          // Skip branch name (second part) and show folders (third part onwards)
          folderParts = filteredParts.slice(2);
        }
      }
      
      return (
        <div className="d-flex align-items-center">
          <button
            className="btn btn-link p-0 text-decoration-none text-primary d-flex align-items-center"
            onClick={() => onPathChange && onPathChange('/')}
            style={{ fontSize: '0.875rem', border: 'none' }}
          >
            <i className="bi bi-folder me-1"></i>
            <small>{repoName || 'Repository'}</small>
          </button>
          
          {folderParts.map((part, index) => {
            const isLast = index === folderParts.length - 1;
            // Reconstruct the original path including all parts for navigation
            const repoIndex = pathParts.indexOf(repoName);
            const branchName = pathParts[repoIndex + 1]; // Branch is after repo name
            const folderPath = pathParts.slice(0, repoIndex + 2 + index + 1); // Include repo, branch, and folders up to this point
            const partPath = '/' + folderPath.join('/');
            
            return (
              <React.Fragment key={index}>
                <span className="text-muted mx-1">/</span>
                {isLast ? (
                  <span className="text-muted">
                    <small>{part}</small>
                  </span>
                ) : (
                  <button
                    className="btn btn-link p-0 text-decoration-none text-primary"
                    onClick={() => onPathChange && onPathChange(partPath)}
                    style={{ fontSize: '0.875rem', border: 'none' }}
                  >
                    <small>{part}</small>
                  </button>
                )}
              </React.Fragment>
            );
          })}
        </div>
      );
    } else {
      // Local documents breadcrumb logic (simpler structure)
      return (
        <div className="d-flex align-items-center">
          <button
            className="btn btn-link p-0 text-decoration-none text-primary d-flex align-items-center"
            onClick={() => onPathChange && onPathChange('/')}
            style={{ fontSize: '0.875rem', border: 'none' }}
          >
            <i className="bi bi-house-door me-1"></i>
            <small>My Documents</small>
          </button>
          
          {pathParts.map((part, index) => {
            const isLast = index === pathParts.length - 1;
            const partPath = '/' + pathParts.slice(0, index + 1).join('/');
            
            return (
              <React.Fragment key={index}>
                <span className="text-muted mx-1">/</span>
                {isLast ? (
                  <span className="text-muted">
                    <small>{part}</small>
                  </span>
                ) : (
                  <button
                    className="btn btn-link p-0 text-decoration-none text-primary"
                    onClick={() => onPathChange && onPathChange(partPath)}
                    style={{ fontSize: '0.875rem', border: 'none' }}
                  >
                    <small>{part}</small>
                  </button>
                )}
              </React.Fragment>
            );
          })}
        </div>
      );
    }
  };

  const handleItemClick = (item) => {
    onFileSelect(item);
    
    // If it's a folder, expand it in the tree (but don't navigate to it)
    const isFolder = item.type === 'folder' || item.type === 'dir';
    if (isFolder && onFolderExpand) {
      // Use the item's path directly - it should already be in the correct format
      const folderPath = item.path;
      onFolderExpand(folderPath);
    }
  };

  const handleItemDoubleClick = (item) => {
    const isFolder = item.type === 'folder' || item.type === 'dir';
    if (isFolder && onPathChange) {
      // For folders, double-click navigates to the folder
      // Use the item's path directly - it should already be in the correct format
      const newPath = item.path;
      onPathChange(newPath);
    } else if (item.type === 'file' && onFileOpen) {
      // For files, double-click opens the file
      onFileOpen(item);
    }
  };

  const isSelected = (file) => {
    return selectedFile && selectedFile.id === file.id;
  };

  const getTypeBadge = (item) => {
    const isFolder = item.type === 'folder' || item.type === 'dir';
    
    if (isFolder) {
      return (
        <Badge bg="info" pill className="text-white" style={{ fontSize: '0.75em' }}>
          <i className="bi bi-folder-fill me-1"></i>
          Folder
        </Badge>
      );
    }

    // Determine file type for better badges
    const extension = item.name.split('.').pop().toLowerCase();
    let badgeColor = 'secondary';
    let icon = 'file-earmark';
    
    if (isMarkdownFile(item)) {
      badgeColor = 'success';
      icon = 'file-text';
    } else if (['js', 'jsx', 'ts', 'tsx'].includes(extension)) {
      badgeColor = 'warning';
      icon = 'file-code';
    } else if (['css', 'scss', 'sass'].includes(extension)) {
      badgeColor = 'danger';
      icon = 'palette';
    } else if (['html', 'htm', 'xml'].includes(extension)) {
      badgeColor = 'primary';
      icon = 'file-earmark-code';
    } else if (['json', 'yaml', 'yml', 'toml'].includes(extension)) {
      badgeColor = 'dark';
      icon = 'file-earmark-text';
    } else if (['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(extension)) {
      badgeColor = 'light';
      icon = 'image';
    }

    return (
      <Badge 
        bg={badgeColor} 
        pill 
        className={badgeColor === 'light' ? 'text-dark' : 'text-white'} 
        style={{ fontSize: '0.75em' }}
      >
        <i className={`bi bi-${icon} me-1`}></i>
        File
      </Badge>
    );
  };

  return (
    <div className={`github-file-list ${theme}`} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header - only show if tree breadcrumb is enabled */}
      {config.showTreeBreadcrumb && (
        <div className="tree-header p-2 border-bottom" style={{ flexShrink: 0 }}>
          <div className="d-flex justify-content-between align-items-center">
            <div>
              {renderBreadcrumb()}
            </div>
            <div>
              <small className="text-muted">
                <i className="bi bi-list me-1"></i>
                {sortedItems.length} items
              </small>
            </div>
          </div>
        </div>
      )}

      {/* File List */}
      <div className="table-container overflow-auto" style={{ flex: 1, minHeight: 0 }}>
        <Table className="mb-0" variant={getTableVariant(theme)}>
          <thead className="tree-header">
            <tr>
              <th style={{ width: '50%' }}>Name</th>
              <th style={{ width: '20%' }}>Type</th>
              <th style={{ width: '20%' }}>Size</th>
              <th style={{ width: '10%' }}></th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item, index) => {
              const isItemSelected = isSelected(item);
              const isFolder = item.type === 'folder' || item.type === 'dir';
              
              return (
                <tr
                  key={item.id || item.path || index}
                  className={`table-row-hover ${isItemSelected ? 'table-primary' : (theme === 'dark' ? 'table-dark' : '')}`}
                  onClick={() => handleItemClick(item)}
                  onDoubleClick={() => handleItemDoubleClick(item)}
                  style={{ 
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease-in-out'
                  }}
                  onMouseEnter={(e) => {
                    if (!isItemSelected) {
                      e.currentTarget.style.backgroundColor = getHoverBackgroundColor(theme, isItemSelected);
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isItemSelected) {
                      e.currentTarget.style.backgroundColor = '';
                    }
                  }}
                >
                  <td>
                    <div className="d-flex align-items-center">
                      <i className={`bi bi-${getFileIcon(item, false)} me-2 ${
                        getFileIconColor(item, false, isItemSelected)
                      }`}></i>
                      <span>{item.name}</span>
                    </div>
                  </td>
                  <td>
                    {getTypeBadge(item)}
                  </td>
                  <td className="text-muted">
                    {formatFileSize(item.size)}
                  </td>
                  <td className="text-end">
                    {item.type === 'file' && item.name && isMarkdownFile(item) && (
                      <div className="d-flex align-items-center justify-content-end">
                        <i className="bi bi-file-richtext text-success me-1" title="Markdown file - Double-click to open"></i>
                        <i className="bi bi-box-arrow-in-right text-success opacity-75" title="Double-click to open"></i>
                      </div>
                    )}
                    {item.type === 'file' && item.name && !isMarkdownFile(item) && (
                      <i className="bi bi-file-earmark text-muted opacity-50" title="File (not openable)"></i>
                    )}
                    {isFolder && (
                      <i className="bi bi-chevron-right text-muted opacity-50"></i>
                    )}
                  </td>
                </tr>
              );
            })}
            
            {sortedItems.length === 0 && (
              <tr>
                <td colSpan="4" className="text-center text-muted py-4">
                  <i className={`${getEmptyState('list').icon} display-6 d-block mb-2 opacity-50`}></i>
                  <small>{getEmptyState('list').message}</small>
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
