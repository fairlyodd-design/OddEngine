import fs from "fs";
import path from "path";

const root = process.cwd();
const mainPath = path.join(root, "electron", "main.cjs");

if (!fs.existsSync(mainPath)) {
  console.log("No electron/main.cjs found. Nothing to repair.");
  process.exit(0);
}

let main = fs.readFileSync(mainPath, "utf8");
const before = main;

// Remove the unsafe standalone debug line that can crash before mainWindow exists.
main = main.replace(/^\s*mainWindow\.webContents\.openDevTools\(\{ mode: "detach" \}\);\s*\r?\n/gm, "");
main = main.replace(/^\s*if \(mainWindow\?\.webContents\) \{\s*\r?\n\s*mainWindow\.webContents\.openDevTools\(\{ mode: "detach" \}\);\s*\r?\n\s*\}\s*\r?\n/gm, "");

if (main !== before) {
  fs.writeFileSync(mainPath, main, "utf8");
  console.log("Removed unsafe standalone openDevTools line from electron/main.cjs.");
} else {
  console.log("No unsafe standalone openDevTools line found. main.cjs left unchanged.");
}
