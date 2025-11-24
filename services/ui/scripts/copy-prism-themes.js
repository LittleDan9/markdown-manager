// Copies selected Prism theme CSS files from node_modules to public/prism-themes/themes
const fs = require('fs');
const path = require('path');

const THEMES = [
  'prism-vsc-dark-plus.css',
  'prism-one-light.css'
];

const srcDir = path.join(__dirname, '../node_modules/prism-themes/themes');
const destDir = path.join(__dirname, '../public/prism-themes/themes');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

THEMES.forEach(theme => {
  const src = path.join(srcDir, theme);
  const dest = path.join(destDir, theme);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${theme}`);
  } else {
    console.warn(`Theme file not found: ${theme}`);
  }
});
