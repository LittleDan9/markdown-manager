#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const SRC_DIR = path.join(__dirname, '..', 'src');
const IGNORE_PATTERNS = [
  /\.test\.js$/,
  /\.spec\.js$/,
  /__tests__/,
  /node_modules/,
  /\.worker\.js$/,
  /setupTests\.js$/,
  /index\.js$/
];

// Helper functions
function isIgnored(filePath) {
  return IGNORE_PATTERNS.some(pattern => pattern.test(filePath));
}

function getAllJsFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...getAllJsFiles(fullPath));
    } else if (stat.isFile() && (item.endsWith('.js') || item.endsWith('.jsx'))) {
      files.push(fullPath);
    }
  }

  return files;
}

function extractImports(content) {
  const imports = new Set();

  // Match import statements
  const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.add(match[1]);
  }

  // Match dynamic imports
  const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicImportRegex.exec(content)) !== null) {
    imports.add(match[1]);
  }

  return imports;
}

function extractExports(content) {
  const exports = new Set();

  // Match export statements
  const exportRegex = /export\s+(?:const|let|var|function|class|default)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
  let match;
  while ((match = exportRegex.exec(content)) !== null) {
    exports.add(match[0]);
  }

  // Match export { ... }
  const exportBlockRegex = /export\s*\{\s*([^}]+)\s*\}/g;
  while ((match = exportBlockRegex.exec(content)) !== null) {
    const exportList = match[1].split(',').map(exp => exp.trim().split(' as ')[0]);
    exportList.forEach(exp => exports.add(exp));
  }

  return exports;
}

function resolveImport(importPath, fromFile) {
  if (importPath.startsWith('@/')) {
    return path.resolve(SRC_DIR, importPath.slice(2));
  }

  if (importPath.startsWith('./') || importPath.startsWith('../')) {
    return path.resolve(path.dirname(fromFile), importPath);
  }

  // External imports (node_modules)
  return null;
}

function findReferencedFiles() {
  const allFiles = getAllJsFiles(SRC_DIR).filter(file => !isIgnored(file));
  const referencedFiles = new Set();
  const importMap = new Map();

  console.log(`Analyzing ${allFiles.length} JavaScript files...`);

  for (const file of allFiles) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const imports = extractImports(content);

      for (const importPath of imports) {
        const resolvedPath = resolveImport(importPath, file);
        if (resolvedPath) {
          // Try different extensions
          const extensions = ['.js', '.jsx', '/index.js', '/index.jsx'];
          for (const ext of extensions) {
            const fullPath = resolvedPath + ext;
            if (fs.existsSync(fullPath)) {
              referencedFiles.add(fullPath);
              if (!importMap.has(fullPath)) {
                importMap.set(fullPath, []);
              }
              importMap.get(fullPath).push(file);
              break;
            }
          }
        }
      }
    } catch (error) {
      console.warn(`Error reading ${file}: ${error.message}`);
    }
  }

  return { referencedFiles, importMap };
}

function findOrphanedFiles() {
  const allFiles = getAllJsFiles(SRC_DIR).filter(file => !isIgnored(file));
  const { referencedFiles, importMap } = findReferencedFiles();

  console.log(`Found ${referencedFiles.size} referenced files`);

  const orphanedFiles = [];

  for (const file of allFiles) {
    if (!referencedFiles.has(file)) {
      // Check if file has any exports (might be a utility or entry point)
      try {
        const content = fs.readFileSync(file, 'utf8');
        const exports = extractExports(content);

        // If file has exports but no imports reference it, it might be orphaned
        if (exports.size > 0) {
          orphanedFiles.push({
            file: path.relative(SRC_DIR, file),
            exports: Array.from(exports),
            reason: 'Has exports but not imported anywhere'
          });
        }
      } catch (error) {
        console.warn(`Error analyzing exports in ${file}: ${error.message}`);
      }
    }
  }

  return orphanedFiles;
}

// Main execution
console.log('🔍 Detecting orphaned files in frontend...\n');

const orphanedFiles = findOrphanedFiles();

if (orphanedFiles.length === 0) {
  console.log('✅ No orphaned files found!');
} else {
  console.log(`🚨 Found ${orphanedFiles.length} potentially orphaned files:\n`);

  orphanedFiles.forEach(({ file, exports, reason }) => {
    console.log(`📁 ${file}`);
    console.log(`   Reason: ${reason}`);
    if (exports.length > 0) {
      console.log(`   Exports: ${exports.slice(0, 5).join(', ')}${exports.length > 5 ? '...' : ''}`);
    }
    console.log('');
  });

  console.log('⚠️  Note: Some files may be entry points or dynamically imported.');
  console.log('   Review each file before removing to ensure it\'s truly unused.');
}

console.log('\n✅ Orphaned file detection complete.');