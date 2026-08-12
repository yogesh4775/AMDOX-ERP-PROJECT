const fs = require('fs');
const path = require('path');

function searchInFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('rolePermission') || content.includes('RolePermission') || content.includes('SUPER_ADMIN')) {
    console.log(`Found in: ${filePath}`);
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      if (line.includes('rolePermission') || line.includes('RolePermission') || line.includes('SUPER_ADMIN')) {
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
      if (file !== 'node_modules' && file !== 'generated' && file !== '.next') {
        walkDir(fullPath);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.js')) {
      searchInFile(fullPath);
    }
  }
}

walkDir('c:/Users/ys070/amdox-erp/packages/database');
process.exit(0);
