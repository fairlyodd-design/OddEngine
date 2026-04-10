import fs from 'fs';
import path from 'path';

const root = process.cwd();
const mainPath = path.join(root, 'electron', 'main.cjs');
if (!fs.existsSync(mainPath)) {
  console.log('No electron/main.cjs found. Nothing to repair.');
  process.exit(0);
}
let text = fs.readFileSync(mainPath, 'utf8');
const before = text;
text = text.replace(/^\s*mainWindow\.webContents\.openDevTools\(\{ mode:\s*['"]detach['"] \}\);\s*\n?/gm, '');
text = text.replace(/^\s*if\s*\(mainWindow\?\.webContents\)\s*\{\s*mainWindow\.webContents\.openDevTools\(\{ mode:\s*['"]detach['"] \}\);\s*\}\s*\n?/gm, '');
if (text !== before) {
  fs.writeFileSync(mainPath, text, 'utf8');
  console.log('Removed manual openDevTools line from electron/main.cjs');
} else {
  console.log('No manual openDevTools line found in electron/main.cjs');
}
