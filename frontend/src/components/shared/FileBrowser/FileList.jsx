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
    
    return (
      <div className="d-flex align-items-center">
        <button
          className="btn btn-link p-0 text-decoration-none text-primary d-flex align-items-center"
          onClick={() => onPathChange && onPathChange('/')}
          style={{ fontSize: '0.875rem', border: 'none' }}
        >
          <i className="bi bi-house-door me-1"></i>
          <small>Root</small>
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
                  style={{ fontSize: '0.875rem' }}
                >
                  <small>{part}</small>
                </button>
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const handleItemClick = (item) => {
    onFileSelect(item);
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
    
    if (isMarkdownFile(item.name)) {
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
    <div className={`github-file-list ${theme}`}>
      {/* Header */}
      <div className="tree-header p-2 border-bottom">
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
            {sortedItems.map((item, index) => {
              const isItemSelected = isSelected(item);
              const isFolder = item.type === 'folder' || item.type === 'dir';
              
              return (
                <tr
                  key={item.id || item.path || index}
                  className={`table-row-hover ${isItemSelected ? 'table-primary' : (theme === 'dark' ? 'table-dark' : '')}`}
                  onClick={() => handleItemClick(item)}
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
                    {item.type === 'file' && item.name && isMarkdownFile(item.name) && (
                      <i className="bi bi-file-richtext text-success" title="Markdown file"></i>
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
