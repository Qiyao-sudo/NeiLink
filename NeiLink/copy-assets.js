const fs = require('fs');
const path = require('path');

// Source and destination directories
const srcDir = path.join(__dirname, 'src/main/assets');
const destDir = path.join(__dirname, 'dist/main/assets');

// Ensure destination directory exists
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
  console.log('Created directory:', destDir);
}

// Copy all files from source to destination
if (fs.existsSync(srcDir)) {
  const files = fs.readdirSync(srcDir);
  files.forEach(file => {
    const srcPath = path.join(srcDir, file);
    const destPath = path.join(destDir, file);
    fs.copyFileSync(srcPath, destPath);
    console.log('Copied:', file);
  });
  console.log('Assets copied successfully!');
}
