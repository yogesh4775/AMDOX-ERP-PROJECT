const fs = require('fs');
const path = require('path');

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git' && file !== '.next') {
        walkDir(fullPath);
      }
    } else if (file === 'sidebar.tsx' || file === 'Sidebar.tsx') {
      console.log(`Found sidebar at: ${fullPath}`);
    }
  }
}

walkDir('c:/Users/ys070/amdox-erp');
process.exit(0);
