/**
 * DictionaryScopeUtils.js
 * Utilities for determining dictionary scope and context based on documents
 */

export class DictionaryScopeUtils {
  /**
   * Get dictionary scope for the current context
   * @param {Object} currentDocument - Current document object with folder_path and source info
   * @returns {Object} - Dictionary scope information
   */
  static getDictionaryScope(currentDocument = null) {
    if (!currentDocument) {
      return { type: 'user', folderPath: null, displayName: 'Personal' };
    }

    // Check if document is from GitHub
    if (currentDocument.source === 'github' || currentDocument.repository_id) {
      const repoName = currentDocument.repository_name || 'Unknown Repository';
      const folderPath = `/github/${repoName}`;
      return {
        type: 'github',
        folderPath,
        displayName: `${repoName}`,
        repository: currentDocument.repository_name
      };
    }

    // For local documents, check folder depth
    const folderPath = currentDocument.folder_path || '/';
    const pathParts = folderPath.split('/').filter(part => part.length > 0);

    if (pathParts.length === 0) {
      // Root level documents
      return { type: 'user', folderPath: null, displayName: 'Personal' };
    } else if (pathParts.length === 1) {
      // One level deep - use root folder dictionary
      const rootFolder = pathParts[0];
      return {
        type: 'folder',
        folderPath: `/${rootFolder}`,
        displayName: `${rootFolder}`,
        folder: rootFolder
      };
    } else {
      // Multiple levels deep - use the root folder dictionary
      const rootFolder = pathParts[0];
      return {
        type: 'folder',
        folderPath: `/${rootFolder}`,
        displayName: `${rootFolder}`,
        folder: rootFolder
      };
    }
  }

  /**
   * Get available dictionary scopes for the user
   * @param {Array} documents - User's documents
   * @returns {Array} - Available dictionary scopes
   */
  static getAvailableScopes(documents = []) {
    const scopes = [
      { type: 'user', folderPath: null, displayName: 'Personal (All Documents)' }
    ];

    const uniqueFolders = new Set();
    const uniqueRepos = new Set();

    documents.forEach(doc => {
      if (doc.source === 'github' || doc.repository_id) {
        const repoName = doc.repository_name || 'Unknown Repository';
        if (!uniqueRepos.has(repoName)) {
          uniqueRepos.add(repoName);
          scopes.push({
            type: 'github',
            folderPath: `/github/${repoName}`,
            displayName: `${repoName}`,
            repository: repoName
          });
        }
      } else {
        const folderPath = doc.folder_path || '/';
        const pathParts = folderPath.split('/').filter(part => part.length > 0);

        if (pathParts.length > 0) {
          const rootFolder = pathParts[0];
          if (!uniqueFolders.has(rootFolder)) {
            uniqueFolders.add(rootFolder);
            scopes.push({
              type: 'folder',
              folderPath: `/${rootFolder}`,
              displayName: `${rootFolder}`,
              folder: rootFolder
            });
          }
        }
      }
    });

    return scopes;
  }

  /**
   * Normalize folder path to ensure consistency
   * @param {string} folderPath - The folder path to normalize
   * @returns {string} - Normalized folder path
   */
  static normalizeFolderPath(folderPath) {
    if (!folderPath || folderPath === '/') {
      return null; // User-level dictionary
    }
    // Ensure it starts with / and doesn't end with / (unless it's just /)
    let normalized = folderPath.startsWith('/') ? folderPath : `/${folderPath}`;
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  }
}
