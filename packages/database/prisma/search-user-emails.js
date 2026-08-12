const fs = require('fs');
const path = require('path');

function searchInFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('admin@amdox.com') || content.includes('sales@amdox.com')) {
    console.log(`Found in: ${filePath}`);
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      if (line.includes('admin@amdox.com') || line.includes('sales@amdox.com')) {
        console.log(`  L${i+1}: ${line.trim()}`);
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
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git' && file !== '.next') {
        walkDir(fullPath);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.sql')) {
      searchInFile(fullPath);
    }
  }
}

walkDir('c:/Users/ys070/amdox-erp');
process.exit(0);
