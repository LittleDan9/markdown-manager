#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const SRC_DIR = path.join(__dirname, '..', 'src');
const EXCEPTIONS_FILE = path.join(__dirname, '..', 'orphaned-files-exceptions.json');
const IGNORE_PATTERNS = [
  /\.test\.js$/,
  /\.spec\.js$/,
  /__tests__/,
  /node_modules/,
  /\.worker\.js$/,
  /setupTests\.js$/
  // Note: We now analyze index.js files to catch barrel exports
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

  // Match re-exports (export * from, export { ... } from)
  const reExportRegex = /export\s+(?:\*\s+from\s+|.*?from\s+)['"]([^'"]+)['"]/g;
  while ((match = reExportRegex.exec(content)) !== null) {
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
          // Try different extensions, but also try the resolved path as-is
          const extensions = ['', '.js', '.jsx', '/index.js', '/index.jsx'];
          let found = false;
          
        if (resolvedPath) {
          // Try different extensions, but also try the resolved path as-is
          const extensions = ['', '.js', '.jsx', '/index.js', '/index.jsx'];
          let found = false;
          
          // First try the path as-is (handles imports with explicit extensions)
          if (fs.existsSync(resolvedPath)) {
            const stat = fs.statSync(resolvedPath);
            if (stat.isFile()) {
              referencedFiles.add(resolvedPath);
              if (!importMap.has(resolvedPath)) {
                importMap.set(resolvedPath, []);
              }
              importMap.get(resolvedPath).push(file);
              found = true;
            }
          }
          
          // Then try with extensions
          if (!found) {
            for (const ext of extensions.slice(1)) { // Skip empty string since we already tried
              const fullPath = resolvedPath + ext;
              if (fs.existsSync(fullPath)) {
                referencedFiles.add(fullPath);
                if (!importMap.has(fullPath)) {
                  importMap.set(fullPath, []);
                }
                importMap.get(fullPath).push(file);
                found = true;
                break;
              }
            }
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

function loadExceptions() {
  try {
    if (fs.existsSync(EXCEPTIONS_FILE)) {
      const data = JSON.parse(fs.readFileSync(EXCEPTIONS_FILE, 'utf8'));
      return {
        exceptions: new Set(data.exceptions?.map(e => e.file) || []),
        safeToRemove: new Set(data.safeToRemove || [])
      };
    }
  } catch (error) {
    console.warn(`Error loading exceptions file: ${error.message}`);
  }
  return { exceptions: new Set(), safeToRemove: new Set() };
}

function findOrphanedFiles() {
  const allFiles = getAllJsFiles(SRC_DIR).filter(file => !isIgnored(file));
  const { referencedFiles, importMap } = findReferencedFiles();
  const { exceptions, safeToRemove } = loadExceptions();

  console.log(`Found ${referencedFiles.size} referenced files`);
  console.log(`Loaded ${exceptions.size} exception files`);
  console.log(`Found ${safeToRemove.size} files marked as safe to remove`);

  const orphanedFiles = [];

  for (const file of allFiles) {
    if (!referencedFiles.has(file)) {
      const relativePath = path.relative(SRC_DIR, file);
      
      // Skip files in exceptions list
      if (exceptions.has(relativePath)) {
        continue;
      }
      
      // Check if file has any exports (might be a utility or entry point)
      try {
        const content = fs.readFileSync(file, 'utf8');
        const exports = extractExports(content);

        // If file has exports but no imports reference it, it might be orphaned
        if (exports.size > 0) {
          const isSafeToRemove = safeToRemove.has(relativePath);
          orphanedFiles.push({
            file: relativePath,
            exports: Array.from(exports),
            reason: isSafeToRemove ? 'Safe to remove' : 'Has exports but not imported anywhere',
            safeToRemove: isSafeToRemove
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
  const safeToRemove = orphanedFiles.filter(f => f.safeToRemove);
  const needsReview = orphanedFiles.filter(f => !f.safeToRemove);
  
  console.log(`🚨 Found ${orphanedFiles.length} potentially orphaned files:\n`);
  
  if (safeToRemove.length > 0) {
    console.log(`🟢 ${safeToRemove.length} files marked as SAFE TO REMOVE:`);
    safeToRemove.forEach(({ file, exports, reason }) => {
      console.log(`   📁 ${file}`);
    });
    console.log('');
  }
  
  if (needsReview.length > 0) {
    console.log(`🟡 ${needsReview.length} files NEED REVIEW:`);
    needsReview.forEach(({ file, exports, reason }) => {
      console.log(`   📁 ${file}`);
      console.log(`      Reason: ${reason}`);
      if (exports.length > 0) {
        console.log(`      Exports: ${exports.slice(0, 3).join(', ')}${exports.length > 3 ? '...' : ''}`);
      }
      console.log('');
    });
  }

  console.log('⚠️  Note: Files marked as safe to remove are index.js files that are empty or incomplete.');
  console.log('   Review "needs review" files before removing to ensure they\'re truly unused.');
}

console.log('\n✅ Orphaned file detection complete.');