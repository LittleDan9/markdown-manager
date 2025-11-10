import React from 'react';
import { Breadcrumb } from 'react-bootstrap';
import { useTheme } from '../../../providers/ThemeProvider';

export default function BreadcrumbBar({
  currentPath = '/',
  onPathChange,
  breadcrumbType = 'github', // 'github' or 'local'
  repository = null,
  categories: _categories = [],
  documents = [],
  currentFiles = [] // Add current files for item count
}) {
  const { theme } = useTheme();

  const renderGitHubBreadcrumb = () => {
    if (!currentPath) {
      return (
        <Breadcrumb className="mb-0">
          <Breadcrumb.Item active>
            <i className="bi bi-house-door me-1"></i>
            {repository?.name || repository?.repo_name || 'Repository'}
          </Breadcrumb.Item>
        </Breadcrumb>
      );
    }

    // For GitHub paths, we need to strip out the provider-specific parts
    // e.g., "/GitHub/markdown-manager/main/src/components" should show "src > components"
    let pathParts = currentPath.split('/').filter(part => part);

    // Remove GitHub provider path artifacts (GitHub, repo name, branch)
    if (pathParts.length >= 3 && pathParts[0] === 'GitHub') {
      pathParts = pathParts.slice(3); // Remove "GitHub", repo name, and branch
    }

    return (
      <Breadcrumb className="mb-0">
        <Breadcrumb.Item
          onClick={() => onPathChange && onPathChange('')}
          style={{ cursor: 'pointer' }}
        >
          <i className="bi bi-house-door me-1"></i>
          {repository?.name || repository?.repo_name || 'Repository'}
        </Breadcrumb.Item>

        {pathParts.map((part, index) => {
          const isLast = index === pathParts.length - 1;
          // Reconstruct the full GitHub path for navigation
          const currentPathParts = currentPath.split('/').filter(p => p);
          const githubRootParts = currentPathParts.slice(0, 3); // GitHub/repo/branch
          const fileParts = pathParts.slice(0, index + 1);
          const fullPath = [...githubRootParts, ...fileParts].join('/');

          return (
            <Breadcrumb.Item
              key={fullPath}
              active={isLast}
              onClick={() => !isLast && onPathChange && onPathChange('/' + fullPath)}
              style={{ cursor: !isLast ? 'pointer' : 'default' }}
            >
              {part}
            </Breadcrumb.Item>
          );
        })}
      </Breadcrumb>
    );
  };

  const renderLocalBreadcrumb = () => {
    if (!currentPath || currentPath === '/') {
      return (
        <Breadcrumb className="mb-0">
          <Breadcrumb.Item active>
            <i className="bi bi-house-door me-1"></i>
          </Breadcrumb.Item>
        </Breadcrumb>
      );
    }

    // Use natural path structure - no special handling needed
    const pathParts = currentPath.split('/').filter(part => part);

    return (
      <Breadcrumb className="mb-0">

        {pathParts.map((part, index) => {
          const isLast = index === pathParts.length - 1;
          const fullPath = '/' + pathParts.slice(0, index + 1).join('/');

          return (
            <Breadcrumb.Item
              key={index}
              active={isLast}
              onClick={() => !isLast && onPathChange && onPathChange(fullPath)}
              style={{ cursor: !isLast ? 'pointer' : 'default' }}
            >
              {index === 0 && <i className="bi bi-house me-1"></i>}
              {part}
            </Breadcrumb.Item>
          );
        })}
      </Breadcrumb>
    );
  };

  const getItemCount = () => {
    if (breadcrumbType === 'github') {
      // Show count of current files in the directory
      const fileCount = currentFiles.filter(file => file.type === 'file').length;
      const folderCount = currentFiles.filter(file => file.type === 'dir' || file.type === 'folder').length;

      if (fileCount === 0 && folderCount === 0) {
        return 'Empty folder';
      }

      const parts = [];
      if (folderCount > 0) parts.push(`${folderCount} folder${folderCount !== 1 ? 's' : ''}`);
      if (fileCount > 0) parts.push(`${fileCount} file${fileCount !== 1 ? 's' : ''}`);

      return parts.join(', ');
    } else {
      // Local documents
      if (!currentPath || currentPath === '/') {
        return `${documents?.length || 0} documents`;
      } else {
        // Filter documents by current category/path
        const categoryDocs = documents?.filter(doc =>
          doc.category === currentPath.replace('/', '') ||
          doc.path?.startsWith(currentPath)
        ) || [];
        return `${categoryDocs.length} documents`;
      }
    }
  };

  return (
    <div className={`breadcrumb-bar ${theme}`}>
      <div className="breadcrumb-content p-2">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            {breadcrumbType === 'github' ? renderGitHubBreadcrumb() : renderLocalBreadcrumb()}
          </div>
          <div>
            <small className="text-muted">
              <i className="bi bi-list me-1"></i>
              {getItemCount()}
            </small>
          </div>
        </div>
      </div>
    </div>
  );
}
