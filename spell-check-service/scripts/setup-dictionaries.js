/**
 * Dictionary Setup Script - Phase 2 Implementation
 * Created: October 22, 2025 by AI Agent
 * Purpose: Extract and setup dictionaries for multi-language support
 */

const fs = require('fs');
const path = require('path');

async function setupDictionaries() {
  console.log('Setting up multi-language dictionaries...');

  const languages = [
    { code: 'en-GB', package: 'dictionary-en-gb', name: 'English (British)' },
    { code: 'es-ES', package: 'dictionary-es', name: 'Spanish' },
    { code: 'fr-FR', package: 'dictionary-fr', name: 'French' },
    { code: 'de-DE', package: 'dictionary-de', name: 'German' }
  ];

  for (const lang of languages) {
    try {
      console.log(`Setting up ${lang.name} (${lang.code})...`);

      // Import the dictionary package using dynamic import
      const dictionaryModule = await import(lang.package);
      
      // Get the dictionary files
      const affBuffer = await new Promise((resolve, reject) => {
        dictionaryModule.default.aff((err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });

      const dicBuffer = await new Promise((resolve, reject) => {
        dictionaryModule.default.dic((err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });

      // Write files to dictionaries directory
      const langDir = path.join(__dirname, '../dictionaries', lang.code);
      if (!fs.existsSync(langDir)) {
        fs.mkdirSync(langDir, { recursive: true });
      }

      fs.writeFileSync(path.join(langDir, 'index.aff'), affBuffer);
      fs.writeFileSync(path.join(langDir, 'index.dic'), dicBuffer);

      console.log(`✓ ${lang.name} dictionary setup complete`);

    } catch (error) {
      console.error(`✗ Failed to setup ${lang.name} dictionary:`, error.message);
    }
  }

  console.log('Dictionary setup complete!');
}

// Run if called directly
if (require.main === module) {
  setupDictionaries().catch(console.error);
}

module.exports = { setupDictionaries };