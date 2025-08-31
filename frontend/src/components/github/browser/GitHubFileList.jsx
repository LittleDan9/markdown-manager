import React from 'react';
import { Table, Spinner, Card, Row, Col } from 'react-bootstrap';
import { useTheme } from '../../../providers/ThemeProvider';
import { getFileIcon, getFileIconColor } from '../../../utils/fileIcons';
import { 
  sortRepositoryItems, 
  formatFileSize, 
  isMarkdownFile,
  getHoverBackgroundColor,
  getElevatedHoverBackgroundColor,
  getParentPath,
  getTableVariant,
  getTableHeaderClass,
  getEmptyState
} from '../../../utils/fileBrowserUtils';
import { getTypeBadgeClass } from '../../../utils/githubUtils';

export default function GitHubFileList({ 
  fileTree = [], 
  selectedFile, 
  onFileSelect, 
  onNavigateToPath,
  loading,
  currentPath = ''
}) {
  const { theme } = useTheme();
  // Sort items: folders first, then files, alphabetically
  const sortedItems = sortRepositoryItems(fileTree);



  const renderBreadcrumb = () => {
    if (!currentPath) return null;

    const pathParts = currentPath.split('/');
    
    return (
      <div className="d-flex align-items-center">
        <span 
          onClick={() => onNavigateToPath && onNavigateToPath('')}
          style={{ cursor: 'pointer' }}
          className="text-primary text-decoration-underline"
          onMouseEnter={(e) => e.target.style.opacity = '0.8'}
          onMouseLeave={(e) => e.target.style.opacity = '1'}
        >
          <i className="bi bi-house-door me-1"></i>
          <small>Root</small>
        </span>
        
        {pathParts.map((part, index) => {
          const isLast = index === pathParts.length - 1;
          const fullPath = pathParts.slice(0, index + 1).join('/');
          
          return (
            <React.Fragment key={fullPath}>
              <span className="text-muted mx-1">/</span>
              <span
                onClick={() => !isLast && onNavigateToPath && onNavigateToPath(fullPath)}
                style={{ cursor: !isLast ? 'pointer' : 'default' }}
                className={isLast ? 'text-muted' : 'text-primary text-decoration-underline'}
                onMouseEnter={!isLast ? (e) => e.target.style.opacity = '0.8' : undefined}
                onMouseLeave={!isLast ? (e) => e.target.style.opacity = '1' : undefined}
              >
                <small>{part}</small>
              </span>
            </React.Fragment>
          );
        })}
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
    <div className={`github-file-list ${theme}`}>
      {/* Header */}
      <div className="tree-header p-2 border-bottom">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            {/* Breadcrumb navigation */}
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

      {/* File List */}
      <div className="table-container overflow-auto" style={{ maxHeight: '400px' }}>
        <Table className="mb-0" variant={getTableVariant(theme)}>
          <thead className={getTableHeaderClass(theme)}>
            <tr>
              <th style={{ width: '50%' }}>Name</th>
              <th style={{ width: '20%' }}>Type</th>
              <th style={{ width: '20%' }}>Size</th>
              <th style={{ width: '10%' }}></th>
            </tr>
          </thead>
          <tbody>
            {/* Up directory navigation */}
            {currentPath && (
              <tr
                className={`table-row-hover ${theme === 'dark' ? 'table-dark border-secondary' : 'table-light border-light'}`}
                onClick={() => {
                  const parentPath = getParentPath(currentPath);
                  onNavigateToPath && onNavigateToPath(parentPath);
                }}
                style={{ 
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease-in-out'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = getElevatedHoverBackgroundColor(theme);
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '';
                }}
              >
                <td>
                  <div className="d-flex align-items-center">
                    <i className="bi bi-folder-symlink me-2 text-muted"></i>
                    <span className="text-muted fw-normal">
                      <i className="bi bi-three-dots me-1"></i>
                      Parent Directory
                    </span>
                  </div>
                </td>
                <td>
                  <span className={`badge ${theme === 'dark' ? 'bg-dark text-light' : 'bg-light text-dark'} border`}>
                    Directory
                  </span>
                </td>
                <td className="text-muted">-</td>
                <td className="text-end">
                  <i className="bi bi-arrow-up-short text-muted"></i>
                </td>
              </tr>
            )}

            {sortedItems.map((item, index) => {
              const isSelected = selectedFile && selectedFile.path === item.path;
              const isFolder = item.type === 'dir';
              
              return (
                <tr
                  key={item.path || index}
                  className={`table-row-hover ${isSelected ? 'table-primary' : (theme === 'dark' ? 'table-dark' : '')}`}
                  onClick={() => onFileSelect(item)}
                  style={{ 
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease-in-out'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = getHoverBackgroundColor(theme, isSelected);
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = '';
                    }
                  }}
                >
                  <td>
                    <div className="d-flex align-items-center">
                      <i className={`bi bi-${getFileIcon(item, false)} me-2 ${
                        getFileIconColor(item, false, isSelected)
                      }`}></i>
                      <span>{item.name}</span>
                    </div>
                  </td>
                  <td>
                    <span className={getTypeBadgeClass(item.type, theme)}>
                      {isFolder ? 'Folder' : 'File'}
                    </span>
                  </td>
                  <td className="text-muted">
                    {formatFileSize(item.size)}
                  </td>
                  <td className="text-end">
                    {item.type === 'file' && isMarkdownFile(item.name) && (
                      <i className="bi bi-file-richtext text-success" title="Markdown file"></i>
                    )}
                    {isFolder && (
                      <i className="bi bi-chevron-right text-muted opacity-50"></i>
                    )}
                  </td>
                </tr>
              );
            })}
            
            {sortedItems.length === 0 && !loading && (
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
