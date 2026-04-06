#!/usr/bin/env node
/**
 * Icon Seed Extraction Script
 *
 * Reads npm icon packages and outputs standardised seed JSON files into
 * data/ that the backend auto-seeds from on startup.
 *
 * Run: cd seed-icons && npm ci && node extract.js
 */

const fs = require('fs');
const path = require('path');

const MANIFEST = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed-manifest.json'), 'utf-8'));
const DATA_DIR = path.join(__dirname, 'data');

// ── Adapters ──────────────────────────────────────────────────────────────

/**
 * Adapter for @iconify-json/* packages.
 * Reads the single icons.json that ships with each package.
 */
function extractIconifyJson(packDef) {
  const pkgDir = resolvePackage(packDef.source);
  const iconsJsonPath = path.join(pkgDir, 'icons.json');
  if (!fs.existsSync(iconsJsonPath)) {
    console.warn(`  ⚠ ${packDef.source}: icons.json not found — skipping`);
    return null;
  }

  const raw = JSON.parse(fs.readFileSync(iconsJsonPath, 'utf-8'));
  const icons = {};
  const defaultWidth = raw.width ?? 24;
  const defaultHeight = raw.height ?? 24;

  for (const [key, data] of Object.entries(raw.icons ?? {})) {
    const left = Number(data.left ?? 0);
    const top = Number(data.top ?? 0);
    const w = Math.round(Number(data.width ?? defaultWidth));
    const h = Math.round(Number(data.height ?? defaultHeight));

    icons[key] = {
      body: data.body,
      viewBox: `${left} ${top} ${w} ${h}`,
      width: w,
      height: h,
    };
  }

  return buildSeed(packDef, icons, defaultWidth, defaultHeight, raw.info);
}

/**
 * Adapter for packages that ship SVG files in a directory tree
 * (e.g. aws-icons, @codiva/aws-icons).
 */
function extractSvgDirectory(packDef) {
  const pkgDir = resolvePackage(packDef.source);
  const iconsRoot = path.join(pkgDir, packDef.config?.iconsDir ?? 'icons');

  if (!fs.existsSync(iconsRoot)) {
    // Fall-back: try the package root itself
    if (hasSvgFiles(pkgDir)) {
      return extractSvgsFromDir(packDef, pkgDir);
    }
    console.warn(`  ⚠ ${packDef.source}: icons directory not found — skipping`);
    return null;
  }

  return extractSvgsFromDir(packDef, iconsRoot);
}

function extractSvgsFromDir(packDef, dir) {
  const svgFiles = findSvgFiles(dir);
  if (svgFiles.length === 0) {
    console.warn(`  ⚠ ${packDef.source}: no SVG files found — skipping`);
    return null;
  }

  const icons = {};
  for (const filePath of svgFiles) {
    const key = path.basename(filePath, '.svg');
    const svg = fs.readFileSync(filePath, 'utf-8');

    const vbMatch = svg.match(/viewBox\s*=\s*"([^"]+)"/i);
    if (!vbMatch) continue; // skip malformed SVGs
    const [x = 0, y = 0, w = 24, h = 24] = vbMatch[1].split(/\s+/).map(Number);

    const bodyMatch = svg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
    const body = (bodyMatch ? bodyMatch[1] : '').trim();
    if (!body) continue;

    icons[key] = {
      body,
      viewBox: `${x} ${y} ${w} ${h}`,
      width: w,
      height: h,
    };
  }

  console.log(`  Extracted ${Object.keys(icons).length} / ${svgFiles.length} SVGs from ${packDef.source}`);
  return buildSeed(packDef, icons, 24, 24);
}

// ── Helpers ───────────────────────────────────────────────────────────────

function resolvePackage(name) {
  // resolve from node_modules relative to this script
  return path.join(__dirname, 'node_modules', name);
}

function getInstalledVersion(source) {
  try {
    const pkgJson = JSON.parse(
      fs.readFileSync(path.join(resolvePackage(source), 'package.json'), 'utf-8')
    );
    return pkgJson.version || 'unknown';
  } catch {
    return 'unknown';
  }
}

function findSvgFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findSvgFiles(full));
    } else if (entry.name.endsWith('.svg')) {
      files.push(full);
    }
  }
  return files;
}

function hasSvgFiles(dir) {
  try {
    return fs.readdirSync(dir).some(f => f.endsWith('.svg'));
  } catch {
    return false;
  }
}

function buildSeed(packDef, icons, defaultWidth, defaultHeight, info) {
  const iconCount = Object.keys(icons).length;
  if (iconCount === 0) return null;

  return {
    info: {
      name: packDef.name,
      displayName: packDef.displayName,
      category: packDef.category,
      description: packDef.description || (info?.description ?? ''),
    },
    icons,
    width: defaultWidth,
    height: defaultHeight,
    _seed: {
      source: packDef.source,
      version: getInstalledVersion(packDef.source),
      extractedAt: new Date().toISOString(),
      iconCount,
    },
  };
}

// ── Adapter registry ─────────────────────────────────────────────────────

const ADAPTERS = {
  'iconify-json': extractIconifyJson,
  'svg-directory': extractSvgDirectory,
};

// ── Main ─────────────────────────────────────────────────────────────────

function main() {
  console.log(`Extracting ${MANIFEST.packs.length} icon pack(s)…\n`);

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  let succeeded = 0;
  let failed = 0;

  for (const packDef of MANIFEST.packs) {
    const adapter = ADAPTERS[packDef.adapter];
    if (!adapter) {
      console.error(`  ✗ Unknown adapter "${packDef.adapter}" for ${packDef.name}`);
      failed++;
      continue;
    }

    console.log(`[${packDef.name}] adapter=${packDef.adapter}  source=${packDef.source}`);
    try {
      const seed = adapter(packDef);
      if (!seed) {
        console.warn(`  ✗ ${packDef.name}: no icons extracted`);
        failed++;
        continue;
      }

      const outFile = path.join(DATA_DIR, `${packDef.name}.seed.json`);
      fs.writeFileSync(outFile, JSON.stringify(seed, null, 2));
      console.log(`  ✓ ${packDef.name}: ${seed._seed.iconCount} icons → ${path.basename(outFile)}\n`);
      succeeded++;
    } catch (err) {
      console.error(`  ✗ ${packDef.name}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. ${succeeded} succeeded, ${failed} failed.`);
  if (succeeded === 0) process.exit(1);
}

main();
