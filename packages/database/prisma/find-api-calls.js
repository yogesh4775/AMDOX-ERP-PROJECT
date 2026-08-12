const fs = require('fs');
const path = require('path');

function searchInFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('apiClient(')) {
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      if (line.includes('apiClient(') && !line.includes('export async function apiClient')) {
        console.log(`${filePath} L${i+1}: ${line.trim()}`);
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
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      searchInFile(fullPath);
    }
  }
}

walkDir('c:/Users/ys070/amdox-erp/apps/web/src');
process.exit(0);
