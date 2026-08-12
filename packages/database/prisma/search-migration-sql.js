const fs = require('fs');
const path = require('path');

function searchInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchInDir(fullPath);
    } else if (file.endsWith('.sql')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('admin@amdox.com')) {
        console.log(`Found email in migration sql: ${fullPath}`);
        const lines = content.split('\n');
        lines.forEach((line, i) => {
          if (line.includes('admin@amdox.com')) {
            console.log(`  L${i+1}: ${line.trim()}`);
          }
        });
      }
    }
  }
}

searchInDir('c:/Users/ys070/amdox-erp/packages/database/prisma/migrations');
process.exit(0);
