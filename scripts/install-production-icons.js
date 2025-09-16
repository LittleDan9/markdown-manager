#!/usr/bin/env node

/**
 * Production Icon Pack Installation Script
 *
 * This script extracts icons from the actual packages in node_modules
 * and installs them via the backend API for production deployment.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

class ProductionIconInstaller {
  constructor(apiBaseUrl = 'http://localhost:8000') {
    this.apiBaseUrl = apiBaseUrl;
    this.baseUrl = `${apiBaseUrl}/icons`;
  }

  /**
   * HTTP client using built-in Node.js modules
   */
  async apiRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const urlParts = new URL(url);

    return new Promise((resolve, reject) => {
      const requestOptions = {
        hostname: urlParts.hostname,
        port: urlParts.port || (urlParts.protocol === 'https:' ? 443 : 80),
        path: urlParts.pathname + urlParts.search,
        method: options.method || 'GET',
        headers: {
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkYW5AbGl0dGxlZGFuLmNvbSIsImV4cCI6MTc1Nzk5MzUwMH0.3XJZFD0jcsG6qXtVJXn0irkacNzXtVE9PhvqqTC_Phg`,
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          ...options.headers
        },
        timeout: 300000 // 5 minutes
      };

      if (options.body) {
        requestOptions.headers['Content-Length'] = Buffer.byteLength(options.body);
      }

      const client = urlParts.protocol === 'https:' ? https : http;

      const req = client.request(requestOptions, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              resolve(data);
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (options.body) {
        req.write(options.body);
      }

      req.end();
    });
  }

  /**
   * Extract AWS icons from aws-icons package
   */
  extractAwsIcons() {
    console.log('Extracting AWS icons...');

    const awsPath = path.join(__dirname, '../frontend/node_modules/aws-icons');
    if (!fs.existsSync(awsPath)) {
      console.log('aws-icons package not found, skipping');
      return null;
    }

    const icons = {};

    // Look for icons in subdirectories
    const iconsPath = path.join(awsPath, 'icons');
    if (!fs.existsSync(iconsPath)) {
      console.log('aws-icons/icons directory not found');
      return null;
    }

    // Recursively find all SVG files
    const findSvgFiles = (dir) => {
      const files = [];
      const items = fs.readdirSync(dir);

      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          files.push(...findSvgFiles(fullPath));
        } else if (item.endsWith('.svg')) {
          files.push(fullPath);
        }
      }

      return files;
    };

    const svgFiles = findSvgFiles(iconsPath);
    console.log(`Found ${svgFiles.length} AWS SVG files`);

    for (const filePath of svgFiles) {
      const iconKey = path.basename(filePath, '.svg');
      const svg = fs.readFileSync(filePath, 'utf-8');

      const vbMatch = svg.match(/viewBox\s*=\s*"([^"]+)"/i);
      if (!vbMatch) continue; // skip malformed
      // x y w h
      const [x = 0, y = 0, w = 24, h = 24] = vbMatch[1].split(/\s+/).map(Number);

      // Inner content
      const bodyMatch = svg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
      const body = (bodyMatch ? bodyMatch[1] : svg).trim();

      icons[iconKey] = {
        body,                         // raw inner markup (keep <defs> if present)
        viewBox: `${x} ${y} ${w} ${h}`,
        width: w,                     // MUST mirror viewBox width
        height: h                     // MUST mirror viewBox height
      };
    }

    console.log(`Extracted ${Object.keys(icons).length} AWS icons`);

    if (Object.keys(icons).length === 0) {
      return null;
    }

    return {
      name: 'aws-icons',
      display_name: 'AWS Icons',
      category: 'cloud',
      description: 'Official AWS service and resource icons',
      icons: icons
    };
  }

  /**
   * Extract Iconify icons from @iconify-json packages
   */
  extractIconifyPacks() {
    console.log('Extracting Iconify packs...');

    const iconifyPath = path.join(__dirname, '../frontend/node_modules/@iconify-json');
    if (!fs.existsSync(iconifyPath)) {
      throw new Error('@iconify-json packages not found in node_modules');
    }

    const packs = [];
    const packages = fs.readdirSync(iconifyPath);

    // Priority packs for Mermaid diagrams - using available packages
    const priorityPacks = [
      'logos',
      'devicon',
      'flat-color-icons',
      'material-icon-theme'
    ];

    for (const packName of priorityPacks) {
      const packPath = path.join(iconifyPath, packName);
      if (!fs.existsSync(packPath)) {
        console.log(`Skipping ${packName} - not found`);
        continue;
      }

      const iconsJsonPath = path.join(packPath, 'icons.json');
      if (!fs.existsSync(iconsJsonPath)) {
        console.log(`Skipping ${packName} - no icons.json`);
        continue;
      }

      const iconsData = JSON.parse(fs.readFileSync(iconsJsonPath, 'utf-8'));
      const icons = {};

      try {
        for (const [iconKey, iconData] of Object.entries(iconsData.icons || {})) {
          const left = Number(iconData.left ?? 0);
          const top = Number(iconData.top ?? 0);
          const w = Math.round(Number(iconData.width ?? iconsData.width ?? 24));
          const h = Math.round(Number(iconData.height ?? iconsData.height ?? 24));

          icons[iconKey] = {
            body: iconData.body, // includes <path>/<g> etc.
            viewBox: `${left} ${top} ${w} ${h}`,
            width: w,
            height: h
          };
        }
      } catch (error) {
        console.error(`Error processing icons in ${packName}:`, error.message);
        continue;
      }

      console.log(`Extracted ${Object.keys(icons).length} icons from ${packName}`);

      const pack = {
        name: packName,
        display_name: iconsData.info?.name || packName,
        category: 'iconify',
        description: iconsData.info?.description || `${packName} icon collection`,
        icons: icons
      };

      console.log(`Pack structure for ${packName}:`, {
        name: pack.name,
        display_name: pack.display_name,
        category: pack.category,
        icon_count: Object.keys(pack.icons).length
      });

      packs.push(pack);
    }

    return packs;
  }

  /**
   * Clear all existing icon packs
   */
  async clearExistingPacks() {
    console.log('Clearing existing icon packs...');

    try {
      const data = await this.apiRequest('/packs');
      const existingPacks = data || [];

      for (const pack of existingPacks) {
        console.log(`Deleting pack: ${pack.name}`);
        await this.apiRequest(`/packs/${pack.name}`, { method: 'DELETE' });
      }

      console.log(`Cleared ${existingPacks.length} existing packs`);
    } catch (error) {
      console.error('Error clearing existing packs:', error.message);
      throw error;
    }
  }

  /**
   * Install a single icon pack via API
   */
  async installIconPack(packData) {
    console.log(`Installing pack: ${packData.name} (${Object.keys(packData.icons).length} icons)`);

    try {
      // Convert to the expected StandardizedIconPackRequest format
      const standardizedPack = {
        info: {
          name: packData.name,
          displayName: packData.display_name,
          category: packData.category,
          description: packData.description
        },
        icons: packData.icons,
        width: 24,
        height: 24
      };

      const response = await this.apiRequest('/packs', {
        method: 'POST',
        body: JSON.stringify({
          pack_data: standardizedPack
        })
      });

      console.log(`✅ Installed ${packData.name}: ${response.icon_count} icons`);
      return response;
    } catch (error) {
      console.error(`❌ Failed to install ${packData.name}:`, error.message);
      throw error;
    }
  }

  /**
   * Main installation process
   */
  async install() {
    console.log('🚀 Starting production icon installation...');
    console.log(`API Base URL: ${this.apiBaseUrl}`);

    try {
      // Test API connectivity
      console.log('Testing API connectivity...');
      try {
        await this.apiRequest('/packs');
        console.log('✅ API connected successfully');
      } catch (error) {
        console.error('❌ API connectivity test failed:', error.message);
        throw error;
      }

      // Clear existing data
      await this.clearExistingPacks();

      // Extract icon data
      console.log('\n📦 Extracting icon data from packages...');
      const awsPack = this.extractAwsIcons();
      const iconifyPacks = this.extractIconifyPacks();

      const allPacks = [...iconifyPacks];
      if (awsPack) {
        allPacks.push(awsPack);
      }

      const totalIcons = allPacks.reduce((sum, pack) => sum + Object.keys(pack.icons).length, 0);

      console.log(`\n📊 Extracted ${allPacks.length} packs with ${totalIcons} total icons`);

      // Install packs
      console.log('\n🔄 Installing icon packs...');
      const results = [];

      for (const pack of allPacks) {
        try {
          const result = await this.installIconPack(pack);
          results.push(result);
        } catch (error) {
          console.error(`❌ Failed to install ${pack.name}:`, error.message);
          console.error('Full error:', error);
        }
      }

      // Summary
      console.log('\n✅ Installation complete!');
      console.log(`Successfully installed ${results.length}/${allPacks.length} packs`);

      const installedIcons = results.reduce((sum, result) => sum + result.icon_count, 0);
      console.log(`Total icons installed: ${installedIcons}`);

      return results;

    } catch (error) {
      console.error('\n❌ Installation failed:', error.message);
      throw error;
    }
  }

  /**
   * Verify installation
   */
  async verify() {
    console.log('\n🔍 Verifying installation...');

    try {
      const data = await this.apiRequest('/packs');
      const packs = data || [];

      console.log('Installed packs:');
      for (const pack of packs) {
        console.log(`  - ${pack.name}: ${pack.icon_count} icons`);
      }

      // Test search
      const searchData1 = await this.apiRequest('/search?q=aws&size=5');
      console.log(`\nSearch test (AWS): found ${searchData1.total} icons`);

      const searchData2 = await this.apiRequest('/search?q=logo&size=5');
      console.log(`Search test (logo): found ${searchData2.total} icons`);

      return packs;
    } catch (error) {
      console.error('Verification failed:', error.message);
      throw error;
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const apiUrl = args[0] || 'http://localhost:8000';

  console.log('Production Icon Pack Installer');
  console.log('==============================');

  const installer = new ProductionIconInstaller(apiUrl);

  try {
    await installer.install();
    await installer.verify();

    console.log('\n🎉 All done! Icons are ready for production use.');
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Installation failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = ProductionIconInstaller;
