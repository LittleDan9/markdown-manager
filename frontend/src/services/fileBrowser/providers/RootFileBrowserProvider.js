/**
 * Root File Browser Provider - Shows both local documents and GitHub repositories at root level
 */

import { BaseFileBrowserProvider } from './BaseFileBrowserProvider.js';
import { LocalDocumentsProvider } from './LocalDocumentsProvider.js';
import { NODE_TYPES, SOURCE_TYPES } from '../../../types/FileBrowserTypes.js';
import gitHubApi from '../../../api/gitHubApi.js';

/**
 * Root provider that shows Documents and GitHub folders at the root level
 */
export class RootFileBrowserProvider extends BaseFileBrowserProvider {
  constructor(documents, categories, config = {}) {
    super(config);
    this.documents = documents;
    this.categories = categories;
    this.localProvider = new LocalDocumentsProvider(documents, categories, config);
  }

  getDisplayName() {
    return 'File Browser';
  }

  getDefaultPath() {
    return '/';
  }

  async getTreeStructure() {
    const rootChildren = [];

    // Add Documents folder (from local provider)
    const localTree = await this.localProvider.getTreeStructure();
    if (localTree && localTree.length > 0) {
      // Find the Documents folder from local provider
      const documentsFolder = localTree.find(node => node.name === 'Documents');
      if (documentsFolder) {
        rootChildren.push(documentsFolder);
      }
    }

    // Add GitHub folder with account folders (not flattened repos)
    try {
      const accounts = await gitHubApi.getAccounts();
      if (accounts && accounts.length > 0) {
        const accountFolders = [];
        for (const account of accounts) {
          try {
            const repos = await gitHubApi.getRepositories(account.id);
            if (repos && repos.length > 0) {
              const accountLogin = account.login || account.username || `account-${account.id}`;
              accountFolders.push({
                id: `github-account-${account.id}`,
                name: accountLogin,
                type: NODE_TYPES.FOLDER,
                path: `/GitHub/${accountLogin}`,
                source: SOURCE_TYPES.GITHUB,
                account: account,
                children: repos.map(repo => ({
                  id: `github-repo-${repo.id}`,
                  name: repo.name || 'Unnamed Repo',
                  type: NODE_TYPES.FOLDER,
                  path: `/GitHub/${accountLogin}/${repo.name || 'unnamed'}`,
                  source: SOURCE_TYPES.GITHUB,
                  repository: repo,
                  account: account
                }))
              });
            }
          } catch (error) {
            console.error(`Failed to get repositories for account ${account.id}:`, error);
          }
        }

        if (accountFolders.length > 0) {
          rootChildren.push({
            id: 'github-root',
            name: 'GitHub',
            type: NODE_TYPES.FOLDER,
            path: '/GitHub',
            source: SOURCE_TYPES.GITHUB,
            children: accountFolders
          });
        }
      }
    } catch (error) {
      console.error('Failed to load GitHub accounts for tree structure:', error);
    }

    return rootChildren;
  }



  async getFilesInPath(path) {
    if (path === '/') {
      // Root level - return Documents and GitHub folders
      const rootChildren = [];

      // Add Documents folder
      const localTree = await this.localProvider.getTreeStructure();
      if (localTree && localTree.length > 0) {
        const documentsFolder = localTree.find(node => node.name === 'Documents');
        if (documentsFolder) {
          rootChildren.push({
            id: 'documents-root',
            name: 'Documents',
            type: NODE_TYPES.FOLDER,
            path: '/Documents',
            source: SOURCE_TYPES.LOCAL
          });
        }
      }

      // Add GitHub folder
      try {
        const accounts = await gitHubApi.getAccounts();
        if (accounts && accounts.length > 0) {
          rootChildren.push({
            id: 'github-root',
            name: 'GitHub',
            type: NODE_TYPES.FOLDER,
            path: '/GitHub',
            source: SOURCE_TYPES.GITHUB
          });
        }
      } catch (error) {
        console.error('Failed to load GitHub accounts:', error);
      }

      return rootChildren;
    }

    if (path.startsWith('/Documents')) {
      // Delegate to local provider
      return await this.localProvider.getFilesInPath(path);
    }

    if (path === '/GitHub') {
      // GitHub root - return account folders
      try {
        const accounts = await gitHubApi.getAccounts();
        if (!accounts || accounts.length === 0) {
          return [];
        }

        const accountFolders = [];
        for (const account of accounts) {
          try {
            const repos = await gitHubApi.getRepositories(account.id);
            if (repos && repos.length > 0) {
              const accountLogin = account.login || account.username || `account-${account.id}`;
              accountFolders.push({
                id: `github-account-${account.id}`,
                name: accountLogin,
                type: NODE_TYPES.FOLDER,
                path: `/GitHub/${accountLogin}`,
                source: SOURCE_TYPES.GITHUB,
                account: account,
                children: repos.map(repo => ({
                  id: `github-repo-${repo.id}`,
                  name: repo.name || 'Unnamed Repo',
                  type: NODE_TYPES.FOLDER,
                  path: `/GitHub/${accountLogin}/${repo.name || 'unnamed'}`,
                  source: SOURCE_TYPES.GITHUB,
                  repository: repo,
                  account: account
                }))
              });
            }
          } catch (error) {
            console.error(`Failed to get repositories for account ${account.id}:`, error);
          }
        }

        return accountFolders;
      } catch (error) {
        console.error('Failed to get GitHub accounts:', error);
        return [];
      }
    }

    if (path.startsWith('/GitHub/')) {
      // Handle GitHub repository browsing
      const pathParts = path.split('/').filter(p => p);
      if (pathParts.length >= 2) {
        const accountLogin = pathParts[1];
        const repoName = pathParts[2];

        if (pathParts.length === 2) {
          // Account level - return selected repositories for this account
          try {
            const accounts = await gitHubApi.getAccounts();
            const account = accounts.find(acc => (acc.login || acc.username) === accountLogin);
            if (account) {
              const selectedRepos = await gitHubApi.getSelectedRepositories(account.id);
              return selectedRepos.map(selection => ({
                id: `github-repo-${selection.github_repo_id}`,
                name: selection.repo_name || 'Unnamed Repo',
                type: NODE_TYPES.FOLDER,
                path: `/GitHub/${accountLogin}/${selection.repo_name || 'unnamed'}`,
                source: SOURCE_TYPES.GITHUB,
                repository: {
                  id: selection.internal_repo_id,
                  github_repo_id: selection.github_repo_id,
                  name: selection.repo_name,
                  full_name: selection.repo_full_name,
                  owner: { login: selection.repo_owner },
                  private: selection.is_private,
                  default_branch: selection.default_branch
                },
                account: account
              }));
            }
          } catch (error) {
            console.error(`Failed to get selected repositories for account ${accountLogin}:`, error);
            return []; // Return empty array instead of throwing
          }
        } else if (pathParts.length === 3) {
          // Repository level - return repository contents
          try {
            const accounts = await gitHubApi.getAccounts();
            const account = accounts.find(acc => (acc.login || acc.username) === accountLogin);
            if (account) {
              const selectedRepos = await gitHubApi.getSelectedRepositories(account.id);
              const repo = selectedRepos.find(r => r.repo_name === repoName);
              if (repo) {
                // Use GitHub API to get repository contents
                // Use the internal repo ID if available, otherwise use github_repo_id
                const repoId = repo.internal_repo_id || repo.github_repo_id;
                const contents = await gitHubApi.getRepositoryContents(repoId, '', repo.default_branch || 'main');
                return contents
                  .filter(item => {
                    // Include directories and markdown files
                    return item.type === 'dir' || (item.type === 'file' && item.name.endsWith('.md'));
                  })
                  .map(item => {
                    if (item.type === 'dir') {
                      return {
                        id: `github-dir-${repo.github_repo_id}-${item.sha}`,
                        name: item.name,
                        type: NODE_TYPES.FOLDER,
                        path: `/GitHub/${accountLogin}/${repoName}/${item.name}`,
                        source: SOURCE_TYPES.GITHUB,
                        repository: {
                          id: repo.internal_repo_id,
                          github_repo_id: repo.github_repo_id,
                          name: repo.repo_name,
                          full_name: repo.repo_full_name,
                          owner: { login: repo.repo_owner },
                          private: repo.is_private,
                          default_branch: repo.default_branch
                        },
                        account: account,
                        githubPath: item.path
                      };
                    } else {
                      return {
                        id: `github-file-${repo.github_repo_id}-${item.sha}`,
                        name: item.name.replace('.md', ''),
                        type: NODE_TYPES.FILE,
                        path: `/GitHub/${accountLogin}/${repoName}/${item.name}`,
                        source: SOURCE_TYPES.GITHUB,
                        repository: {
                          id: repo.internal_repo_id,
                          github_repo_id: repo.github_repo_id,
                          name: repo.repo_name,
                          full_name: repo.repo_full_name,
                          owner: { login: repo.repo_owner },
                          private: repo.is_private,
                          default_branch: repo.default_branch
                        },
                        account: account,
                        githubPath: item.path,
                        documentId: null // GitHub files don't have local document IDs
                      };
                    }
                  });
              }
            }
          } catch (error) {
            console.error(`Failed to get contents for ${accountLogin}/${repoName}:`, error);
            return []; // Return empty array instead of throwing
          }
        } else {
          // Deeper in repository - handle with GitHub API
          try {
            const accounts = await gitHubApi.getAccounts();
            const account = accounts.find(acc => (acc.login || acc.username) === accountLogin);
            if (account) {
              const selectedRepos = await gitHubApi.getSelectedRepositories(account.id);
              const repo = selectedRepos.find(r => r.repo_name === repoName);
              if (repo) {
                // Extract the path within the repository
                const repoPath = pathParts.slice(3).join('/');
                const repoId = repo.internal_repo_id || repo.github_repo_id;
                const contents = await gitHubApi.getRepositoryContents(repoId, repoPath, repo.default_branch || 'main');
                return contents
                  .filter(item => {
                    return item.type === 'dir' || (item.type === 'file' && item.name.endsWith('.md'));
                  })
                  .map(item => {
                    const itemPath = repoPath ? `${repoPath}/${item.name}` : item.name;
                    if (item.type === 'dir') {
                      return {
                        id: `github-dir-${repo.github_repo_id}-${item.sha}`,
                        name: item.name,
                        type: NODE_TYPES.FOLDER,
                        path: `/GitHub/${accountLogin}/${repoName}/${itemPath}`,
                        source: SOURCE_TYPES.GITHUB,
                        repository: {
                          id: repo.internal_repo_id,
                          github_repo_id: repo.github_repo_id,
                          name: repo.repo_name,
                          full_name: repo.repo_full_name,
                          owner: { login: repo.repo_owner },
                          private: repo.is_private,
                          default_branch: repo.default_branch
                        },
                        account: account,
                        githubPath: item.path
                      };
                    } else {
                      return {
                        id: `github-file-${repo.github_repo_id}-${item.sha}`,
                        name: item.name.replace('.md', ''),
                        type: NODE_TYPES.FILE,
                        path: `/GitHub/${accountLogin}/${repoName}/${itemPath}`,
                        source: SOURCE_TYPES.GITHUB,
                        repository: {
                          id: repo.internal_repo_id,
                          github_repo_id: repo.github_repo_id,
                          name: repo.repo_name,
                          full_name: repo.repo_full_name,
                          owner: { login: repo.repo_owner },
                          private: repo.is_private,
                          default_branch: repo.default_branch
                        },
                        account: account,
                        githubPath: item.path,
                        documentId: null, // GitHub files don't have local document IDs
                        _githubFile: item // Add this for compatibility with UnifiedFileOpeningService
                      };
                    }
                  });
              }
            }
          } catch (error) {
            console.error(`Failed to get contents for path ${path}:`, error);
            return []; // Return empty array instead of throwing
          }
        }
      }
    }

    return [];
  }

  async getFileContent(fileNode) {
    if (fileNode.source === SOURCE_TYPES.GITHUB) {
      // Handle GitHub file content
      try {
        const data = await gitHubApi.getFileContent(
          fileNode.repository.id,
          fileNode.githubPath,
          'main'
        );
        return data.content || '';
      } catch (error) {
        console.error('Failed to get GitHub file content:', error);
        throw error;
      }
    } else {
      // Delegate to local provider
      return await this.localProvider.getFileContent(fileNode);
    }
  }

  async searchFiles(query) {
    const results = [];

    // Search local documents
    const localResults = await this.localProvider.searchFiles(query);
    results.push(...localResults);

    // Search GitHub repositories (basic implementation)
    try {
      const accounts = await gitHubApi.getAccounts();
      for (const account of accounts) {
        try {
          const selectedRepos = await gitHubApi.getSelectedRepositories(account.id);
          for (const repo of selectedRepos) {
            // This is a simplified search - in a real implementation,
            // you'd want to search within repository contents
            if (repo.repo_name.toLowerCase().includes(query.toLowerCase())) {
              results.push({
                id: `github-repo-${repo.github_repo_id}`,
                name: repo.repo_name,
                type: NODE_TYPES.FOLDER,
                path: `/GitHub/${account.login || account.username}/${repo.repo_name}`,
                source: SOURCE_TYPES.GITHUB,
                repository: {
                  id: repo.internal_repo_id,
                  github_repo_id: repo.github_repo_id,
                  name: repo.repo_name,
                  full_name: repo.repo_full_name,
                  owner: { login: repo.repo_owner },
                  private: repo.is_private,
                  default_branch: repo.default_branch
                },
                account: account
              });
            }
          }
        } catch (error) {
          console.error(`Failed to search selected repositories for account ${account.login}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to search GitHub repositories:', error);
    }

    return results;
  }

  async getStats() {
    const localStats = await this.localProvider.getStats();

    let githubStats = { totalFiles: 0, totalFolders: 0, totalSize: 0 };
    try {
      const accounts = await gitHubApi.getAccounts();
      let totalRepos = 0;
      for (const account of accounts) {
        try {
          const selectedRepos = await gitHubApi.getSelectedRepositories(account.id);
          totalRepos += selectedRepos.length;
        } catch (error) {
          console.error(`Failed to get selected repositories for account ${account.login}:`, error);
        }
      }
      githubStats.totalFolders = totalRepos;
    } catch (error) {
      console.error('Failed to get GitHub stats:', error);
    }

    return {
      totalFiles: localStats.totalFiles + githubStats.totalFiles,
      totalFolders: localStats.totalFolders + githubStats.totalFolders,
      totalSize: localStats.totalSize + githubStats.totalSize
    };
  }
}