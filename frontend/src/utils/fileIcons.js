/**
 * File type icon utility
 * Provides Bootstrap Icons for different file types and folders
 */

/**
 * Get Bootstrap Icon class for a file or folder
 * @param {Object} item - File/folder object with name and type properties
 * @param {boolean} isExpanded - Whether folder is expanded (for folders only)
 * @returns {string} Bootstrap icon class name
 */
export const getFileIcon = (item, isExpanded = false) => {
  if (item.type === 'dir') {
    return isExpanded ? 'folder2-open' : 'folder2';
  }
  
  // Extract file extension and filename
  const extension = item.name.split('.').pop().toLowerCase();
  const filename = item.name.toLowerCase();
  
  // Special files first (by exact filename)
  const filenameMap = {
    // Documentation
    'readme.md': 'file-text-fill',
    'readme.txt': 'file-text-fill', 
    'readme': 'file-text-fill',
    'changelog.md': 'file-text',
    'changelog.txt': 'file-text',
    'changelog': 'file-text',
    'license': 'shield-check',
    'license.txt': 'shield-check',
    'license.md': 'shield-check',
    'authors': 'file-earmark-text',
    'contributors': 'file-earmark-text',
    'todo.md': 'list-check',
    'todo.txt': 'list-check',
    
    // Package Management
    'package.json': 'box-seam',
    'package-lock.json': 'box-seam',
    'yarn.lock': 'box-seam',
    'composer.json': 'box-seam',
    'gemfile': 'gem',
    'requirements.txt': 'file-earmark-code',
    'setup.py': 'file-earmark-code',
    'pyproject.toml': 'file-earmark-code',
    'poetry.lock': 'file-earmark-code',
    
    // Build & Config
    'dockerfile': 'hdd-stack',
    'docker-compose.yml': 'hdd-stack',
    'docker-compose.yaml': 'hdd-stack',
    'makefile': 'gear',
    'cmakelists.txt': 'gear',
    'webpack.config.js': 'gear',
    'gulpfile.js': 'gear',
    'gruntfile.js': 'gear',
    'rollup.config.js': 'gear',
    'vite.config.js': 'gear',
    
    // Version Control
    '.gitignore': 'git',
    '.gitattributes': 'git',
    '.gitmodules': 'git',
    '.gitkeep': 'git',
    
    // Environment
    '.env': 'file-earmark-code',
    '.env.local': 'file-earmark-code',
    '.env.production': 'file-earmark-code',
    '.env.development': 'file-earmark-code',
    '.env.example': 'file-earmark-code',
  };
  
  // Check filename first
  if (filenameMap[filename]) {
    return filenameMap[filename];
  }
  
  // Special filename patterns
  if (filename.includes('config') || filename.includes('settings')) {
    return 'gear';
  }
  if (filename.startsWith('docker-compose')) {
    return 'hdd-stack';
  }
  
  // File type mapping by extension
  const iconMap = {
    // Documents & Text
    'md': 'file-text',
    'markdown': 'file-text',
    'txt': 'file-text',
    'rtf': 'file-text',
    'doc': 'file-earmark-word',
    'docx': 'file-earmark-word',
    'pdf': 'file-earmark-pdf',
    
    // Programming Languages
    'js': 'filetype-js',
    'mjs': 'filetype-js',
    'jsx': 'file-code',
    'ts': 'filetype-ts',
    'tsx': 'file-code',
    'vue': 'file-code',
    'svelte': 'file-code',
    'php': 'filetype-php',
    'py': 'filetype-py',
    'rb': 'gem',
    'java': 'file-code',
    'c': 'file-code',
    'cpp': 'file-code',
    'cc': 'file-code',
    'cxx': 'file-code',
    'h': 'file-code',
    'hpp': 'file-code',
    'cs': 'file-code',
    'go': 'file-code',
    'rs': 'file-code',
    'rust': 'file-code',
    'swift': 'file-code',
    'kt': 'file-code',
    'kts': 'file-code',
    'scala': 'file-code',
    'r': 'file-code',
    'matlab': 'file-code',
    'm': 'file-code',
    
    // Shell Scripts
    'sh': 'terminal',
    'bash': 'terminal',
    'zsh': 'terminal',
    'fish': 'terminal',
    'bat': 'terminal',
    'cmd': 'terminal',
    'ps1': 'terminal',
    
    // Web Technologies
    'html': 'filetype-html',
    'htm': 'filetype-html',
    'xml': 'filetype-xml',
    'xhtml': 'file-earmark-code',
    'jsp': 'file-earmark-code',
    'asp': 'file-earmark-code',
    'aspx': 'file-earmark-code',
    
    // Stylesheets
    'css': 'filetype-css',
    'scss': 'filetype-scss',
    'sass': 'filetype-scss',
    'less': 'file-earmark-richtext',
    'styl': 'file-earmark-richtext',
    
    // Data & Configuration
    'json': 'filetype-json',
    'xml': 'filetype-xml',
    'yaml': 'filetype-yml',
    'yml': 'filetype-yml',
    'toml': 'file-earmark-code',
    'ini': 'gear',
    'cfg': 'gear',
    'conf': 'gear',
    'config': 'gear',
    'env': 'file-earmark-code',
    'properties': 'file-earmark-code',
    'csv': 'filetype-csv',
    
    // Database
    'sql': 'filetype-sql',
    'db': 'file-earmark-sql',
    'sqlite': 'file-earmark-sql',
    'sqlite3': 'file-earmark-sql',
    
    // Images
    'png': 'file-earmark-image',
    'jpg': 'filetype-jpg',
    'jpeg': 'filetype-jpg',
    'gif': 'file-earmark-image',
    'svg': 'filetype-svg',
    'bmp': 'file-earmark-image',
    'webp': 'file-earmark-image',
    'ico': 'file-earmark-image',
    'tiff': 'file-earmark-image',
    'tif': 'file-earmark-image',
    
    // Audio
    'mp3': 'file-earmark-music',
    'wav': 'file-earmark-music',
    'flac': 'file-earmark-music',
    'aac': 'file-earmark-music',
    'ogg': 'file-earmark-music',
    'm4a': 'file-earmark-music',
    'wma': 'file-earmark-music',
    
    // Video
    'mp4': 'file-earmark-play',
    'avi': 'file-earmark-play',
    'mov': 'file-earmark-play',
    'wmv': 'file-earmark-play',
    'flv': 'file-earmark-play',
    'webm': 'file-earmark-play',
    'mkv': 'file-earmark-play',
    'm4v': 'file-earmark-play',
    
    // Archives
    'zip': 'file-zip',
    'rar': 'file-zip',
    '7z': 'file-zip',
    'tar': 'file-zip',
    'gz': 'file-zip',
    'tgz': 'file-zip',
    'bz2': 'file-zip',
    'xz': 'file-zip',
    
    // Executables
    'exe': 'file-binary',
    'msi': 'file-binary',
    'app': 'file-binary',
    'dmg': 'file-binary',
    'deb': 'file-binary',
    'rpm': 'file-binary',
    'apk': 'file-binary',
    
    // Spreadsheets
    'xls': 'file-earmark-spreadsheet',
    'xlsx': 'file-earmark-spreadsheet',
    'ods': 'file-earmark-spreadsheet',
    
    // Presentations
    'ppt': 'file-earmark-slides',
    'pptx': 'file-earmark-slides',
    'odp': 'file-earmark-slides',
    
    // Fonts
    'ttf': 'fonts',
    'otf': 'fonts',
    'woff': 'fonts',
    'woff2': 'fonts',
    'eot': 'fonts',
  };
  
  return iconMap[extension] || 'file-earmark';
};

/**
 * Get color class for file icon based on type
 * @param {Object} item - File/folder object
 * @param {boolean} isExpanded - Whether folder is expanded
 * @param {boolean} isSelected - Whether item is selected
 * @returns {string} CSS color class
 */
export const getFileIconColor = (item, isExpanded = false, isSelected = false) => {
  if (item.type === 'dir') {
    if (isSelected) {
      return ''; // Let selection styling handle color
    }
    return isExpanded ? 'text-warning' : '';
  }
  
  // For selected files, let selection styling handle the color
  if (isSelected) {
    return '';
  }
  
  const extension = item.name.split('.').pop().toLowerCase();
  
  // Color mapping for different file types
  const colorMap = {
    // Documents - Green
    'md': 'text-success',
    'markdown': 'text-success',
    'txt': 'text-muted',
    'pdf': 'text-danger',
    
    // Code - Blue
    'js': 'text-info',
    'jsx': 'text-info',
    'ts': 'text-info',
    'tsx': 'text-info',
    'py': 'text-info',
    'java': 'text-info',
    'c': 'text-info',
    'cpp': 'text-info',
    'cs': 'text-info',
    'go': 'text-info',
    'rs': 'text-info',
    'php': 'text-info',
    'rb': 'text-info',
    
    // Web - Primary
    'html': 'text-primary',
    'htm': 'text-primary',
    'xml': 'text-primary',
    
    // Styles - Danger/Red
    'css': 'text-danger',
    'scss': 'text-danger',
    'sass': 'text-danger',
    'less': 'text-danger',
    
    // Data - Secondary
    'json': 'text-secondary',
    'yaml': 'text-secondary',
    'yml': 'text-secondary',
    'xml': 'text-secondary',
    
    // Images - Purple/Custom
    'png': 'text-purple',
    'jpg': 'text-purple',
    'jpeg': 'text-purple',
    'gif': 'text-purple',
    'svg': 'text-purple',
    
    // Media - Warning
    'mp3': 'text-warning',
    'mp4': 'text-warning',
    'wav': 'text-warning',
    'avi': 'text-warning',
  };
  
  return colorMap[extension] || 'text-muted';
};

export default { getFileIcon, getFileIconColor };
