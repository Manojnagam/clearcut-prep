const fs = require('fs');
const path = require('path');

console.log('Starting build...');

try {
  // Ensure dist and dist/functions/api directories exist
  fs.mkdirSync(path.join(__dirname, 'dist', 'functions', 'api'), { recursive: true });

  // Files to copy to dist/
  const filesToCopy = ['index.html', 'manifest.json', 'sw.js'];
  filesToCopy.forEach(file => {
    fs.copyFileSync(path.join(__dirname, file), path.join(__dirname, 'dist', file));
    console.log(`Copied ${file} to dist/`);
  });

  // Copy groq.js
  fs.copyFileSync(
    path.join(__dirname, 'functions', 'api', 'groq.js'),
    path.join(__dirname, 'dist', 'functions', 'api', 'groq.js')
  );
  console.log('Copied functions/api/groq.js to dist/functions/api/');

  console.log('Build complete! All files copied to dist/ successfully.');
} catch (err) {
  console.error('Build failed:', err);
  process.exit(1);
}
