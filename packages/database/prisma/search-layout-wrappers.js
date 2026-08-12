const fs = require('fs');
const path = require('path');

function searchInFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('max-w-') || content.includes('mx-auto')) {
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      if (line.includes('max-w-') || line.includes('mx-auto')) {
        if (line.includes('max-w-md') || line.includes('max-w-lg') || line.includes('max-w-xl') || line.includes('max-w-2xl') || line.includes('max-w-3xl') || line.includes('max-w-4xl') || line.includes('max-w-5xl') || line.includes('max-w-6xl') || line.includes('max-w-7xl') || line.includes('max-w-screen') || line.includes('mx-auto')) {
          console.log(`${filePath} L${i+1}: ${line.trim()}`);
        }
      }
    });
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== 'dist' && file !== '.git') {
        walkDir(fullPath);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.css')) {
      searchInFile(fullPath);
    }
  }
}

walkDir('c:/Users/ys070/amdox-erp/apps/web/src');
process.exit(0);
