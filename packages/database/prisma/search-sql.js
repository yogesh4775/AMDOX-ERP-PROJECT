const fs = require('fs');
const path = require('path');

function searchInFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('admin@amdox.com')) {
    console.log(`Found in SQL: ${filePath}`);
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      if (line.includes('admin@amdox.com') || line.includes('password') || line.includes('insert') || line.includes('INSERT')) {
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
      walkDir(fullPath);
    } else if (file.endsWith('.sql')) {
      searchInFile(fullPath);
    }
  }
}

walkDir('c:/Users/ys070/amdox-erp/packages/database/prisma/migrations');
process.exit(0);
